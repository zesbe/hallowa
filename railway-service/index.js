// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const os = require('os');

// Supabase config dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-my-custom-header': 'whatsapp-baileys-service'
    }
  }
});

// Store active WhatsApp sockets
const activeSockets = new Map();

// Polling mechanism - lebih reliable daripada realtime untuk Railway
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Using polling mechanism (every 5 seconds)');
  console.log('🔗 Supabase URL:', supabaseUrl);

  // Function to check devices
  async function checkDevices() {
    try {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('*')
        .in('status', ['connecting', 'connected']);

      if (error) {
        console.error('❌ Error fetching devices:', error);
        return;
      }

      // Ensure sockets for devices that should be online
      const needSockets = devices?.filter(d => ['connecting', 'connected'].includes(d.status)) || [];
      for (const device of needSockets) {
        const sock = activeSockets.get(device.id);
        
        // Check if device stuck in connecting for too long (>2 minutes)
        if (device.status === 'connecting' && device.updated_at) {
          const lastUpdate = new Date(device.updated_at).getTime();
          const now = Date.now();
          const stuckTime = (now - lastUpdate) / 1000; // seconds
          
          if (stuckTime > 120) {
            console.log(`⚠️ Device ${device.device_name} stuck in connecting for ${stuckTime}s - clearing session`);
            // Clear persisted session in DB (no filesystem auth used anymore)
            await supabase.from('devices').update({ 
              status: 'disconnected',
              qr_code: null,
              session_data: null
            }).eq('id', device.id);
            continue;
          }
        }
        
        if (!sock) {
          // No socket exists, create new connection
          console.log(`🔄 (re)connecting device: ${device.device_name} [status=${device.status}]`);
          await connectWhatsApp(device);
        } else if (device.status === 'connected' && !sock.user) {
          // Socket exists but not authenticated, reconnect aggressively
          console.log(`⚠️ Socket exists but not connected for ${device.device_name}, reconnecting...`);
          sock.end();
          activeSockets.delete(device.id);
          await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
          setTimeout(() => connectWhatsApp(device).catch(() => {}), 500);
        }
      }

      // Disconnect devices that should be disconnected
      for (const [deviceId, sock] of activeSockets) {
        const device = devices?.find(d => d.id === deviceId);
        if (!device || device.status === 'disconnected') {
          console.log(`❌ Disconnecting device: ${deviceId}`);
          sock?.end();
          activeSockets.delete(deviceId);
          // Clean auth on explicit disconnect
          try {
            // Filesystem auth removed. Clear session in DB on explicit disconnect
            if (device) {
              await supabase.from('devices').update({ qr_code: null, session_data: null }).eq('id', deviceId);
            }
          } catch (e) {
            console.error('❌ Error cleaning auth on disconnect:', e);
          }
        }
      }

      console.log(`✅ Active connections: ${activeSockets.size}`);
    } catch (error) {
      console.error('❌ Error in checkDevices:', error);
    }
  }

  // Initial check
  console.log('🔍 Initial check for pending connections...');
  await checkDevices();

  // Poll every 5 seconds
  setInterval(checkDevices, 5000);
  console.log('⏱️ Polling started (every 5 seconds)');

  // Check scheduled broadcasts every 10 seconds
  setInterval(checkScheduledBroadcasts, 10000);
  console.log('⏰ Scheduled broadcast check started (every 10 seconds)');

  // Process broadcasts every 3 seconds
  setInterval(processBroadcasts, 3000);
  console.log('📤 Broadcast processing started (every 3 seconds)');

  // Health check ping every 30 seconds
  setInterval(healthCheckPing, 30000);
  console.log('💓 Health check ping started (every 30 seconds)');
}

// Auth state persisted in Supabase (survives Railway restarts)
async function useSupabaseAuthState(deviceId) {
  let creds, keys;
  try {
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();

    const stored = data?.session_data || {};
    creds = stored.creds ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver) : initAuthCreds();
    keys = stored.keys ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver) : {};
  } catch (e) {
    console.error('❌ Failed loading session from Supabase:', e);
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const sessionData = {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      saved_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('devices')
      .update({ session_data: sessionData })
      .eq('id', deviceId);
    if (error) console.error('❌ Failed saving session to Supabase:', error);
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          const result = {};
          for (const id of ids) result[id] = data[id] || null;
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], data[type]);
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}


async function connectWhatsApp(device) {
  console.log(`📱 Connecting device: ${device.device_name} (${device.id})`);

  try {
    const { state, saveCreds } = await useSupabaseAuthState(device.id);

    // Use latest WhatsApp Web version to avoid handshake issues
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // We'll handle QR ourselves
      browser: Browsers.appropriate('Desktop'),
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 10_000,
      syncFullHistory: false,
    });

    activeSockets.set(device.id, sock);

    // Track if pairing code has been requested
    let pairingCodeRequested = false;

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Helper to request pairing code with retries/backoff
      const requestPairCodeWithRetry = async (phone, attempt = 1) => {
        const maxAttempts = 5;
        try {
          const code = await sock.requestPairingCode(phone);
          console.log('✅ Pairing code generated:', code);
          await supabase
            .from('devices')
            .update({ pairing_code: code, status: 'connecting', qr_code: null })
            .eq('id', device.id);
          console.log('✅ Pairing code saved to database');
          pairingCodeRequested = true;
        } catch (err) {
          const status = err?.output?.statusCode || err?.status || err?.data?.status;
          const msg = String(err?.message || '');
          console.error(`❌ Pairing code attempt ${attempt} failed:`, status, msg);
          if (attempt < maxAttempts && (status === 428 || /precondition|connection closed/i.test(msg))) {
            const delay = 750 * attempt; // backoff
            console.log(`⏳ Retry pairing in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
            setTimeout(() => requestPairCodeWithRetry(phone, attempt + 1), delay);
          } else {
            await supabase.from('devices').update({ status: 'error', pairing_code: null }).eq('id', device.id);
          }
        }
      };

      // Handle pairing/QR only when QR event is present to satisfy WA preconditions
      if (qr && !sock.authState.creds.registered) {
        try {
          const { data: deviceData } = await supabase
            .from('devices')
            .select('connection_method, phone_for_pairing')
            .eq('id', device.id)
            .single();

          if (deviceData?.connection_method === 'pairing' && deviceData?.phone_for_pairing) {
            if (pairingCodeRequested) return; // avoid duplicate requests
            const phone = String(deviceData.phone_for_pairing).replace(/\D/g, '');
            console.log('📱 Requesting pairing code for:', phone);
            // Small delay to satisfy WA precondition timing
            await new Promise((r) => setTimeout(r, 1200));
            requestPairCodeWithRetry(phone, 1);
          } else {
            // QR method
            console.log('📷 QR Code generated for', device.device_name);
            const qrDataUrl = await QRCode.toDataURL(qr);
            await supabase
              .from('devices')
              .update({ qr_code: qrDataUrl, status: 'connecting', pairing_code: null })
              .eq('id', device.id);
            console.log('✅ QR saved to database');
          }
        } catch (qrError) {
          console.error('❌ Error generating QR/pairing code:', qrError);
        }
      }

      // Connected successfully
      if (connection === 'open') {
        console.log('✅ Connected:', device.device_name);

        try {
          // Get phone number
          const phoneNumber = sock.user?.id.split(':')[0];
          console.log('📞 Phone number:', phoneNumber);

          // Update database
          const { error } = await supabase
            .from('devices')
          .update({
            status: 'connected',
            phone_number: phoneNumber,
            last_connected_at: new Date().toISOString(),
            qr_code: null,
            server_id: process.env.RAILWAY_STATIC_URL || os.hostname()
          })
            .eq('id', device.id);

          if (error) {
            console.error('❌ Error updating device status:', error);
          } else {
            console.log('✅ Device status updated to connected');
          }

          // Session will be saved via auth state 'creds.update' & keys.set handlers
        } catch (connError) {
          console.error('❌ Error handling connection:', connError);
        }
      }

      // Disconnected
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message || '';
        const restartRequired = code === DisconnectReason.restartRequired || code === 515 || /restart required/i.test(message);
        const loggedOut = code === DisconnectReason.loggedOut;

        console.log('🔌 Connection closed');
        console.log('📊 Disconnect statusCode:', code);
        console.log('🧾 Error message:', message);

        activeSockets.delete(device.id);

        try {
          if (restartRequired) {
            // keep auth, set to connecting and re-connect
            console.log('♻️ Restart required - reconnecting');
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => {
              if (!activeSockets.has(device.id)) {
                connectWhatsApp(device).catch(() => {});
              }
            }, 1500);
          } else if (code === 401 || code === 405) {
            // Authentication failed (401 or 405): clear auth and set error
            console.log(`❌ ${code} Authentication failed - clearing session`);
            await supabase.from('devices').update({ 
              status: 'error', 
              qr_code: null, 
              pairing_code: null,
              session_data: null 
            }).eq('id', device.id);
          } else if (loggedOut) {
            console.log('👋 Logged out - clearing session');
            await supabase.from('devices').update({ status: 'disconnected', phone_number: null, qr_code: null, session_data: null }).eq('id', device.id);
          } else {
            // Other transient errors -> aggressive retry
            console.log('⚠️ Transient error - aggressive retry in 500ms');
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => {
              if (!activeSockets.has(device.id)) {
                console.log('🔁 Attempting reconnect...');
                connectWhatsApp(device).catch(() => {});
              }
            }, 500);
          }
        } catch (discError) {
          console.error('❌ Error handling disconnection:', discError);
        }
      }
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', async () => {
      try { await saveCreds(); } catch (e) { console.error('❌ saveCreds error:', e); }
    });

    // Handle messages (optional - for future message handling)
    sock.ev.on('messages.upsert', async ({ messages }) => {
      console.log('💬 Message received:', messages[0]?.key?.remoteJid);
      // You can save messages to database here
    });

    // Store sock reference for sending messages
    sock.deviceId = device.id;

  } catch (error) {
    console.error('❌ Error connecting WhatsApp:', error);
    
    // Update status to error
    try {
      await supabase
        .from('devices')
        .update({ status: 'error' })
        .eq('id', device.id);
    } catch (updateError) {
      console.error('❌ Error updating error status:', updateError);
    }
    
    activeSockets.delete(device.id);
  }
}

// Start the service
console.log('🎬 Starting WhatsApp Baileys Service...');
startService().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Keep process alive
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  for (const [deviceId, sock] of activeSockets) {
    console.log(`🔌 Disconnecting device: ${deviceId}`);
    sock?.end();
  }
  process.exit(0);
});

// Health check endpoint (optional, for Railway)
const PORT = process.env.PORT || 3000;
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      activeConnections: activeSockets.size,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Baileys Service is running!\n');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// Health check ping to keep connections alive
async function healthCheckPing() {
  try {
    console.log(`💓 Health check: ${activeSockets.size} active socket(s)`);
    
    for (const [deviceId, sock] of activeSockets) {
      try {
        if (sock.user) {
          // Send a lightweight ping to keep connection alive
          const pingTime = Date.now();
          console.log(`📡 Ping device ${deviceId}: ${sock.user.id}`);
          
          // Update last_connected_at to show device is alive
          await supabase
            .from('devices')
            .update({ 
              last_connected_at: new Date().toISOString(),
              status: 'connected'
            })
            .eq('id', deviceId);
        } else {
          console.log(`⚠️ Device ${deviceId} socket exists but not authenticated`);
        }
      } catch (pingError) {
        console.error(`❌ Ping error for device ${deviceId}:`, pingError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in healthCheckPing:', error);
  }
}

// Check and trigger scheduled broadcasts
async function checkScheduledBroadcasts() {
  try {
    const now = new Date().toISOString();
    
    // Get broadcasts that are scheduled and ready to send
    const { data: scheduledBroadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'draft')
      .lte('scheduled_at', now)
      .not('scheduled_at', 'is', null);

    if (error) {
      console.error('❌ Error fetching scheduled broadcasts:', error);
      return;
    }

    if (scheduledBroadcasts && scheduledBroadcasts.length > 0) {
      console.log(`⏰ Found ${scheduledBroadcasts.length} scheduled broadcast(s) ready to send`);
      
      for (const broadcast of scheduledBroadcasts) {
        await supabase
          .from('broadcasts')
          .update({ status: 'processing' })
          .eq('id', broadcast.id);
        
        console.log(`📤 Triggered scheduled broadcast: ${broadcast.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkScheduledBroadcasts:', error);
  }
}

// Process broadcasts
async function processBroadcasts() {
  try {
    // Get broadcasts with status "processing"
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'processing')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      return;
    }

    console.log(`📤 Processing ${broadcasts.length} broadcast(s)`);

    for (const broadcast of broadcasts) {
      try {
        // Get the socket for this device
        const sock = activeSockets.get(broadcast.device_id);
        
        if (!sock) {
          console.error(`❌ No active socket for device: ${broadcast.device_id} — scheduling reconnect`);
          // Try to reconnect the device and keep the broadcast in processing
          const { data: device } = await supabase
            .from('devices')
            .select('*')
            .eq('id', broadcast.device_id)
            .maybeSingle();

          if (device && !activeSockets.has(device.id)) {
            try {
              await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
              connectWhatsApp(device).catch(() => {});
            } catch (e) {
              console.error('❌ Error scheduling reconnect:', e);
            }
          }
          // Skip for now; will retry on next processing tick
          continue;
        }

        console.log(`📤 Sending broadcast: ${broadcast.name}`);
        
        let sentCount = 0;
        let failedCount = 0;

        // Send to each target contact
        for (const contact of broadcast.target_contacts) {
          try {
            // Extract phone number from contact object or use as string
            const phoneNumber = typeof contact === 'object' ? contact.phone_number : contact;
            
            if (!phoneNumber) {
              console.error('❌ Invalid contact:', contact);
              failedCount++;
              continue;
            }
            
            // Format phone number (ensure it has @s.whatsapp.net suffix)
            const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
            
            // Prepare message content
            let messageContent;
            
            if (broadcast.media_url) {
              // Send media message
              try {
                const mediaType = getMediaType(broadcast.media_url);
                const response = await fetch(broadcast.media_url);
                const buffer = await response.arrayBuffer();
                
                if (mediaType === 'image') {
                  messageContent = {
                    image: Buffer.from(buffer),
                    caption: broadcast.message || ''
                  };
                } else if (mediaType === 'video') {
                  messageContent = {
                    video: Buffer.from(buffer),
                    caption: broadcast.message || ''
                  };
                } else if (mediaType === 'audio') {
                  messageContent = {
                    audio: Buffer.from(buffer),
                    mimetype: 'audio/mp4'
                  };
                } else if (mediaType === 'document') {
                  messageContent = {
                    document: Buffer.from(buffer),
                    caption: broadcast.message || '',
                    mimetype: 'application/pdf'
                  };
                } else {
                  // Fallback to text message
                  messageContent = { text: broadcast.message };
                }
              } catch (mediaError) {
                console.error('❌ Error loading media:', mediaError);
                // Fallback to text only
                messageContent = { text: broadcast.message };
              }
            } else {
              // Text only message
              messageContent = { text: broadcast.message };
            }
            
            // Send message
            await sock.sendMessage(jid, messageContent);
            
            sentCount++;
            console.log(`✅ Sent to ${phoneNumber}`);
            
            // Add small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (sendError) {
            failedCount++;
            console.error(`❌ Failed to send to ${contact}:`, sendError.message);
          }
        }

        // Update broadcast with results
        await supabase
          .from('broadcasts')
          .update({
            status: 'completed',
            sent_count: sentCount,
            failed_count: failedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);

        console.log(`✅ Broadcast completed: ${sentCount} sent, ${failedCount} failed`);

      } catch (broadcastError) {
        console.error(`❌ Error processing broadcast ${broadcast.id}:`, broadcastError);
        
        // Update broadcast status to failed
        await supabase
          .from('broadcasts')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);
      }
    }
  } catch (error) {
    console.error('❌ Error in processBroadcasts:', error);
  }
}

// Helper function to determine media type from URL
function getMediaType(url) {
  const ext = url.toLowerCase().split('.').pop().split('?')[0];
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  } else if (['mp4', 'mov', 'avi'].includes(ext)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  } else if (['pdf', 'doc', 'docx'].includes(ext)) {
    return 'document';
  }
  
  return 'document';
}

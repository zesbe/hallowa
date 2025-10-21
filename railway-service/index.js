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

// Track broadcasts currently being processed to prevent duplicates
const processingBroadcasts = new Set();

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
          // Check if we have valid session data for recovery
          const hasSessionData = device.session_data?.creds?.registered;
          
          if (device.status === 'connected' && hasSessionData) {
            // Railway restart detected - try to recover session
            console.log(`🔄 Recovering session for: ${device.device_name} (Railway restart detected)`);
            await connectWhatsApp(device, true); // Pass recovery flag
          } else {
            console.log(`🔄 Connecting device: ${device.device_name} [status=${device.status}]`);
            await connectWhatsApp(device);
          }
        } else if (device.status === 'connected' && !sock.user) {
          // Socket exists but not authenticated, try session recovery first
          const hasSessionData = device.session_data?.creds?.registered;
          
          console.log(`⚠️ Socket exists but not authenticated for ${device.device_name}`);
          sock.end();
          activeSockets.delete(device.id);
          
          if (hasSessionData) {
            console.log(`🔄 Attempting session recovery for ${device.device_name}`);
            setTimeout(() => connectWhatsApp(device, true).catch(() => {}), 500);
          } else {
            console.log(`🔄 No session data - will generate QR/pairing code`);
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => connectWhatsApp(device).catch(() => {}), 500);
          }
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


async function connectWhatsApp(device, isRecovery = false) {
  if (isRecovery) {
    console.log(`🔄 Session Recovery Mode for: ${device.device_name} (${device.id})`);
  } else {
    console.log(`📱 Connecting device: ${device.device_name} (${device.id})`);
  }

  try {
    const { state, saveCreds } = await useSupabaseAuthState(device.id);
    
    // Log session status
    if (state.creds.registered) {
      console.log(`✅ Valid session found in Supabase - will auto-restore`);
    } else {
      console.log(`⚠️ No valid session - will require QR/pairing code`);
    }

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

      // Request pairing code when connecting (preferred) or when QR event is present
      // IMPORTANT: Only generate QR/pairing if NOT in recovery mode AND not registered
      if (!sock.authState.creds.registered && !isRecovery) {
        try {
          const { data: deviceData } = await supabase
            .from('devices')
            .select('status, connection_method, phone_for_pairing')
            .eq('id', device.id)
            .single();

          // Pairing code flow: trigger as soon as we're connecting (no need to wait for QR)
          if (
            connection === 'connecting' &&
            deviceData?.status === 'connecting' &&
            deviceData?.connection_method === 'pairing' &&
            deviceData?.phone_for_pairing
          ) {
            if (!pairingCodeRequested) {
              const phone = String(deviceData.phone_for_pairing).replace(/\D/g, '');
              console.log('📱 Requesting pairing code (connecting) for:', phone);
              // Small delay to satisfy WA precondition timing
              await new Promise((r) => setTimeout(r, 800));
              requestPairCodeWithRetry(phone, 1);
            }
          }

          // QR method or fallback to QR when pairing not configured
          if (qr) {
            if (
              deviceData?.status === 'connecting' &&
              deviceData?.connection_method === 'pairing' &&
              deviceData?.phone_for_pairing
            ) {
              if (!pairingCodeRequested) {
                const phone = String(deviceData.phone_for_pairing).replace(/\D/g, '');
                console.log('📱 Requesting pairing code (qr event) for:', phone);
                await new Promise((r) => setTimeout(r, 1200));
                requestPairCodeWithRetry(phone, 1);
              }
            } else if (deviceData?.status === 'connecting') {
              console.log('📷 QR Code generated for', device.device_name);
              const qrDataUrl = await QRCode.toDataURL(qr);
              await supabase
                .from('devices')
                .update({ qr_code: qrDataUrl, status: 'connecting', pairing_code: null })
                .eq('id', device.id);
              console.log('✅ QR saved to database');
            }
          }
        } catch (qrError) {
          console.error('❌ Error generating QR/pairing code:', qrError);
        }
      }

      // Connected successfully
      if (connection === 'open') {
        if (isRecovery) {
          console.log('🎉 Session recovered successfully:', device.device_name);
        } else {
          console.log('✅ Connected:', device.device_name);
        }

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
            pairing_code: null,
            server_id: process.env.RAILWAY_STATIC_URL || os.hostname()
          })
            .eq('id', device.id);

          if (error) {
            console.error('❌ Error updating device status:', error);
          } else {
            if (isRecovery) {
              console.log('🎉 Session restored without needing re-scan!');
            } else {
              console.log('✅ Device status updated to connected');
            }
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
          // Respect user-initiated cancel: do nothing if already disconnected
          const { data: current } = await supabase
            .from('devices')
            .select('status')
            .eq('id', device.id)
            .single();

          if (current?.status === 'disconnected') {
            console.log('🧘 User set status to disconnected — skipping auto-reconnect');
            return;
          }

          if (restartRequired) {
            // Keep auth, try session recovery
            console.log('♻️ Restart required - attempting session recovery');
            const hasSessionData = current?.session_data?.creds?.registered;
            
            if (hasSessionData) {
              console.log('🔄 Session data available - recovering without QR');
              setTimeout(() => {
                if (!activeSockets.has(device.id)) {
                  connectWhatsApp(device, true).catch(() => {}); // Recovery mode
                }
              }, 1500);
            } else {
              console.log('⚠️ No session data - will generate QR');
              await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
              setTimeout(() => {
                if (!activeSockets.has(device.id)) {
                  connectWhatsApp(device).catch(() => {});
                }
              }, 1500);
            }
          } else if (code === 401 || code === 405) {
            // Authentication failed: clear auth and force fresh login (QR/Pairing)
            console.log(`❌ ${code} Authentication failed - clearing session & reconnecting for fresh login`);
            await supabase.from('devices').update({ 
              status: 'connecting',
              qr_code: null, 
              pairing_code: null,
              session_data: null 
            }).eq('id', device.id);
            setTimeout(() => {
              if (!activeSockets.has(device.id)) {
                console.log('🔁 Reconnect after auth failure...');
                connectWhatsApp(device).catch(() => {});
              }
            }, 1000);
          } else if (loggedOut) {
            console.log('👋 Logged out - clearing session');
            await supabase.from('devices').update({ status: 'disconnected', phone_number: null, qr_code: null, session_data: null }).eq('id', device.id);
          } else {
            // Other transient errors -> try session recovery if available
            console.log('⚠️ Transient error - checking session data');
            const hasSessionData = current?.session_data?.creds?.registered;
            
            if (hasSessionData) {
              console.log('🔄 Session data available - attempting recovery');
              setTimeout(() => {
                if (!activeSockets.has(device.id)) {
                  console.log('🔁 Attempting session recovery...');
                  connectWhatsApp(device, true).catch(() => {});
                }
              }, 500);
            } else {
              console.log('⚠️ No session data - will generate QR');
              await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
              setTimeout(() => {
                if (!activeSockets.has(device.id)) {
                  console.log('🔁 Attempting reconnect with QR...');
                  connectWhatsApp(device).catch(() => {});
                }
              }, 500);
            }
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
      // Skip if already being processed (prevent duplicates)
      if (processingBroadcasts.has(broadcast.id)) {
        console.log(`⏭️ Skipping broadcast ${broadcast.id} - already processing`);
        continue;
      }

      // Mark as processing
      processingBroadcasts.add(broadcast.id);

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

        // Get delay settings
        const delayType = broadcast.delay_type || 'auto';
        const baseDelay = broadcast.delay_seconds || 5;
        const randomizeDelay = broadcast.randomize_delay !== false;
        const batchSize = broadcast.batch_size || 20;
        const pauseBetweenBatches = (broadcast.pause_between_batches || 60) * 1000;

        // Calculate adaptive delay based on contact count
        const getAdaptiveDelay = (contactCount) => {
          if (delayType === 'auto') {
            if (contactCount <= 20) return 3000;
            if (contactCount <= 50) return 5000;
            if (contactCount <= 100) return 8000;
            return 12000;
          } else if (delayType === 'adaptive') {
            // Start conservative, will adjust based on success rate
            return Math.max(3000, baseDelay * 1000);
          } else {
            // Manual mode
            return Math.max(2000, baseDelay * 1000);
          }
        };

        // Calculate actual delay with randomization
        const calculateDelay = (baseDelayMs) => {
          if (!randomizeDelay) return baseDelayMs;
          
          // Add random variation ±30%
          const variation = 0.3;
          const minDelay = baseDelayMs * (1 - variation);
          const maxDelay = baseDelayMs * (1 + variation);
          return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
        };

        const adaptiveDelayMs = getAdaptiveDelay(broadcast.target_contacts.length);
        console.log(`📊 Delay settings: type=${delayType}, base=${baseDelay}s, adaptive=${adaptiveDelayMs}ms, randomize=${randomizeDelay}`);

        // Send to each target contact with intelligent batching
        for (let i = 0; i < broadcast.target_contacts.length; i++) {
          const contact = broadcast.target_contacts[i];
          
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
              // Send media message with retry logic
              let mediaLoaded = false;
              let retryCount = 0;
              const maxRetries = 3;
              
              while (!mediaLoaded && retryCount < maxRetries) {
                try {
                  const mediaType = getMediaType(broadcast.media_url);
                  console.log(`📥 Downloading media (attempt ${retryCount + 1}/${maxRetries}): ${broadcast.media_url}`);
                  
                  const response = await fetch(broadcast.media_url, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  
                  const buffer = await response.arrayBuffer();
                  
                  if (buffer.byteLength === 0) {
                    throw new Error('Downloaded file is empty (0 bytes)');
                  }
                  
                  console.log(`✅ Media downloaded: ${buffer.byteLength} bytes`);
                  
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
                  
                  mediaLoaded = true;
                } catch (mediaError) {
                  retryCount++;
                  console.error(`❌ Error loading media (attempt ${retryCount}/${maxRetries}):`, mediaError.message);
                  
                  if (retryCount >= maxRetries) {
                    console.error('❌ Max retries reached, sending text only');
                    // Fallback to text only after max retries
                    messageContent = { text: broadcast.message };
                    mediaLoaded = true;
                  } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  }
                }
              }
            } else {
              // Text only message
              messageContent = { text: broadcast.message };
            }
            
            // Send message
            await sock.sendMessage(jid, messageContent);
            
            sentCount++;
            console.log(`✅ Sent to ${phoneNumber} (${i + 1}/${broadcast.target_contacts.length})`);
            
            // Batch pause logic
            if ((i + 1) % batchSize === 0 && i < broadcast.target_contacts.length - 1) {
              console.log(`⏸️ Batch complete (${i + 1} messages). Pausing for ${pauseBetweenBatches / 1000}s...`);
              
              // Update progress during pause
              await supabase
                .from('broadcasts')
                .update({
                  sent_count: sentCount,
                  failed_count: failedCount,
                  updated_at: new Date().toISOString()
                })
                .eq('id', broadcast.id);
              
              await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
            } else if (i < broadcast.target_contacts.length - 1) {
              // Regular delay between messages
              const delayMs = calculateDelay(adaptiveDelayMs);
              console.log(`⏱️ Waiting ${delayMs}ms before next message...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
          } catch (sendError) {
            failedCount++;
            console.error(`❌ Failed to send to ${contact}:`, sendError.message);
            
            // Small delay even on error
            await new Promise(resolve => setTimeout(resolve, 1000));
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
      } finally {
        // Remove from processing set when done
        processingBroadcasts.delete(broadcast.id);
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

// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
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
        if (!activeSockets.has(device.id)) {
          console.log(`🔄 (re)connecting device: ${device.device_name} [status=${device.status}]`);
          await connectWhatsApp(device);
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
            const fs = require('fs');
            const authPath = `./auth_info_${deviceId}`;
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
            if (device) {
              await supabase.from('devices').update({ qr_code: null }).eq('id', deviceId);
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

  // Process broadcasts every 3 seconds
  setInterval(processBroadcasts, 3000);
  console.log('📤 Broadcast processing started (every 3 seconds)');
}

async function connectWhatsApp(device) {
  console.log(`📱 Connecting device: ${device.device_name} (${device.id})`);

  try {
    const authPath = `./auth_info_${device.id}`;
    const fs = require('fs');
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

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

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Generate QR code
      if (qr) {
        console.log('📷 QR Code generated for', device.device_name);
        
        try {
          // Generate QR as data URL
          const qrDataUrl = await QRCode.toDataURL(qr);

          // Update database with QR code
          const { error } = await supabase
            .from('devices')
            .update({ 
              qr_code: qrDataUrl,
              status: 'connecting'
            })
            .eq('id', device.id);

          if (error) {
            console.error('❌ Error saving QR to database:', error);
          } else {
            console.log('✅ QR saved to database');
          }
        } catch (qrError) {
          console.error('❌ Error generating QR code:', qrError);
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

          // Save session presence flag (we store files on disk; DB just has a marker)
          const sessionData = { has_session: true, saved_at: new Date().toISOString() };
          await supabase
            .from('devices')
            .update({ session_data: sessionData })
            .eq('id', device.id);

          console.log('💾 Session data saved');
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
          } else if (code === 405) {
            // Likely bad auth: clear auth and set error
            console.log('❌ 405 Authentication failed - clearing session');
            const fs = require('fs');
            const authPath = `./auth_info_${device.id}`;
            if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            await supabase.from('devices').update({ status: 'error', qr_code: null }).eq('id', device.id);
          } else if (loggedOut) {
            console.log('👋 Logged out - clearing session');
            const fs = require('fs');
            const authPath = `./auth_info_${device.id}`;
            if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            await supabase.from('devices').update({ status: 'disconnected', phone_number: null, qr_code: null }).eq('id', device.id);
          } else {
            // Other transient errors -> retry
            console.log('⚠️ Transient error - retrying connection');
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => {
              if (!activeSockets.has(device.id)) {
                connectWhatsApp(device).catch(() => {});
              }
            }, 1500);
          }
        } catch (discError) {
          console.error('❌ Error handling disconnection:', discError);
        }
      }
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

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
            // Format phone number (ensure it has @s.whatsapp.net suffix)
            const jid = contact.includes('@') ? contact : `${contact}@s.whatsapp.net`;
            
            // Send message
            await sock.sendMessage(jid, { 
              text: broadcast.message 
            });
            
            sentCount++;
            console.log(`✅ Sent to ${contact}`);
            
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

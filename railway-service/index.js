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

      // Connect devices with 'connecting' status
      const connectingDevices = devices?.filter(d => d.status === 'connecting') || [];
      for (const device of connectingDevices) {
        if (!activeSockets.has(device.id)) {
          console.log(`🔄 Starting connection for device: ${device.device_name}`);
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
}

async function connectWhatsApp(device) {
  console.log(`📱 Connecting device: ${device.device_name} (${device.id})`);

  try {
    // Clear old auth folder first to avoid corrupt sessions
    const authPath = `./auth_info_${device.id}`;
    const fs = require('fs');
    const path = require('path');
    
    // Remove old auth folder if exists
    if (fs.existsSync(authPath)) {
      console.log(`🗑️ Removing old auth folder: ${authPath}`);
      fs.rmSync(authPath, { recursive: true, force: true });
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
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('🔌 Connection closed');
        console.log('📊 Disconnect statusCode:', statusCode);
        console.log('🧾 Error message:', lastDisconnect?.error?.message);

        activeSockets.delete(device.id);
        
        // Remove auth folder on disconnect to ensure clean state
        const authPath = `./auth_info_${device.id}`;
        const fs = require('fs');
        if (fs.existsSync(authPath)) {
          console.log(`🗑️ Cleaning auth folder on disconnect`);
          fs.rmSync(authPath, { recursive: true, force: true });
        }

        try {
          if (shouldReconnect && statusCode !== 405) {
            // Only retry if not 405 error
            console.log('⚠️ Will retry connection');
            await supabase
              .from('devices')
              .update({ 
                status: 'disconnected',
                qr_code: null 
              })
              .eq('id', device.id);
          } else if (statusCode === 405) {
            // 405 error - auth issue, set to error
            console.log('❌ Error 405 detected - Authentication failed');
            await supabase
              .from('devices')
              .update({ 
                status: 'error',
                qr_code: null 
              })
              .eq('id', device.id);
          } else {
            // Logged out
            await supabase
              .from('devices')
              .update({ 
                status: 'disconnected',
                phone_number: null,
                qr_code: null
              })
              .eq('id', device.id);
            
            console.log('👋 Device logged out');
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

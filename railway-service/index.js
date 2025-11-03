// Polyfill untuk crypto
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

// Error handling untuk uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Don't exit, try to recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, try to recover
});

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');

// Initialize Redis client with error handling
let redis;
try {
  redis = require('./redis-client');
} catch (error) {
  console.log('⚠️ Redis client not available, using in-memory storage');
  // Fallback to in-memory storage
  redis = {
    setPairingCode: async (deviceId, code, ttl) => {
      console.log(`📦 Storing pairing code in memory: ${deviceId} = ${code}`);
      return 'OK';
    },
    setQRCode: async (deviceId, qr, ttl) => {
      console.log(`📦 Storing QR in memory: ${deviceId}`);
      return 'OK';
    }
  };
}

// Import handlers
const { handleQRCode } = require('./qr-handler');
const stablePairing = require('./pairing-stable');

// Stable pairing handler - works like QR but with pairing codes

// Supabase config
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
  }
});

// Store active sockets
const activeSockets = new Map();

// Graceful shutdown flag
let isShuttingDown = false;

// Main service
async function startService() {
  console.log('🚀 WhatsApp Service Started (Stable Version)');
  console.log('📡 Polling for devices...');
  
  // Check devices periodically
  const checkInterval = setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      await checkDevices();
    } catch (error) {
      console.error('❌ Error in check cycle:', error);
    }
  }, 10000);
  
  // Initial check
  await checkDevices();
}

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
    
    // Process each device
    for (const device of devices || []) {
      try {
        await processDevice(device);
      } catch (error) {
        console.error(`❌ Error processing device ${device.id}:`, error);
      }
    }
    
    console.log(`✅ Active connections: ${activeSockets.size}`);
  } catch (error) {
    console.error('❌ Error in checkDevices:', error);
  }
}

async function processDevice(device) {
  const existingSocket = activeSockets.get(device.id);
  
  if (!existingSocket && device.status === 'connecting') {
    console.log(`🔄 Creating connection for: ${device.device_name}`);
    await createConnection(device);
  } else if (existingSocket && !existingSocket.user && device.status === 'connecting') {
    // Socket exists but not authenticated
    console.log(`⚠️ Socket not authenticated for ${device.device_name}`);
  }
}

async function createConnection(device) {
  try {
    console.log(`📱 Creating socket for: ${device.device_name}`);
    
    // Create auth state
    const { state, saveCreds } = await useAuthState(device.id);
    
    // Get latest version
    const { version } = await fetchLatestBaileysVersion();
    
    // Create socket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['HalloWa', '', ''],
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      getMessage: async () => null
    });
    
    // Store socket
    activeSockets.set(device.id, sock);
    sock.deviceId = device.id;
    
    // Determine connection method
    const isPairing = device.connection_method === 'pairing' && device.phone_for_pairing;
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      await handleConnectionUpdate(sock, device, update, isPairing, saveCreds);
    });
    
    // Save credentials
    sock.ev.on('creds.update', saveCreds);
    
    console.log(`✅ Socket created for ${device.device_name}`);
    
  } catch (error) {
    console.error(`❌ Error creating connection for ${device.device_name}:`, error);
    activeSockets.delete(device.id);
  }
}

async function handleConnectionUpdate(sock, device, update, isPairing, saveCreds) {
  const { connection, lastDisconnect, qr } = update;
  
  console.log(`📡 Update for ${device.device_name}:`, {
    connection,
    hasQR: !!qr,
    isPairing
  });
  
  try {
    // Handle pairing or QR
    if (!sock.authState?.creds?.registered) {
      if (isPairing) {
        // Handle pairing - only once per connection
        if (!sock.pairingAttempted) {
          sock.pairingAttempted = true;
          console.log('🔐 Attempting pairing...');
          const code = await stablePairing.generateCode(sock, device, supabase);
          if (code) {
            console.log(`✅ Pairing code generated: ${code}`);
          } else {
            console.log('❌ Pairing failed - check device error message');
          }
        }
      } else if (qr) {
        // Handle QR
        console.log('📷 Generating QR code...');
        await handleQRCode(sock, device, supabase, qr);
      }
    }
    
    // Handle successful connection
    if (connection === 'open' && sock.user) {
      console.log('✅ Connected:', device.device_name);
      await supabase
        .from('devices')
        .update({
          status: 'connected',
          phone_number: sock.user.id.split(':')[0],
          last_connected_at: new Date().toISOString()
        })
        .eq('id', device.id);
    }
    
    // Handle disconnection
    if (connection === 'close') {
      console.log('🔌 Disconnected:', device.device_name);
      activeSockets.delete(device.id);
      
      // Clear pairing data on disconnect
      if (isPairing) {
        stablePairing.clearDevice(device.id);
        sock.pairingAttempted = false; // Reset flag for next connection
      }
      
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect && !isShuttingDown) {
        console.log('🔄 Will reconnect in 5 seconds...');
        setTimeout(() => {
          if (!isShuttingDown) {
            createConnection(device);
          }
        }, 5000);
      }
    }
  } catch (error) {
    console.error('❌ Error in connection update:', error);
  }
}

async function useAuthState(deviceId) {
  let creds, keys;
  
  try {
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();
    
    const stored = data?.session_data || {};
    creds = stored.creds || initAuthCreds();
    keys = stored.keys || {};
  } catch (e) {
    creds = initAuthCreds();
    keys = {};
  }
  
  const saveCreds = async () => {
    try {
      await supabase
        .from('devices')
        .update({
          session_data: {
            creds,
            keys,
            saved_at: new Date().toISOString()
          }
        })
        .eq('id', deviceId);
    } catch (error) {
      console.error('❌ Error saving creds:', error);
    }
  };
  
  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          return ids.reduce((dict, id) => {
            dict[id] = data[id];
            return dict;
          }, {});
        },
        set: async (data) => {
          Object.assign(keys, data);
          await saveCreds();
        }
      }
    },
    saveCreds
  };
}

// Health check server
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
    res.writeHead(200);
    res.end('WhatsApp Service Running\n');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  isShuttingDown = true;
  
  // Close all sockets
  for (const [id, sock] of activeSockets) {
    console.log(`🔌 Closing socket: ${id}`);
    sock?.end();
  }
  
  // Close server
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forced shutdown');
    process.exit(0);
  }, 10000);
}

// Start service
startService().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
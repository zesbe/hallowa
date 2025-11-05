// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const { createClient } = require('@supabase/supabase-js');
const QRConnectionManager = require('./connection-manager-qr');
const PairingConnectionManager = require('./connection-manager-pairing');
const BroadcastProcessor = require('./broadcast-processor');
const http = require('http');

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

// Initialize managers
const qrManager = new QRConnectionManager(supabase, activeSockets);
const pairingManager = new PairingConnectionManager(supabase, activeSockets);
const broadcastProcessor = new BroadcastProcessor(supabase, activeSockets);

/**
 * Main service orchestrator
 */
async function startService() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 WhatsApp Baileys Service Started (Refactored Architecture)');
  console.log('='.repeat(70));
  console.log('📡 Using polling mechanism (optimized intervals)');
  console.log('🔗 Supabase URL:', supabaseUrl);
  console.log('🏗️  Architecture: Modular Connection Managers');
  console.log('   ├─ QR Connection Manager (QR code method)');
  console.log('   ├─ Pairing Connection Manager (Pairing code method)');
  console.log('   └─ Broadcast Processor (Message sending)');
  console.log('='.repeat(70) + '\n');

  // Initial device check
  console.log('🔍 Initial check for pending connections...');
  await checkDevices();

  // Start polling intervals
  setInterval(checkDevices, 10000);
  console.log('⏱️  Device polling started (every 10 seconds)');

  setInterval(() => broadcastProcessor.checkScheduledBroadcasts(), 30000);
  console.log('⏰ Scheduled broadcast check started (every 30 seconds)');

  setInterval(() => broadcastProcessor.processBroadcasts(), 10000);
  console.log('📤 Broadcast processing started (every 10 seconds)');

  setInterval(healthCheckPing, 60000);
  console.log('💓 Health check ping started (every 60 seconds)');

  console.log('\n✅ All services initialized successfully!\n');
}

/**
 * Check devices and manage connections
 */
async function checkDevices() {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .in('status', ['connecting', 'connected']);

    if (error) {
      console.error('❌ [Main] Error fetching devices:', error);
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
        const stuckTime = (now - lastUpdate) / 1000;

        if (stuckTime > 120) {
          console.log(`⚠️ [Main] Device ${device.device_name} stuck in connecting for ${stuckTime}s - clearing session`);
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
        await connectWhatsApp(device);
      } else if (device.status === 'connected' && !sock.user) {
        // Socket exists but not authenticated
        console.log(`⚠️ [Main] Socket exists but not authenticated for ${device.device_name}`);
        sock.end();
        activeSockets.delete(device.id);

        const hasSessionData = device.session_data?.creds?.registered;

        if (hasSessionData) {
          console.log(`🔄 [Main] Attempting session recovery for ${device.device_name}`);
          setTimeout(() => connectWhatsApp(device, true).catch(() => {}), 500);
        } else {
          console.log(`🔄 [Main] No session data - will generate QR/pairing code`);
          await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
          setTimeout(() => connectWhatsApp(device).catch(() => {}), 500);
        }
      }
    }

    // Disconnect devices that should be disconnected
    for (const [deviceId, sock] of activeSockets) {
      const device = devices?.find(d => d.id === deviceId);
      if (!device || device.status === 'disconnected') {
        console.log(`❌ [Main] Disconnecting device: ${deviceId}`);
        sock?.end();
        activeSockets.delete(deviceId);

        // Clean session in DB on explicit disconnect
        if (device) {
          await supabase.from('devices').update({ qr_code: null, session_data: null }).eq('id', deviceId);
        }
      }
    }

    console.log(`✅ [Main] Active connections: ${activeSockets.size}`);
  } catch (error) {
    console.error('❌ [Main] Error in checkDevices:', error);
  }
}

/**
 * Connect WhatsApp device (delegates to appropriate manager)
 */
async function connectWhatsApp(device, isRecovery = false) {
  const deviceName = device.device_name || 'Unknown';

  // Check if already has valid session
  const hasSessionData = device.session_data?.creds?.registered;

  // For recovery mode, use appropriate manager
  if (isRecovery) {
    console.log(`🔄 [Main] Recovering session for: ${deviceName}`);

    // Use the same manager that was originally used (check connection_method)
    if (device.connection_method === 'pairing') {
      await pairingManager.connect(device, true);
    } else {
      await qrManager.connect(device, true);
    }
    return;
  }

  // For new connections, check connection method
  const { data: deviceConfig } = await supabase
    .from('devices')
    .select('connection_method, phone_for_pairing')
    .eq('id', device.id)
    .single();

  const isPairingMode = deviceConfig?.connection_method === 'pairing' && !!deviceConfig?.phone_for_pairing;

  if (isPairingMode) {
    console.log(`🔑 [Main] Using Pairing Manager for: ${deviceName}`);
    await pairingManager.connect(device, false);
  } else {
    console.log(`📷 [Main] Using QR Manager for: ${deviceName}`);
    await qrManager.connect(device, false);
  }
}

/**
 * Health check ping to keep connections alive
 */
async function healthCheckPing() {
  try {
    console.log(`💓 [Health] Checking ${activeSockets.size} active socket(s)`);

    for (const [deviceId, sock] of activeSockets) {
      try {
        if (sock.user) {
          console.log(`📡 [Health] Ping device ${deviceId}: ${sock.user.id}`);

          // Update last_connected_at to show device is alive
          await supabase
            .from('devices')
            .update({
              last_connected_at: new Date().toISOString(),
              status: 'connected'
            })
            .eq('id', deviceId);
        } else {
          console.log(`⚠️ [Health] Device ${deviceId} socket exists but not authenticated`);
        }
      } catch (pingError) {
        console.error(`❌ [Health] Ping error for device ${deviceId}:`, pingError.message);
      }
    }
  } catch (error) {
    console.error('❌ [Health] Error in healthCheckPing:', error);
  }
}

// Start the service
console.log('🎬 Starting WhatsApp Baileys Service...');
startService().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Keep process alive - graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  for (const [deviceId, sock] of activeSockets) {
    console.log(`🔌 Disconnecting device: ${deviceId}`);
    sock?.end();
  }
  process.exit(0);
});

// Health check HTTP server (for Railway)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      activeConnections: activeSockets.size,
      timestamp: new Date().toISOString(),
      architecture: 'modular',
      managers: {
        qr: 'QRConnectionManager',
        pairing: 'PairingConnectionManager',
        broadcast: 'BroadcastProcessor'
      }
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Baileys Service (Modular Architecture) is running!\n');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

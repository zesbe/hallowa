// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const http = require('http');
const { supabase } = require('./config/supabase');
const { connectWhatsApp } = require('./services/whatsapp/connectionManager');
const { checkDevices } = require('./services/device/deviceManager');
const { checkAndQueueBroadcasts } = require('./services/broadcast/queuedBroadcastProcessor');
const { checkScheduledBroadcasts } = require('./services/broadcast/scheduledBroadcasts');
const { healthCheckPing } = require('./services/health/healthCheck');
const { checkAutoPostSchedules } = require('./auto-post-handler');
const { createHTTPServer } = require('./http-server');
const { createBroadcastWorker, createQueueEvents } = require('./jobs/broadcastQueue');

// Store active WhatsApp sockets
const activeSockets = new Map();

// Store BullMQ worker and queue events for graceful shutdown
let broadcastWorker = null;
let queueEvents = null;

/**
 * Start the WhatsApp Baileys Service
 * Sets up polling intervals and HTTP server
 */
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Using hybrid architecture: Polling + BullMQ Queue');

  // Start HTTP server for CRM message sending
  const httpServer = createHTTPServer(activeSockets);
  const port = process.env.PORT || 3000;

  // Add error handling for port conflicts
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
      console.log('🔄 Trying alternative port...');
      httpServer.listen(0, '0.0.0.0', () => {
        const address = httpServer.address();
        console.log(`🌐 HTTP Server listening on port ${address.port}`);
        console.log(`📡 Endpoints: /health, /send-message`);
      });
    } else {
      console.error('❌ HTTP Server error:', err);
    }
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server listening on port ${port}`);
    console.log(`📡 Endpoints: /health, /send-message`);
  });

  // 🆕 Start BullMQ Worker for broadcast processing
  console.log('🔧 Starting BullMQ broadcast worker...');
  try {
    broadcastWorker = createBroadcastWorker(activeSockets);
    queueEvents = createQueueEvents();

    if (broadcastWorker) {
      console.log('✅ BullMQ worker started - broadcasts will be processed via queue');
    } else {
      console.warn('⚠️  BullMQ worker not started - check UPSTASH_REDIS_URL configuration');
      console.warn('⚠️  Falling back to polling mode for broadcast processing');
    }
  } catch (error) {
    console.error('❌ Failed to start BullMQ worker:', error);
    console.warn('⚠️  Falling back to polling mode for broadcast processing');
  }

  // Initial check
  console.log('🔍 Initial check for pending connections...');
  await checkDevices(activeSockets, connectWhatsApp);

  // Poll every 10 seconds (reduced from 5s to save resources)
  setInterval(() => checkDevices(activeSockets, connectWhatsApp), 10000);
  console.log('⏱️ Device check polling started (every 10 seconds)');

  // Check scheduled broadcasts every 30 seconds (reduced from 10s)
  setInterval(checkScheduledBroadcasts, 30000);
  console.log('⏰ Scheduled broadcast check started (every 30 seconds)');

  // 🆕 Check and queue broadcasts every 15 seconds (NEW - lighter than direct processing)
  setInterval(checkAndQueueBroadcasts, 15000);
  console.log('📥 Broadcast queueing started (every 15 seconds)');

  // Health check ping every 60 seconds (reduced from 30s)
  setInterval(() => healthCheckPing(activeSockets), 60000);
  console.log('💓 Health check ping started (every 60 seconds)');

  // Check auto-post schedules every 30 seconds
  setInterval(() => checkAutoPostSchedules(activeSockets), 30000);
  console.log('📅 Auto-post scheduler started (every 30 seconds)');
}

// Health check endpoint (for Railway)
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-ID');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      activeConnections: activeSockets.size,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Get WhatsApp groups endpoint
  const groupsMatch = pathname.match(/^\/api\/groups\/(.+)$/);
  if (groupsMatch && req.method === 'GET') {
    const deviceId = groupsMatch[1];

    try {
      // Verify Authorization header
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized - Missing or invalid Authorization header' }));
        return;
      }

      const apiKey = authHeader.substring(7);

      // Verify device exists and API key matches
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('id, api_key, status')
        .eq('id', deviceId)
        .single();

      if (deviceError || !device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device not found' }));
        return;
      }

      if (device.api_key !== apiKey) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API key' }));
        return;
      }

      // Get socket for this device
      const sock = activeSockets.get(deviceId);

      if (!sock) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Device not connected to WhatsApp',
          groups: []
        }));
        return;
      }

      if (!sock.user) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Device socket not authenticated',
          groups: []
        }));
        return;
      }

      console.log(`📱 [API] Fetching groups for device: ${deviceId}`);

      // Fetch groups from WhatsApp
      const groups = await sock.groupFetchAllParticipating();

      // Convert to array and format
      const groupList = Object.values(groups).map(group => ({
        id: group.id,
        name: group.subject || 'Unnamed Group',
        participants: group.participants?.length || 0,
        desc: group.desc || '',
        owner: group.owner || null,
        creation: group.creation || null
      }));

      console.log(`✅ [API] Found ${groupList.length} groups for device: ${deviceId}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        groups: groupList,
        total: groupList.length
      }));
      return;

    } catch (error) {
      console.error(`❌ [API] Error fetching groups for device ${deviceId}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error.message || 'Failed to fetch groups',
        groups: []
      }));
      return;
    }
  }

  // Default route
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WhatsApp Baileys Service is running!\n');
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// Start the service
console.log('🎬 Starting WhatsApp Baileys Service...');
startService().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Keep process alive
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');

  // Close BullMQ worker and queue events
  if (broadcastWorker) {
    console.log('🛑 Closing BullMQ worker...');
    await broadcastWorker.close();
  }

  if (queueEvents) {
    console.log('🛑 Closing queue events listener...');
    await queueEvents.close();
  }

  // Disconnect all WhatsApp sockets
  for (const [deviceId, sock] of activeSockets) {
    console.log(`🔌 Disconnecting device: ${deviceId}`);
    sock?.end();
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');

  if (broadcastWorker) {
    await broadcastWorker.close();
  }

  if (queueEvents) {
    await queueEvents.close();
  }

  for (const [deviceId, sock] of activeSockets) {
    sock?.end();
  }

  process.exit(0);
});

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

// 🆕 MULTI-SERVER: Import server services
const { serverIdentifier } = require('./services/server/serverIdentifier');
const { serverAssignmentService } = require('./services/server/serverAssignmentService');
const { logger } = require('./logger');

// Store active WhatsApp sockets
const activeSockets = new Map();

// Store BullMQ worker and queue events for graceful shutdown
let broadcastWorker = null;
let queueEvents = null;
let httpServer = null;

/**
 * Validate critical environment variables on startup
 * Exits with error if critical vars are missing
 */
function validateEnvironment() {
  const errors = [];

  // Critical environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const REDIS_URL = process.env.REDIS_URL;
  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

  if (!SUPABASE_URL) {
    errors.push('❌ SUPABASE_URL is not set');
  } else if (!SUPABASE_URL.startsWith('https://')) {
    errors.push('❌ SUPABASE_URL must start with https://');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  } else if (SUPABASE_SERVICE_ROLE_KEY.length < 32) {
    errors.push('❌ SUPABASE_SERVICE_ROLE_KEY is too short (minimum 32 characters)');
  }

  if (!REDIS_URL) {
    console.warn('⚠️  WARNING: REDIS_URL is not set - Redis features will be disabled');
    console.warn('⚠️  BullMQ queue, rate limiting, and caching will not work');
  } else if (!REDIS_URL.startsWith('redis://') && !REDIS_URL.startsWith('rediss://')) {
    errors.push('❌ REDIS_URL must start with redis:// or rediss://');
  }

  if (!INTERNAL_API_KEY) {
    console.warn('⚠️  WARNING: INTERNAL_API_KEY is not set - Edge function authentication will fail');
  } else if (INTERNAL_API_KEY.length < 32) {
    console.warn('⚠️  WARNING: INTERNAL_API_KEY is too short (minimum 32 characters for security)');
  }

  if (errors.length > 0) {
    console.error('\n🚨 CRITICAL ENVIRONMENT ERRORS:\n');
    errors.forEach(error => console.error(error));
    console.error('\n💡 Please check your .env file and ensure all required variables are set');
    console.error('📖 See .env.example for reference\n');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

/**
 * Pre-flight health checks before accepting traffic
 * Verifies database and Redis connectivity
 */
async function preflightChecks() {
  console.log('🔍 Running pre-flight health checks...');
  const checks = [];

  // Check 1: Supabase connectivity
  console.log('  📊 Checking Supabase connection...');
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('id')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
      throw error;
    }
    console.log('  ✅ Supabase connection OK');
    checks.push({ name: 'Supabase', status: 'OK' });
  } catch (error) {
    console.error('  ❌ Supabase connection failed:', error.message);
    checks.push({ name: 'Supabase', status: 'FAILED', error: error.message });
  }

  // Check 2: Redis connectivity (optional)
  const redisClient = require('./redis-client');
  if (redisClient.enabled) {
    console.log('  🔴 Checking Redis connection...');
    try {
      const redisReady = await redisClient.waitForReady(10000);
      if (redisReady) {
        console.log('  ✅ Redis connection OK');
        checks.push({ name: 'Redis', status: 'OK' });
      } else {
        console.warn('  ⚠️  Redis connection timeout (non-critical)');
        checks.push({ name: 'Redis', status: 'WARNING', error: 'Connection timeout' });
      }
    } catch (error) {
      console.warn('  ⚠️  Redis check failed (non-critical):', error.message);
      checks.push({ name: 'Redis', status: 'WARNING', error: error.message });
    }
  } else {
    console.log('  ⚠️  Redis disabled - skipping check');
    checks.push({ name: 'Redis', status: 'DISABLED' });
  }

  // Evaluate results
  const criticalFailures = checks.filter(c => c.name === 'Supabase' && c.status === 'FAILED');

  if (criticalFailures.length > 0) {
    console.error('\n🚨 CRITICAL PRE-FLIGHT FAILURES:\n');
    criticalFailures.forEach(check => {
      console.error(`  ❌ ${check.name}: ${check.error}`);
    });
    console.error('\n💡 Please verify your database credentials and network connectivity');
    console.error('🔧 If using Dokploy, check that environment variables are correctly set\n');
    process.exit(1);
  }

  console.log('✅ Pre-flight checks passed - ready to accept traffic\n');
}

/**
 * Start the WhatsApp Baileys Service
 * Sets up polling intervals and HTTP server
 */
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Using hybrid architecture: Polling + BullMQ Queue');

  // 🆕 MULTI-SERVER: Initialize server identification
  try {
    logger.info('🔧 Initializing server identification...');
    const serverId = serverIdentifier.initialize();
    logger.info('✅ Server identified', {
      serverId: serverId,
      type: serverIdentifier.getServerType()
    });

    // Initialize server assignment service
    logger.info('🔧 Initializing server assignment service...');
    await serverAssignmentService.initialize();
    logger.info('✅ Server assignment service ready');

  } catch (error) {
    logger.error('❌ Failed to initialize multi-server support', {
      error: error.message
    });
    logger.warn('⚠️ Continuing without multi-server features');
  }

  // Start HTTP server for CRM message sending
  const port = process.env.PORT || 3000;

  httpServer = createHTTPServer(activeSockets);

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`);
      console.log('🔄 Trying alternative port...');

      // Create NEW server instance for alternative port
      httpServer = createHTTPServer(activeSockets);
      httpServer.listen(0, '0.0.0.0', () => {
        const address = httpServer.address();
        console.log(`🌐 HTTP Server listening on port ${address.port}`);
        console.log(`📡 Endpoints: /health, /send-message, /api/groups/:id`);
      }).on('error', (retryErr) => {
        console.error('❌ Failed to start HTTP server on any port:', retryErr);
        process.exit(1);
      });
    } else {
      console.error('❌ HTTP Server error:', err);
      process.exit(1);
    }
  });

  // Start server on preferred port
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`🌐 HTTP Server listening on port ${port}`);
    console.log(`📡 Endpoints: /health, /send-message, /api/groups/:id`);
  });

  // 🆕 Start BullMQ Worker for broadcast processing
  console.log('🔧 Starting BullMQ broadcast worker...');

  // Wait for Redis to be ready before starting BullMQ
  const redisClient = require('./redis-client');
  const redisReady = await redisClient.waitForReady(15000); // Wait up to 15 seconds

  if (redisReady) {
    try {
      broadcastWorker = createBroadcastWorker(activeSockets);
      queueEvents = createQueueEvents();

      if (broadcastWorker) {
        console.log('✅ BullMQ worker started - broadcasts will be processed via queue');
      } else {
        console.warn('⚠️  BullMQ worker not started - check REDIS_URL configuration');
        console.warn('⚠️  Falling back to polling mode for broadcast processing');
      }
    } catch (error) {
      console.error('❌ Failed to start BullMQ worker:', error.message);
      console.warn('⚠️  Falling back to polling mode for broadcast processing');
    }
  } else {
    console.warn('⚠️  Redis not ready - BullMQ worker will not start');
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

  // 🆕 MULTI-SERVER: Update server health every 60 seconds
  if (serverAssignmentService.serverId) {
    setInterval(() => {
      serverAssignmentService.updateServerHealth().catch(error => {
        logger.error('❌ Failed to update server health', {
          error: error.message
        });
      });
    }, 60000);
    logger.info('💓 Server health monitoring started (every 60 seconds)');
  }
}

// Validate environment before starting
console.log('🔍 Validating environment variables...');
validateEnvironment();

// Run pre-flight checks
preflightChecks().then(() => {
  // Start the service
  console.log('🎬 Starting WhatsApp Baileys Service...');
  startService().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}).catch((error) => {
  console.error('❌ Pre-flight check failed:', error);
  process.exit(1);
});

/**
 * Graceful shutdown handler
 * Ensures all connections are closed properly before exit
 */
async function gracefulShutdown(signal) {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  if (httpServer) {
    console.log('🛑 Stopping HTTP server...');
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          console.error('❌ Error closing HTTP server:', err);
        } else {
          console.log('✅ HTTP server closed');
        }
        resolve();
      });
    });
  }

  // 🆕 MULTI-SERVER: Mark server as inactive
  if (serverAssignmentService.serverId) {
    console.log('🛑 Marking server as inactive...');
    try {
      await serverAssignmentService.shutdown();
      console.log('✅ Server marked as inactive');
    } catch (error) {
      console.error('❌ Error marking server inactive:', error.message);
    }
  }

  // Close BullMQ worker and queue events
  if (broadcastWorker) {
    console.log('🛑 Closing BullMQ worker...');
    try {
      await broadcastWorker.close();
      console.log('✅ BullMQ worker closed');
    } catch (error) {
      console.error('❌ Error closing BullMQ worker:', error.message);
    }
  }

  if (queueEvents) {
    console.log('🛑 Closing queue events listener...');
    try {
      await queueEvents.close();
      console.log('✅ Queue events listener closed');
    } catch (error) {
      console.error('❌ Error closing queue events:', error.message);
    }
  }

  // Disconnect all WhatsApp sockets
  console.log(`🔌 Disconnecting ${activeSockets.size} WhatsApp devices...`);
  for (const [deviceId, sock] of activeSockets) {
    try {
      console.log(`🔌 Disconnecting device: ${deviceId}`);
      sock?.end();
    } catch (error) {
      console.error(`❌ Error disconnecting device ${deviceId}:`, error.message);
    }
  }
  activeSockets.clear();

  // Close Redis connection
  const redisClient = require('./redis-client');
  if (redisClient.enabled) {
    console.log('🛑 Closing Redis connection...');
    try {
      await redisClient.disconnect();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis:', error.message);
    }
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
}

// Keep process alive
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

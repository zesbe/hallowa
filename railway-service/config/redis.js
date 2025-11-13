/**
 * Redis ioredis Connection for BullMQ
 * Uses TCP native protocol for high-performance queue operations
 */

const Redis = require('ioredis');

// Parse Upstash Redis URL
const REDIS_URL = process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  console.warn('⚠️  UPSTASH_REDIS_URL not configured - BullMQ features will be disabled');
  console.warn('⚠️  Please add UPSTASH_REDIS_URL to your environment variables');
  console.warn('⚠️  Get it from Upstash Dashboard > Your Redis > Details > Redis URL (TCP)');
}

/**
 * Create ioredis connection for BullMQ
 * Configured for Upstash with TLS support
 */
function createIORedisConnection() {
  if (!REDIS_URL) {
    return null;
  }

  try {
    const connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        // Exponential backoff with max delay of 10s
        const delay = Math.min(times * 100, 10000);
        console.log(`🔄 Retrying Redis connection in ${delay}ms...`);
        return delay;
      },
      reconnectOnError: (err) => {
        console.error('❌ Redis error:', err.message);
        // Reconnect on common errors
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      // TLS configuration for Upstash
      tls: REDIS_URL.startsWith('rediss://') ? {
        rejectUnauthorized: true,
      } : undefined,
    });

    // Event listeners
    connection.on('connect', () => {
      console.log('✅ ioredis connected to Upstash (TCP native protocol)');
    });

    connection.on('ready', () => {
      console.log('✅ ioredis ready for operations');
    });

    connection.on('error', (err) => {
      console.error('❌ ioredis connection error:', err.message);
    });

    connection.on('close', () => {
      console.log('⚠️  ioredis connection closed');
    });

    connection.on('reconnecting', () => {
      console.log('🔄 ioredis reconnecting...');
    });

    return connection;
  } catch (error) {
    console.error('❌ Failed to create ioredis connection:', error);
    return null;
  }
}

// Create singleton connection
const ioredisConnection = createIORedisConnection();

module.exports = {
  ioredisConnection,
  createIORedisConnection,
};

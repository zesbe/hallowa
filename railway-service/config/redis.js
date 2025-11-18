/**
 * Redis ioredis Connection for BullMQ
 * Uses TCP native protocol for high-performance queue operations
 * Supports local Redis on Railway/VPS/Dokploy
 */

const Redis = require('ioredis');

// Parse Local Redis URL
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('⚠️  REDIS_URL not configured - BullMQ features will be disabled');
  console.warn('⚠️  Please add REDIS_URL to your environment variables');
  console.warn('⚠️  Example: redis://default:password@localhost:6379');
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
    });

    // Event listeners
    connection.on('connect', () => {
      console.log('✅ ioredis connected to local Redis (TCP native protocol)');
    });

    connection.on('ready', () => {
      console.log('✅ ioredis ready for BullMQ queue operations');
    });

    connection.on('error', (err) => {
      // Security: Don't log connection strings or sensitive info
      console.error('❌ ioredis connection error:', err.message.replace(/redis[s]?:\/\/[^@]*@/, 'redis://***:***@'));
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

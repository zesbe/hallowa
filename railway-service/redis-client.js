/**
 * Redis Client for WhatsApp Session Management (Local Redis)
 * Handles session data, QR codes, pairing codes, rate limiting, and cache
 * Uses ioredis (TCP native) for local Redis on Railway/VPS/Dokploy
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

class RedisClient {
  constructor() {
    this.isReady = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 10;

    if (!REDIS_URL) {
      console.warn('⚠️  REDIS_URL not configured - Redis features will be disabled');
      console.warn('⚠️  Please add REDIS_URL to your environment variables');
      console.warn('⚠️  Example: redis://default:password@localhost:6379');
      this.enabled = false;
      this.client = null;
      return;
    }

    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 10000, // 10 seconds
        retryStrategy: (times) => {
          this.connectionAttempts = times;

          if (times > this.maxConnectionAttempts) {
            console.error(`❌ Redis connection failed after ${this.maxConnectionAttempts} attempts`);
            console.error('⚠️  Continuing without Redis - some features will be disabled');
            return null; // Stop retrying
          }

          const delay = Math.min(times * 500, 5000); // Max 5 seconds
          console.log(`🔄 Redis retry attempt ${times}/${this.maxConnectionAttempts} in ${delay}ms...`);
          return delay;
        },
        reconnectOnError: (err) => {
          console.error('❌ Redis error:', err.message);
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
          return targetErrors.some(error => err.message.includes(error));
        },
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected (local TCP)');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready for operations');
        this.isReady = true;
        this.connectionAttempts = 0; // Reset counter on successful connection
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message.replace(/redis[s]?:\/\/[^@]*@/, 'redis://***:***@'));
        this.isReady = false;
      });

      this.client.on('close', () => {
        console.log('⚠️  Redis connection closed');
        this.isReady = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
        this.isReady = false;
      });

      this.client.on('end', () => {
        console.log('⚠️  Redis connection ended');
        this.isReady = false;
      });

      this.enabled = true;
    } catch (error) {
      console.error('❌ Failed to create Redis connection:', error);
      this.enabled = false;
      this.client = null;
    }
  }

  /**
   * Wait for Redis to be ready
   * @param {number} timeout - Max time to wait in milliseconds (default: 30000 = 30s)
   * @returns {Promise<boolean>} True if ready, false if timeout
   */
  async waitForReady(timeout = 30000) {
    if (!this.enabled || !this.client) {
      console.warn('⚠️  Redis not enabled, skipping wait');
      return false;
    }

    if (this.isReady) {
      console.log('✅ Redis already ready');
      return true;
    }

    console.log(`⏳ Waiting for Redis connection (timeout: ${timeout}ms)...`);
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        if (this.isReady) {
          clearInterval(checkInterval);
          console.log(`✅ Redis ready after ${elapsed}ms`);
          resolve(true);
        } else if (elapsed >= timeout) {
          clearInterval(checkInterval);
          console.error(`❌ Redis connection timeout after ${timeout}ms`);
          resolve(false);
        }
      }, 100); // Check every 100ms
    });
  }

  // QR Code Management
  async setQRCode(deviceId, qrCode, ttl = 600) {
    if (!this.enabled || !this.client) {
      return false;
    }
    try {
      const key = `qr:${deviceId}`;
      const result = await this.client.set(key, qrCode, 'EX', ttl);
      console.log(`✅ Redis SET qr:${deviceId} (TTL: ${ttl}s)`);
      return result === 'OK';
    } catch (error) {
      console.error('❌ Redis setQRCode error:', error);
      return false;
    }
  }

  async getQRCode(deviceId) {
    if (!this.enabled || !this.client) {
      return null;
    }
    try {
      const key = `qr:${deviceId}`;
      return await this.client.get(key);
    } catch (error) {
      console.error('❌ Redis getQRCode error:', error);
      return null;
    }
  }

  async deleteQRCode(deviceId) {
    if (!this.enabled || !this.client) {
      return;
    }
    try {
      const key = `qr:${deviceId}`;
      await this.client.del(key);
      console.log(`🗑️  Deleted QR code for device: ${deviceId}`);
    } catch (error) {
      console.error('❌ Redis deleteQRCode error:', error);
    }
  }

  // Pairing Code Management
  async setPairingCode(deviceId, pairingCode, ttl = 600) {
    if (!this.enabled || !this.client) {
      return false;
    }
    try {
      const key = `pairing:${deviceId}`;
      const result = await this.client.set(key, pairingCode, 'EX', ttl);
      console.log(`✅ Redis SET pairing:${deviceId} (TTL: ${ttl}s)`);
      return result === 'OK';
    } catch (error) {
      console.error('❌ Redis setPairingCode error:', error);
      return false;
    }
  }

  async getPairingCode(deviceId) {
    if (!this.enabled || !this.client) {
      return null;
    }
    try {
      const key = `pairing:${deviceId}`;
      return await this.client.get(key);
    } catch (error) {
      console.error('❌ Redis getPairingCode error:', error);
      return null;
    }
  }

  async deletePairingCode(deviceId) {
    if (!this.enabled || !this.client) {
      return;
    }
    try {
      const key = `pairing:${deviceId}`;
      await this.client.del(key);
      console.log(`🗑️  Deleted pairing code for device: ${deviceId}`);
    } catch (error) {
      console.error('❌ Redis deletePairingCode error:', error);
    }
  }

  // Cleanup all device data
  async cleanupDevice(deviceId) {
    if (!this.enabled || !this.client) {
      return;
    }
    await Promise.all([
      this.deleteQRCode(deviceId),
      this.deletePairingCode(deviceId),
    ]);
  }

  // 🔒 Distributed Rate Limiting
  /**
   * Check and increment rate limit counter
   * @param {string} identifier - API key or IP address
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Promise<boolean>} True if request is allowed
   */
  async checkRateLimit(identifier, maxRequests = 100, windowSeconds = 60) {
    if (!this.enabled || !this.client) {
      console.warn('⚠️  Redis disabled - rate limiting skipped');
      return true;
    }

    try {
      const key = `ratelimit:${identifier}`;
      
      // Use MULTI/EXEC for atomic operations
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      const count = results[0][1]; // First command result (INCR)
      
      if (count > maxRequests) {
        const ttl = results[2][1]; // TTL result
        console.warn(`⚠️  Rate limit exceeded for ${identifier}: ${count}/${maxRequests} (resets in ${ttl}s)`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Redis checkRateLimit error:', error);
      return true; // Fail open
    }
  }

  async getRateLimitCount(identifier) {
    if (!this.enabled || !this.client) {
      return 0;
    }
    try {
      const key = `ratelimit:${identifier}`;
      const count = await this.client.get(key);
      return parseInt(count || '0', 10);
    } catch (error) {
      console.error('❌ Redis getRateLimitCount error:', error);
      return 0;
    }
  }

  async resetRateLimit(identifier) {
    if (!this.enabled || !this.client) {
      return;
    }
    try {
      const key = `ratelimit:${identifier}`;
      await this.client.del(key);
      console.log(`🗑️  Reset rate limit for: ${identifier}`);
    } catch (error) {
      console.error('❌ Redis resetRateLimit error:', error);
    }
  }

  // 📦 Cache Management
  /**
   * Set cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 min)
   */
  async cacheSet(key, value, ttl = 300) {
    if (!this.enabled || !this.client) {
      return false;
    }
    try {
      const cacheKey = `cache:${key}`;
      const serialized = JSON.stringify(value);
      const result = await this.client.set(cacheKey, serialized, 'EX', ttl);
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s, size: ${serialized.length} bytes)`);
      return result === 'OK';
    } catch (error) {
      console.error('❌ Redis cacheSet error:', error);
      return false;
    }
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Parsed value or null if not found/expired
   */
  async cacheGet(key) {
    if (!this.enabled || !this.client) {
      return null;
    }
    try {
      const cacheKey = `cache:${key}`;
      const cached = await this.client.get(cacheKey);
      
      if (!cached) {
        console.log(`❌ Cache MISS: ${key}`);
        return null;
      }

      console.log(`✅ Cache HIT: ${key}`);
      return JSON.parse(cached);
    } catch (error) {
      console.error('❌ Redis cacheGet error:', error);
      return null;
    }
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   */
  async cacheDelete(key) {
    if (!this.enabled || !this.client) {
      return;
    }
    try {
      const cacheKey = `cache:${key}`;
      await this.client.del(cacheKey);
      console.log(`🗑️  Cache DELETE: ${key}`);
    } catch (error) {
      console.error('❌ Redis cacheDelete error:', error);
    }
  }

  /**
   * Check if cache key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async cacheExists(key) {
    if (!this.enabled || !this.client) {
      return false;
    }
    try {
      const cacheKey = `cache:${key}`;
      const exists = await this.client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error('❌ Redis cacheExists error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries matching pattern
   * @param {string} pattern - Pattern to match (e.g., "user:*")
   * ⚠️  Use with caution in production - KEYS command can be slow
   */
  async cacheClearPattern(pattern) {
    if (!this.enabled || !this.client) {
      return 0;
    }
    try {
      const cachePattern = `cache:${pattern}`;
      const keys = await this.client.keys(cachePattern);
      
      if (keys.length === 0) {
        console.log(`ℹ️  No cache keys found matching: ${pattern}`);
        return 0;
      }

      await this.client.del(...keys);
      console.log(`🗑️  Cleared ${keys.length} cache entries matching: ${pattern}`);
      return keys.length;
    } catch (error) {
      console.error('❌ Redis cacheClearPattern error:', error);
      return 0;
    }
  }

  /**
   * Get Redis connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.client ? this.client.status === 'ready' : false,
      url: REDIS_URL ? REDIS_URL.replace(/redis[s]?:\/\/[^@]*@/, 'redis://***:***@') : 'not configured',
    };
  }

  /**
   * Close Redis connection gracefully
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      console.log('👋 Redis connection closed');
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, closing Redis connection...');
  await redisClient.disconnect();
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, closing Redis connection...');
  await redisClient.disconnect();
});

module.exports = redisClient;

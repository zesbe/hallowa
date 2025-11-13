/**
 * Redis Upstash Client for WhatsApp Session Management
 * Handles session data, QR codes, and pairing codes
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

class RedisClient {
  constructor() {
    if (!REDIS_URL || !REDIS_TOKEN) {
      console.warn('⚠️ Redis credentials not configured - Redis features will be disabled');
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.baseUrl = REDIS_URL;
    this.token = REDIS_TOKEN;
  }

  async execute(command) {
    if (!this.enabled) {
      return null;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  // QR Code Management (Keep - temporary data)
  async setQRCode(deviceId, qrCode, ttl = 600) {
    if (!this.enabled) {
      return false;
    }
    try {
      // TTL 10 minutes for QR codes (extended for better stability)
      const key = `qr:${deviceId}`;
      const result = await this.execute(['SET', key, qrCode, 'EX', ttl]);
      console.log(`Redis SET result for qr:${deviceId}:`, result);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setQRCode error:', error);
      return false;
    }
  }

  async getQRCode(deviceId) {
    if (!this.enabled) {
      return null;
    }
    const key = `qr:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deleteQRCode(deviceId) {
    if (!this.enabled) {
      return;
    }
    const key = `qr:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Pairing Code Management (Keep - temporary data)
  async setPairingCode(deviceId, pairingCode, ttl = 600) {
    if (!this.enabled) {
      return false;
    }
    try {
      // TTL 10 minutes for pairing codes (extended for better stability)
      const key = `pairing:${deviceId}`;
      const result = await this.execute(['SET', key, pairingCode, 'EX', ttl]);
      console.log(`Redis SET result for pairing:${deviceId}:`, result);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setPairingCode error:', error);
      return false;
    }
  }

  async getPairingCode(deviceId) {
    if (!this.enabled) {
      return null;
    }
    const key = `pairing:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deletePairingCode(deviceId) {
    if (!this.enabled) {
      return;
    }
    const key = `pairing:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Cleanup all device data (only temporary codes)
  async cleanupDevice(deviceId) {
    if (!this.enabled) {
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
    if (!this.enabled) {
      // Fallback to no rate limiting if Redis disabled
      console.warn('Redis disabled - rate limiting skipped');
      return true;
    }

    try {
      const key = `ratelimit:${identifier}`;

      // Use Redis INCR + EXPIRE pattern for atomic rate limiting
      const count = await this.execute(['INCR', key]);

      if (count === 1) {
        // First request in window - set expiration
        await this.execute(['EXPIRE', key, windowSeconds]);
      }

      if (count > maxRequests) {
        console.log(`⚠️  Rate limit exceeded for ${identifier}: ${count}/${maxRequests}`);
        return false; // Rate limit exceeded
      }

      return true; // Request allowed
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // On error, allow the request (fail open)
      return true;
    }
  }

  /**
   * Get current rate limit count
   * @param {string} identifier - API key or IP address
   * @returns {Promise<number>} Current request count
   */
  async getRateLimitCount(identifier) {
    if (!this.enabled) {
      return 0;
    }

    try {
      const key = `ratelimit:${identifier}`;
      const count = await this.execute(['GET', key]);
      return parseInt(count) || 0;
    } catch (error) {
      console.error('Redis get rate limit error:', error);
      return 0;
    }
  }

  /**
   * Reset rate limit for identifier
   * @param {string} identifier - API key or IP address
   */
  async resetRateLimit(identifier) {
    if (!this.enabled) {
      return;
    }

    try {
      const key = `ratelimit:${identifier}`;
      await this.execute(['DEL', key]);
      console.log(`Rate limit reset for ${identifier}`);
    } catch (error) {
      console.error('Redis reset rate limit error:', error);
    }
  }

  // 🗄️ Cache Management
  /**
   * Set cache value with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (default: 1 hour)
   * @returns {Promise<boolean>} Success status
   */
  async cacheSet(key, value, ttl = 3600) {
    if (!this.enabled) {
      return false;
    }

    try {
      const cacheKey = `cache:${key}`;
      const serialized = JSON.stringify(value);
      const result = await this.execute(['SET', cacheKey, serialized, 'EX', ttl]);
      return result === 'OK';
    } catch (error) {
      console.error('Redis cacheSet error:', error);
      return false;
    }
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found
   */
  async cacheGet(key) {
    if (!this.enabled) {
      return null;
    }

    try {
      const cacheKey = `cache:${key}`;
      const cached = await this.execute(['GET', cacheKey]);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      console.error('Redis cacheGet error:', error);
      return null;
    }
  }

  /**
   * Delete cache value
   * @param {string} key - Cache key
   */
  async cacheDelete(key) {
    if (!this.enabled) {
      return;
    }

    try {
      const cacheKey = `cache:${key}`;
      await this.execute(['DEL', cacheKey]);
    } catch (error) {
      console.error('Redis cacheDelete error:', error);
    }
  }

  /**
   * Check if cache key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async cacheExists(key) {
    if (!this.enabled) {
      return false;
    }

    try {
      const cacheKey = `cache:${key}`;
      const exists = await this.execute(['EXISTS', cacheKey]);
      return exists === 1;
    } catch (error) {
      console.error('Redis cacheExists error:', error);
      return false;
    }
  }

  /**
   * Clear all cache with pattern
   * @param {string} pattern - Key pattern (e.g., "contact:*")
   */
  async cacheClearPattern(pattern) {
    if (!this.enabled) {
      return;
    }

    try {
      const cachePattern = `cache:${pattern}`;
      // Note: KEYS command should be used carefully in production
      // For large datasets, consider using SCAN instead
      const keys = await this.execute(['KEYS', cachePattern]);

      if (keys && keys.length > 0) {
        await this.execute(['DEL', ...keys]);
        console.log(`🗑️  Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error('Redis cacheClearPattern error:', error);
    }
  }
}

module.exports = new RedisClient();

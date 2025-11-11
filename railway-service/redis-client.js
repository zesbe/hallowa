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
}

module.exports = new RedisClient();

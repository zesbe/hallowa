/**
 * User-specific Rate Limiting Service
 * Implements rate limiting per user for broadcasts and API calls
 * Prevents abuse and ensures fair usage across all users
 */

const redisClient = require('../../redis-client');
const { supabase } = require('../../config/supabase');

/**
 * Rate limit configurations per feature
 *
 * ⚠️ IMPORTANT: These are DEFAULT values for STANDARD users.
 * Adjust these based on your business needs and WhatsApp limits.
 *
 * WhatsApp Official Limits (2025):
 * - ~1000 messages per day per device (unofficial, varies)
 * - Rate: ~20-30 messages per minute recommended
 *
 * 💡 TIPS:
 * - Set limits BELOW WhatsApp's to prevent bans
 * - Premium users get 3x these limits automatically
 * - Adjust based on monitoring data
 */
const RATE_LIMITS = {
  // Broadcasts per user (campaigns)
  BROADCAST: {
    MAX_PER_HOUR: 50,        // 50 broadcast campaigns per hour (reasonable for business)
    MAX_PER_DAY: 200,        // 200 campaigns per day (generous limit)
    WINDOW_HOUR: 3600,       // 1 hour in seconds
    WINDOW_DAY: 86400,       // 24 hours in seconds
  },

  // Individual messages per user
  // This is for ACTUAL messages sent, not campaigns
  MESSAGE: {
    MAX_PER_MINUTE: 100,     // 100 messages per minute (business-friendly)
    MAX_PER_HOUR: 3000,      // 3000 messages per hour (enough for most businesses)
    MAX_PER_DAY: 10000,      // 10k messages per day (per user, reasonable)
    WINDOW_MINUTE: 60,
    WINDOW_HOUR: 3600,
    WINDOW_DAY: 86400,
  },

  // API calls per user (endpoint requests)
  API_CALL: {
    MAX_PER_MINUTE: 120,     // 120 API calls per minute (2 per second)
    MAX_PER_HOUR: 5000,      // 5000 API calls per hour
    WINDOW_MINUTE: 60,
    WINDOW_HOUR: 3600,
  },

  // Device connections per user (reconnection attempts)
  DEVICE_CONNECTION: {
    MAX_PER_HOUR: 50,        // 50 connection attempts per hour (prevent spam reconnect)
    WINDOW: 3600,
  },
};

/**
 * Rate limit key generators
 */
const RateLimitKey = {
  broadcast: (userId, window) => `ratelimit:user:${userId}:broadcast:${window}`,
  message: (userId, window) => `ratelimit:user:${userId}:message:${window}`,
  apiCall: (userId, window) => `ratelimit:user:${userId}:api:${window}`,
  deviceConnection: (userId) => `ratelimit:user:${userId}:device:connection`,
};

class UserRateLimitService {
  /**
   * Check if user is within broadcast rate limit
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { allowed: boolean, remaining: number, resetAt: Date }
   */
  async checkBroadcastLimit(userId) {
    const hourKey = RateLimitKey.broadcast(userId, 'hour');
    const dayKey = RateLimitKey.broadcast(userId, 'day');

    // Check hourly limit
    const hourlyAllowed = await redisClient.checkRateLimit(
      hourKey,
      RATE_LIMITS.BROADCAST.MAX_PER_HOUR,
      RATE_LIMITS.BROADCAST.WINDOW_HOUR
    );

    // Check daily limit
    const dailyAllowed = await redisClient.checkRateLimit(
      dayKey,
      RATE_LIMITS.BROADCAST.MAX_PER_DAY,
      RATE_LIMITS.BROADCAST.WINDOW_DAY
    );

    const hourCount = await redisClient.getRateLimitCount(hourKey);
    const dayCount = await redisClient.getRateLimitCount(dayKey);

    const allowed = hourlyAllowed && dailyAllowed;

    return {
      allowed,
      hourly: {
        current: hourCount,
        max: RATE_LIMITS.BROADCAST.MAX_PER_HOUR,
        remaining: Math.max(0, RATE_LIMITS.BROADCAST.MAX_PER_HOUR - hourCount),
      },
      daily: {
        current: dayCount,
        max: RATE_LIMITS.BROADCAST.MAX_PER_DAY,
        remaining: Math.max(0, RATE_LIMITS.BROADCAST.MAX_PER_DAY - dayCount),
      },
      message: allowed ? 'Rate limit OK' : 'Rate limit exceeded - please wait before sending more broadcasts',
    };
  }

  /**
   * Check if user is within message rate limit
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async checkMessageLimit(userId) {
    const minuteKey = RateLimitKey.message(userId, 'minute');
    const hourKey = RateLimitKey.message(userId, 'hour');
    const dayKey = RateLimitKey.message(userId, 'day');

    const minuteAllowed = await redisClient.checkRateLimit(
      minuteKey,
      RATE_LIMITS.MESSAGE.MAX_PER_MINUTE,
      RATE_LIMITS.MESSAGE.WINDOW_MINUTE
    );

    const hourAllowed = await redisClient.checkRateLimit(
      hourKey,
      RATE_LIMITS.MESSAGE.MAX_PER_HOUR,
      RATE_LIMITS.MESSAGE.WINDOW_HOUR
    );

    const dayAllowed = await redisClient.checkRateLimit(
      dayKey,
      RATE_LIMITS.MESSAGE.MAX_PER_DAY,
      RATE_LIMITS.MESSAGE.WINDOW_DAY
    );

    const minuteCount = await redisClient.getRateLimitCount(minuteKey);
    const hourCount = await redisClient.getRateLimitCount(hourKey);
    const dayCount = await redisClient.getRateLimitCount(dayKey);

    const allowed = minuteAllowed && hourAllowed && dayAllowed;

    return {
      allowed,
      perMinute: {
        current: minuteCount,
        max: RATE_LIMITS.MESSAGE.MAX_PER_MINUTE,
        remaining: Math.max(0, RATE_LIMITS.MESSAGE.MAX_PER_MINUTE - minuteCount),
      },
      perHour: {
        current: hourCount,
        max: RATE_LIMITS.MESSAGE.MAX_PER_HOUR,
        remaining: Math.max(0, RATE_LIMITS.MESSAGE.MAX_PER_HOUR - hourCount),
      },
      perDay: {
        current: dayCount,
        max: RATE_LIMITS.MESSAGE.MAX_PER_DAY,
        remaining: Math.max(0, RATE_LIMITS.MESSAGE.MAX_PER_DAY - dayCount),
      },
      message: allowed ? 'Rate limit OK' : 'Rate limit exceeded - please slow down',
    };
  }

  /**
   * Check if user is within API call rate limit
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async checkApiLimit(userId) {
    const minuteKey = RateLimitKey.apiCall(userId, 'minute');
    const hourKey = RateLimitKey.apiCall(userId, 'hour');

    const minuteAllowed = await redisClient.checkRateLimit(
      minuteKey,
      RATE_LIMITS.API_CALL.MAX_PER_MINUTE,
      RATE_LIMITS.API_CALL.WINDOW_MINUTE
    );

    const hourAllowed = await redisClient.checkRateLimit(
      hourKey,
      RATE_LIMITS.API_CALL.MAX_PER_HOUR,
      RATE_LIMITS.API_CALL.WINDOW_HOUR
    );

    const minuteCount = await redisClient.getRateLimitCount(minuteKey);
    const hourCount = await redisClient.getRateLimitCount(hourKey);

    const allowed = minuteAllowed && hourAllowed;

    return {
      allowed,
      perMinute: {
        current: minuteCount,
        max: RATE_LIMITS.API_CALL.MAX_PER_MINUTE,
        remaining: Math.max(0, RATE_LIMITS.API_CALL.MAX_PER_MINUTE - minuteCount),
      },
      perHour: {
        current: hourCount,
        max: RATE_LIMITS.API_CALL.MAX_PER_HOUR,
        remaining: Math.max(0, RATE_LIMITS.API_CALL.MAX_PER_HOUR - hourCount),
      },
      message: allowed ? 'Rate limit OK' : 'API rate limit exceeded',
    };
  }

  /**
   * Check device connection rate limit
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if allowed
   */
  async checkDeviceConnectionLimit(userId) {
    const key = RateLimitKey.deviceConnection(userId);

    return await redisClient.checkRateLimit(
      key,
      RATE_LIMITS.DEVICE_CONNECTION.MAX_PER_HOUR,
      RATE_LIMITS.DEVICE_CONNECTION.WINDOW
    );
  }

  /**
   * Get comprehensive rate limit status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete rate limit status
   */
  async getUserRateLimitStatus(userId) {
    const [broadcast, message, api] = await Promise.all([
      this.checkBroadcastLimit(userId),
      this.checkMessageLimit(userId),
      this.checkApiLimit(userId),
    ]);

    return {
      userId,
      timestamp: new Date().toISOString(),
      limits: {
        broadcast,
        message,
        api,
      },
      overallStatus: broadcast.allowed && message.allowed && api.allowed ? 'OK' : 'LIMITED',
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   * @param {string} userId - User ID
   */
  async resetUserRateLimits(userId) {
    const keys = [
      RateLimitKey.broadcast(userId, 'hour'),
      RateLimitKey.broadcast(userId, 'day'),
      RateLimitKey.message(userId, 'minute'),
      RateLimitKey.message(userId, 'hour'),
      RateLimitKey.apiCall(userId, 'minute'),
      RateLimitKey.apiCall(userId, 'hour'),
      RateLimitKey.deviceConnection(userId),
    ];

    for (const key of keys) {
      await redisClient.resetRateLimit(key);
    }

    console.log(`✅ Reset all rate limits for user ${userId}`);
  }

  /**
   * Log rate limit violation for monitoring
   * @param {string} userId - User ID
   * @param {string} limitType - Type of limit violated
   * @param {Object} details - Additional details
   */
  async logRateLimitViolation(userId, limitType, details = {}) {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'rate_limit_exceeded',
        entity_type: limitType,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`⚠️  Rate limit violation logged for user ${userId}: ${limitType}`);
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Check if user has premium plan (bypasses some limits)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if premium user
   */
  async isPremiumUser(userId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('plans(name, features)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!data || !data.plans) {
      return false;
    }

    // Check if plan is premium/enterprise
    const planName = data.plans.name?.toLowerCase() || '';
    return planName.includes('premium') || planName.includes('enterprise') || planName.includes('pro');
  }

  /**
   * Get adjusted rate limits based on user plan
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Adjusted rate limits
   */
  async getAdjustedLimits(userId) {
    const isPremium = await this.isPremiumUser(userId);

    if (isPremium) {
      // Premium users get 3x limits
      return {
        BROADCAST: {
          MAX_PER_HOUR: RATE_LIMITS.BROADCAST.MAX_PER_HOUR * 3,
          MAX_PER_DAY: RATE_LIMITS.BROADCAST.MAX_PER_DAY * 3,
        },
        MESSAGE: {
          MAX_PER_MINUTE: RATE_LIMITS.MESSAGE.MAX_PER_MINUTE * 3,
          MAX_PER_HOUR: RATE_LIMITS.MESSAGE.MAX_PER_HOUR * 3,
        },
        API_CALL: {
          MAX_PER_MINUTE: RATE_LIMITS.API_CALL.MAX_PER_MINUTE * 3,
          MAX_PER_HOUR: RATE_LIMITS.API_CALL.MAX_PER_HOUR * 3,
        },
        tier: 'premium',
      };
    }

    return {
      ...RATE_LIMITS,
      tier: 'standard',
    };
  }
}

module.exports = new UserRateLimitService();

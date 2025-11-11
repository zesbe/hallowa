/**
 * Authentication utilities for Railway Service
 * Provides API key validation and security functions
 */

const crypto = require('crypto');

/**
 * Hash an API key using SHA-256
 * @param {string} apiKey - The API key to hash
 * @returns {string} Hashed API key
 */
function hashApiKey(apiKey) {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Simple in-memory rate limiter
 * In production, use Redis for distributed rate limiting
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  /**
   * Check if request should be rate limited
   * @param {string} identifier - IP or API key
   * @param {number} maxRequests - Max requests per window
   * @param {number} windowMs - Time window in milliseconds
   * @returns {boolean} True if request is allowed
   */
  checkLimit(identifier, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Remove old requests outside window
    const recentRequests = userRequests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }

    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup(windowMs);
    }

    return true;
  }

  /**
   * Clean up old entries
   * @param {number} windowMs - Time window in milliseconds
   */
  cleanup(windowMs) {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter(time => now - time < windowMs);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
}

/**
 * Validate phone number format (E.164)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // E.164 format: +[country][number], 1-15 digits
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate and sanitize message content
 * @param {string} message - Message to validate
 * @returns {string} Sanitized message
 * @throws {Error} If message is invalid
 */
function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message content');
  }

  // Limit message length (WhatsApp limit is ~65,536 chars)
  if (message.length > 10000) {
    throw new Error('Message too long (max 10000 characters)');
  }

  return message.trim();
}

/**
 * Validate media URL for SSRF protection
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
function validateMediaUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Block internal/private IPs (SSRF protection)
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);

    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);

      // Private IP ranges
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        a === 169 && b === 254 // 169.254.0.0/16 (link-local)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

module.exports = {
  hashApiKey,
  constantTimeCompare,
  RateLimiter,
  validatePhoneNumber,
  validateMessage,
  validateMediaUrl
};

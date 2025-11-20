/**
 * 🔒 ENTERPRISE-GRADE SERVER IDENTIFICATION SERVICE
 *
 * Purpose: Securely identify and validate server instances in multi-server deployment
 *
 * Security Features:
 * - Validates server ID format and length
 * - Prevents injection attacks via sanitization
 * - Supports multiple identification methods with fallback
 * - Immutable server ID after initialization
 *
 * @module ServerIdentifier
 * @author HalloWa.id
 * @version 2.0.0
 */

const { logger } = require('../../logger');
const crypto = require('crypto');

// 🔒 SECURITY: Server ID constraints
const SERVER_ID_MAX_LENGTH = 128;
const SERVER_ID_MIN_LENGTH = 3;
const VALID_SERVER_ID_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;

/**
 * ServerIdentifier class - Singleton pattern for consistent server identification
 */
class ServerIdentifier {
  constructor() {
    if (ServerIdentifier.instance) {
      return ServerIdentifier.instance;
    }

    this._serverId = null;
    this._serverType = null;
    this._isInitialized = false;

    ServerIdentifier.instance = this;
  }

  /**
   * 🔒 Validate server ID format and security
   * @param {string} serverId - Server ID to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails with detailed reason
   */
  validateServerId(serverId) {
    // Check null/undefined
    if (!serverId) {
      throw new Error('Server ID cannot be null or undefined');
    }

    // Check type
    if (typeof serverId !== 'string') {
      throw new Error('Server ID must be a string');
    }

    // Trim whitespace
    serverId = serverId.trim();

    // Check length
    if (serverId.length < SERVER_ID_MIN_LENGTH) {
      throw new Error(`Server ID too short (min: ${SERVER_ID_MIN_LENGTH} chars)`);
    }

    if (serverId.length > SERVER_ID_MAX_LENGTH) {
      throw new Error(`Server ID too long (max: ${SERVER_ID_MAX_LENGTH} chars)`);
    }

    // 🔒 SECURITY: Validate against pattern (prevent injection)
    if (!VALID_SERVER_ID_PATTERN.test(serverId)) {
      throw new Error('Server ID contains invalid characters. Allowed: alphanumeric, underscore, hyphen, dot');
    }

    // 🔒 SECURITY: Prevent path traversal attempts
    if (serverId.includes('..') || serverId.includes('//')) {
      throw new Error('Server ID contains suspicious patterns');
    }

    // 🔒 SECURITY: Prevent reserved keywords
    const reservedKeywords = ['null', 'undefined', 'admin', 'root', 'system'];
    if (reservedKeywords.includes(serverId.toLowerCase())) {
      throw new Error('Server ID uses reserved keyword');
    }

    return true;
  }

  /**
   * 🔒 Sanitize server ID by removing potentially dangerous characters
   * @param {string} serverId - Raw server ID
   * @returns {string} Sanitized server ID
   */
  sanitizeServerId(serverId) {
    if (!serverId) return null;

    // Convert to string and trim
    serverId = String(serverId).trim();

    // Remove any characters not in whitelist
    serverId = serverId.replace(/[^a-zA-Z0-9_\-\.]/g, '');

    // Limit length
    if (serverId.length > SERVER_ID_MAX_LENGTH) {
      serverId = serverId.substring(0, SERVER_ID_MAX_LENGTH);
    }

    return serverId;
  }

  /**
   * Initialize server identification with multiple fallback methods
   * Priority order:
   * 1. SERVER_ID env var (explicit configuration) - MUST be valid UUID
   * 2. RAILWAY_STATIC_URL (Railway deployment) - converted to UUID v5
   * 3. Hostname (generic deployment) - converted to UUID v5
   * 4. Generated UUID (last resort)
   *
   * @returns {string} Valid UUID v4 or v5 server ID
   */
  initialize() {
    if (this._isInitialized) {
      logger.warn('⚠️ ServerIdentifier already initialized. Returning existing ID.');
      return this._serverId;
    }

    let rawServerId = null;
    let source = null;

    try {
      // Priority 1: Explicit SERVER_ID environment variable (must be UUID)
      if (process.env.SERVER_ID) {
        rawServerId = process.env.SERVER_ID;
        source = 'SERVER_ID env var';
        this._serverType = 'explicit';

        // Validate that it's a proper UUID
        if (!this.isValidUUID(rawServerId)) {
          throw new Error('SERVER_ID must be a valid UUID format');
        }

        this._serverId = rawServerId;
      }
      // Priority 2: Railway deployment identifier → convert to UUID v5
      else if (process.env.RAILWAY_STATIC_URL) {
        rawServerId = process.env.RAILWAY_STATIC_URL;
        source = 'RAILWAY_STATIC_URL';
        this._serverType = 'railway';

        // Generate deterministic UUID v5 from Railway URL
        this._serverId = this.generateUUIDv5(rawServerId);
      }
      // Priority 3: RAILWAY_SERVICE_NAME → convert to UUID v5
      else if (process.env.RAILWAY_SERVICE_NAME) {
        rawServerId = process.env.RAILWAY_SERVICE_NAME;
        source = 'RAILWAY_SERVICE_NAME';
        this._serverType = 'railway';

        // Generate deterministic UUID v5 from service name
        this._serverId = this.generateUUIDv5(rawServerId);
      }
      // Priority 4: Use HOSTNAME + PORT for deterministic ID (multi-server on same machine)
      else {
        const os = require('os');
        const hostname = process.env.HOSTNAME || os.hostname();
        const port = process.env.PORT || '3000';
        
        // Combine hostname and port to create unique identifier
        rawServerId = `${hostname}:${port}`;
        source = 'hostname:port combination';
        this._serverType = 'generic';

        // Generate deterministic UUID v5 from hostname:port
        this._serverId = this.generateUUIDv5(rawServerId);
      }

      this._isInitialized = true;

      logger.info('✅ Server identified successfully', {
        serverId: this._serverId,
        source: source,
        type: this._serverType,
        originalValue: rawServerId !== this._serverId ? rawServerId : undefined
      });

      return this._serverId;

    } catch (error) {
      logger.error('❌ Failed to initialize server identifier', {
        error: error.message,
        rawServerId: rawServerId,
        source: source
      });

      // 🔒 FALLBACK: Generate secure random UUID v4 as last resort
      const fallbackId = this.generateFallbackServerId();

      logger.warn('⚠️ Using generated fallback server ID', {
        serverId: fallbackId
      });

      this._serverId = fallbackId;
      this._serverType = 'generated';
      this._isInitialized = true;

      return this._serverId;
    }
  }

  /**
   * Validate UUID format (v4 or v5)
   * @param {string} uuid - UUID string to validate
   * @returns {boolean} True if valid UUID
   */
  isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(uuid);
  }

  /**
   * Generate deterministic UUID v5 from a name/hostname
   * Uses DNS namespace for consistency
   * Same input always produces same UUID
   *
   * @param {string} name - Name/hostname to convert to UUID
   * @returns {string} UUID v5 string
   */
  generateUUIDv5(name) {
    if (!name) {
      throw new Error('Name is required for UUID v5 generation');
    }

    // DNS namespace UUID (standard)
    const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    // Convert namespace UUID to buffer
    const namespaceBuffer = Buffer.from(DNS_NAMESPACE.replace(/-/g, ''), 'hex');

    // Convert name to buffer
    const nameBuffer = Buffer.from(name, 'utf8');

    // Concatenate namespace and name
    const combined = Buffer.concat([namespaceBuffer, nameBuffer]);

    // Create SHA-1 hash
    const hash = crypto.createHash('sha1').update(combined).digest();

    // Set version (5) and variant bits
    hash[6] = (hash[6] & 0x0f) | 0x50; // Version 5
    hash[8] = (hash[8] & 0x3f) | 0x80; // Variant 10xx

    // Format as UUID string
    const uuid = [
      hash.slice(0, 4).toString('hex'),
      hash.slice(4, 6).toString('hex'),
      hash.slice(6, 8).toString('hex'),
      hash.slice(8, 10).toString('hex'),
      hash.slice(10, 16).toString('hex')
    ].join('-');

    logger.debug('Generated UUID v5', {
      input: name,
      output: uuid
    });

    return uuid;
  }

  /**
   * Generate secure fallback server ID as UUID v4
   * Used when all other identification methods fail
   *
   * @returns {string} Generated UUID v4
   */
  generateFallbackServerId() {
    // Generate random UUID v4
    const randomBytes = crypto.randomBytes(16);

    // Set version (4) and variant bits
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant 10xx

    // Format as UUID string
    const uuid = [
      randomBytes.slice(0, 4).toString('hex'),
      randomBytes.slice(4, 6).toString('hex'),
      randomBytes.slice(6, 8).toString('hex'),
      randomBytes.slice(8, 10).toString('hex'),
      randomBytes.slice(10, 16).toString('hex')
    ].join('-');

    logger.warn('🔧 Generated fallback server ID (UUID v4)', { fallbackId: uuid });

    return uuid;
  }

  /**
   * Get current server ID (must be initialized first)
   * @returns {string|null} Server ID or null if not initialized
   */
  getServerId() {
    if (!this._isInitialized) {
      logger.warn('⚠️ ServerIdentifier not initialized. Call initialize() first.');
      return this.initialize();
    }
    return this._serverId;
  }

  /**
   * Get server type
   * @returns {string|null} Server type (explicit, railway, generic, generated)
   */
  getServerType() {
    return this._serverType;
  }

  /**
   * Check if server ID matches the current server
   * @param {string} serverId - Server ID to check
   * @returns {boolean} True if matches
   */
  isCurrentServer(serverId) {
    if (!this._isInitialized) {
      this.initialize();
    }

    if (!serverId) return false;

    const sanitized = this.sanitizeServerId(serverId);
    return sanitized === this._serverId;
  }

  /**
   * Get server information for logging/monitoring
   * @returns {Object} Server info object
   */
  getServerInfo() {
    return {
      serverId: this._serverId,
      serverType: this._serverType,
      isInitialized: this._isInitialized,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime()
    };
  }

  /**
   * Reset server identifier (for testing purposes only)
   * ⚠️ WARNING: Do not use in production
   */
  reset() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset ServerIdentifier in production');
    }

    this._serverId = null;
    this._serverType = null;
    this._isInitialized = false;

    logger.warn('⚠️ ServerIdentifier reset (test mode only)');
  }
}

// Export singleton instance
const serverIdentifier = new ServerIdentifier();

module.exports = {
  serverIdentifier,
  ServerIdentifier, // Export class for testing
  SERVER_ID_MAX_LENGTH,
  SERVER_ID_MIN_LENGTH,
  VALID_SERVER_ID_PATTERN
};

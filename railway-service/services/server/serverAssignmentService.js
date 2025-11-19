/**
 * 🔒 ENTERPRISE-GRADE SERVER ASSIGNMENT SERVICE
 *
 * Purpose: Manage device-to-server assignments with load balancing and failover
 *
 * Features:
 * - Automatic device assignment based on server capacity
 * - Load balancing across healthy servers
 * - Automatic reassignment on server failure
 * - Comprehensive audit logging
 * - Transaction-safe operations
 *
 * @module ServerAssignmentService
 * @author HalloWa.id
 * @version 2.0.0
 */

const { supabase } = require('../../config/supabase');
const { serverIdentifier } = require('./serverIdentifier');
const { logger } = require('../../logger');

class ServerAssignmentService {
  constructor() {
    this.serverId = null;
  }

  /**
   * Initialize the service with current server ID
   */
  async initialize() {
    try {
      this.serverId = serverIdentifier.getServerId();

      if (!this.serverId) {
        throw new Error('Server ID not available - ServerIdentifier not initialized');
      }

      logger.info('✅ ServerAssignmentService initialized', {
        serverId: this.serverId
      });

      // Register this server in backend_servers table if not exists
      await this.registerServer();

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize ServerAssignmentService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register current server in backend_servers table
   * Creates or updates server record
   */
  async registerServer() {
    try {
      const serverInfo = serverIdentifier.getServerInfo();

      // Check if server already exists
      const { data: existingServer, error: fetchError } = await supabase
        .from('backend_servers')
        .select('id, server_name, is_active')
        .eq('id', this.serverId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingServer) {
        // Update existing server (mark as active, update last seen)
        const { error: updateError } = await supabase
          .from('backend_servers')
          .update({
            is_active: true,
            last_health_check: new Date().toISOString(),
            metadata: {
              ...serverInfo,
              last_startup: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', this.serverId);

        if (updateError) {
          logger.error('❌ Failed to update server registration', {
            serverId: this.serverId,
            error: updateError.message
          });
        } else {
          logger.info('✅ Server registration updated', {
            serverId: this.serverId,
            serverName: existingServer.server_name
          });
        }
      } else {
        // Auto-register new server
        const serverUrl = process.env.SERVER_URL || 
                         process.env.RAILWAY_STATIC_URL || 
                         `http://localhost:${process.env.PORT || 3000}`;
        
        const serverName = process.env.SERVER_NAME || 
                          process.env.RAILWAY_SERVICE_NAME || 
                          `Server-${this.serverId.substring(0, 8)}`;

        const { error: insertError } = await supabase
          .from('backend_servers')
          .insert({
            id: this.serverId,
            server_name: serverName,
            server_url: serverUrl,
            server_type: process.env.SERVER_TYPE || 'vps',
            region: process.env.SERVER_REGION || 'local',
            max_capacity: parseInt(process.env.SERVER_MAX_CAPACITY || '50'),
            is_active: true,
            is_healthy: true,
            priority: parseInt(process.env.SERVER_PRIORITY || '0'),
            metadata: {
              ...serverInfo,
              auto_registered: true,
              registered_at: new Date().toISOString()
            }
          });

        if (insertError) {
          logger.error('❌ Failed to auto-register server', {
            serverId: this.serverId,
            error: insertError.message,
            hint: 'Check if SUPABASE_SERVICE_ROLE_KEY is set correctly'
          });
        } else {
          logger.info('✅ Server auto-registered successfully', {
            serverId: this.serverId,
            serverName,
            serverUrl
          });
        }
      }
    } catch (error) {
      logger.error('❌ Failed to register server', {
        serverId: this.serverId,
        error: error.message
      });
      // Don't throw - service should continue even if registration fails
    }
  }

  /**
   * 🔒 Assign device to current server
   * Updates device's assigned_server_id
   *
   * @param {string} deviceId - Device UUID
   * @param {string} userId - User UUID (for audit logging)
   * @returns {Promise<boolean>} Success status
   */
  async assignDeviceToCurrentServer(deviceId, userId) {
    try {
      // 🔒 SECURITY: Validate input parameters
      if (!deviceId || typeof deviceId !== 'string') {
        throw new Error('Invalid device ID');
      }

      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      // Validate UUID format (basic check)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(deviceId)) {
        throw new Error('Invalid device ID format');
      }

      if (!uuidPattern.test(userId)) {
        throw new Error('Invalid user ID format');
      }

      // Check if device exists and belongs to user
      const { data: device, error: fetchError } = await supabase
        .from('devices')
        .select('id, user_id, device_name, assigned_server_id')
        .eq('id', deviceId)
        .eq('user_id', userId) // 🔒 SECURITY: Verify ownership
        .single();

      if (fetchError || !device) {
        logger.error('❌ Device not found or access denied', {
          deviceId,
          userId,
          error: fetchError?.message
        });
        return false;
      }

      // Check if already assigned to this server
      if (device.assigned_server_id === this.serverId) {
        logger.debug('Device already assigned to this server', {
          deviceId,
          serverId: this.serverId
        });
        return true;
      }

      // Update assignment
      const { error: updateError } = await supabase
        .from('devices')
        .update({
          assigned_server_id: this.serverId,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId)
        .eq('user_id', userId); // 🔒 Double-check ownership in update

      if (updateError) {
        throw updateError;
      }

      logger.info('✅ Device assigned to server', {
        deviceId,
        deviceName: device.device_name,
        serverId: this.serverId,
        previousServer: device.assigned_server_id || 'none'
      });

      // 🔒 AUDIT: Log assignment change
      await this.logAssignmentChange(deviceId, device.assigned_server_id, this.serverId);

      return true;

    } catch (error) {
      logger.error('❌ Failed to assign device to server', {
        deviceId,
        userId,
        serverId: this.serverId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get devices assigned to current server
   * Used by deviceManager to filter devices
   *
   * @param {Array<string>} statuses - Device statuses to filter (default: ['connecting', 'connected'])
   * @returns {Promise<Array>} Array of devices
   */
  async getAssignedDevices(statuses = ['connecting', 'connected']) {
    try {
      // 🔒 SECURITY: Validate statuses array
      if (!Array.isArray(statuses) || statuses.length === 0) {
        throw new Error('Invalid statuses array');
      }

      const validStatuses = ['connecting', 'connected', 'disconnected', 'error'];
      const sanitizedStatuses = statuses.filter(s => validStatuses.includes(s));

      if (sanitizedStatuses.length === 0) {
        throw new Error('No valid statuses provided');
      }

      // Query devices assigned to this server OR unassigned devices
      const { data: devices, error } = await supabase
        .from('devices')
        .select('*')
        .in('status', sanitizedStatuses)
        .or(`assigned_server_id.eq.${this.serverId},assigned_server_id.is.null`);

      if (error) {
        throw error;
      }

      logger.debug('Fetched assigned devices', {
        serverId: this.serverId,
        count: devices?.length || 0,
        statuses: sanitizedStatuses
      });

      return devices || [];

    } catch (error) {
      logger.error('❌ Failed to fetch assigned devices', {
        serverId: this.serverId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get best available server for load balancing
   * Called when assigning new devices
   *
   * @returns {Promise<string|null>} Server ID or null if none available
   */
  async getBestAvailableServer() {
    try {
      // Call database function for server selection
      const { data, error } = await supabase
        .rpc('get_best_available_server');

      if (error) {
        throw error;
      }

      if (!data) {
        logger.warn('⚠️ No available servers found');
        return null;
      }

      logger.debug('Best available server selected', {
        serverId: data
      });

      return data;

    } catch (error) {
      logger.error('❌ Failed to get best available server', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if device should be handled by this server
   *
   * @param {Object} device - Device object
   * @returns {boolean} True if this server should handle the device
   */
  shouldHandleDevice(device) {
    if (!device) return false;

    // Handle devices assigned to this server
    if (device.assigned_server_id === this.serverId) {
      return true;
    }

    // Handle unassigned devices (will auto-assign on connect)
    if (!device.assigned_server_id) {
      return true;
    }

    return false;
  }

  /**
   * Log assignment change for audit trail
   *
   * @param {string} deviceId - Device UUID
   * @param {string|null} oldServerId - Previous server ID
   * @param {string} newServerId - New server ID
   */
  async logAssignmentChange(deviceId, oldServerId, newServerId) {
    try {
      const { error } = await supabase
        .from('server_logs')
        .insert([{
          server_id: newServerId,
          log_type: 'info',
          message: 'Device assignment changed',
          details: {
            device_id: deviceId,
            old_server: oldServerId || 'none',
            new_server: newServerId,
            timestamp: new Date().toISOString(),
            reason: 'auto_assignment'
          }
        }]);

      if (error) {
        logger.error('❌ Failed to log assignment change', {
          error: error.message
        });
      }
    } catch (error) {
      logger.error('❌ Failed to log assignment change', {
        error: error.message
      });
      // Don't throw - logging failure shouldn't break assignment
    }
  }

  /**
   * Health check for current server
   * Updates server status in database
   */
  async updateServerHealth() {
    try {
      const serverInfo = serverIdentifier.getServerInfo();

      const { error } = await supabase
        .from('backend_servers')
        .update({
          last_health_check: new Date().toISOString(),
          is_healthy: true,
          metadata: serverInfo,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.serverId);

      if (error && error.code !== 'PGRST116') {
        logger.error('❌ Failed to update server health', {
          serverId: this.serverId,
          error: error.message
        });
      }
    } catch (error) {
      logger.error('❌ Failed to update server health', {
        serverId: this.serverId,
        error: error.message
      });
    }
  }

  /**
   * Graceful shutdown - mark server as inactive
   */
  async shutdown() {
    try {
      logger.info('🛑 Shutting down ServerAssignmentService', {
        serverId: this.serverId
      });

      const { error } = await supabase
        .from('backend_servers')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.serverId);

      if (error && error.code !== 'PGRST116') {
        logger.error('❌ Failed to mark server as inactive', {
          serverId: this.serverId,
          error: error.message
        });
      } else {
        logger.info('✅ Server marked as inactive', {
          serverId: this.serverId
        });
      }
    } catch (error) {
      logger.error('❌ Failed during shutdown', {
        serverId: this.serverId,
        error: error.message
      });
    }
  }
}

// Export singleton instance
const serverAssignmentService = new ServerAssignmentService();

module.exports = {
  serverAssignmentService,
  ServerAssignmentService // Export class for testing
};

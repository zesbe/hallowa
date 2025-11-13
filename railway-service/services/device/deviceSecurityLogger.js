/**
 * Device Security Logger Module
 * =============================
 * Handles connection event logging, health monitoring, and security tracking
 * for all WhatsApp device operations.
 *
 * Features:
 * - Connection event logging (connect, disconnect, errors)
 * - Health metrics tracking (uptime, message counts, error rates)
 * - Security audit trail
 * - Performance monitoring
 *
 * @module deviceSecurityLogger
 */

const { supabase } = require('../../config/supabase');
const { validateUserId, sanitizeErrorMessage, hashForLogging } = require('../../utils/inputValidation');

/**
 * Log a device connection event
 * @param {Object} params - Event parameters
 * @param {string} params.deviceId - Device UUID
 * @param {string} params.userId - User UUID
 * @param {string} params.eventType - Event type ('connected', 'disconnected', etc.)
 * @param {Object} params.details - Additional event details
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.errorCode - Error code if applicable
 * @param {string} params.errorMessage - Error message if applicable
 * @returns {Promise<string|null>} Log ID or null if failed
 */
async function logConnectionEvent({
  deviceId,
  userId,
  eventType,
  details = {},
  ipAddress = null,
  errorCode = null,
  errorMessage = null
}) {
  try {
    // 🔒 SECURITY: Validate inputs
    if (!deviceId || !userId || !eventType) {
      console.error('❌ [Security] Invalid log parameters');
      return null;
    }

    validateUserId(deviceId); // Validate UUID format
    validateUserId(userId);

    // 🔒 SECURITY: Sanitize error message
    const sanitizedError = errorMessage ? sanitizeErrorMessage(errorMessage) : null;

    // 🔒 SECURITY: Hash sensitive data for logging
    console.log(`📝 [Security Log] Event: ${eventType} | Device: ${hashForLogging(deviceId)} | User: ${hashForLogging(userId)}`);

    // Call database function
    const { data, error } = await supabase.rpc('log_device_connection_event', {
      p_device_id: deviceId,
      p_user_id: userId,
      p_event_type: eventType,
      p_details: details,
      p_ip_address: ipAddress,
      p_error_code: errorCode,
      p_error_message: sanitizedError
    });

    if (error) {
      console.error('❌ [Security] Failed to log event:', error);
      return null;
    }

    console.log(`✅ [Security] Event logged: ${eventType}`);
    return data;

  } catch (error) {
    console.error('❌ [Security] Exception in logConnectionEvent:', sanitizeErrorMessage(error.message));
    return null;
  }
}

/**
 * Update device health metrics
 * @param {Object} params - Health parameters
 * @param {string} params.deviceId - Device UUID
 * @param {string} params.userId - User UUID
 * @param {number} params.messagesSent - Number of messages sent
 * @param {number} params.messagesFailed - Number of messages failed
 * @param {boolean} params.errorOccurred - Whether an error occurred
 * @param {string} params.errorMessage - Error message if applicable
 * @returns {Promise<boolean>} Success status
 */
async function updateDeviceHealth({
  deviceId,
  userId,
  messagesSent = 0,
  messagesFailed = 0,
  errorOccurred = false,
  errorMessage = null
}) {
  try {
    // 🔒 SECURITY: Validate inputs
    validateUserId(deviceId);
    validateUserId(userId);

    // 🔒 SECURITY: Validate numeric inputs
    if (messagesSent < 0 || messagesFailed < 0) {
      console.error('❌ [Security] Invalid message counts');
      return false;
    }

    // 🔒 SECURITY: Sanitize error message
    const sanitizedError = errorMessage ? sanitizeErrorMessage(errorMessage) : null;

    const { error } = await supabase.rpc('update_device_health', {
      p_device_id: deviceId,
      p_user_id: userId,
      p_messages_sent: messagesSent,
      p_messages_failed: messagesFailed,
      p_error_occurred: errorOccurred,
      p_error_message: sanitizedError
    });

    if (error) {
      console.error('❌ [Security] Failed to update health:', error);
      return false;
    }

    console.log(`✅ [Health] Metrics updated for device ${hashForLogging(deviceId)}`);
    return true;

  } catch (error) {
    console.error('❌ [Health] Exception in updateDeviceHealth:', sanitizeErrorMessage(error.message));
    return false;
  }
}

/**
 * Get device health summary
 * @param {string} deviceId - Device UUID
 * @returns {Promise<Object|null>} Health summary or null
 */
async function getDeviceHealthSummary(deviceId) {
  try {
    // 🔒 SECURITY: Validate input
    validateUserId(deviceId);

    const { data, error } = await supabase.rpc('get_device_health_summary', {
      p_device_id: deviceId
    });

    if (error) {
      console.error('❌ [Health] Failed to get summary:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;

  } catch (error) {
    console.error('❌ [Health] Exception in getDeviceHealthSummary:', sanitizeErrorMessage(error.message));
    return null;
  }
}

/**
 * Get device connection logs with pagination
 * @param {string} deviceId - Device UUID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max results (default: 50)
 * @param {number} options.offset - Offset for pagination (default: 0)
 * @param {string} options.eventType - Filter by event type
 * @returns {Promise<Array>} Array of log entries
 */
async function getDeviceConnectionLogs(deviceId, options = {}) {
  try {
    // 🔒 SECURITY: Validate input
    validateUserId(deviceId);

    const {
      limit = 50,
      offset = 0,
      eventType = null
    } = options;

    // 🔒 SECURITY: Validate pagination params
    if (limit < 1 || limit > 200 || offset < 0) {
      console.error('❌ [Security] Invalid pagination parameters');
      return [];
    }

    let query = supabase
      .from('device_connection_logs')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [Security] Failed to get logs:', error);
      return [];
    }

    console.log(`✅ [Security] Retrieved ${data?.length || 0} log entries for device ${hashForLogging(deviceId)}`);
    return data || [];

  } catch (error) {
    console.error('❌ [Security] Exception in getDeviceConnectionLogs:', sanitizeErrorMessage(error.message));
    return [];
  }
}

/**
 * Get user's device logs summary
 * @param {string} userId - User UUID
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Promise<Object>} Summary statistics
 */
async function getUserDeviceLogsSummary(userId, days = 7) {
  try {
    // 🔒 SECURITY: Validate input
    validateUserId(userId);

    if (days < 1 || days > 90) {
      console.error('❌ [Security] Invalid days parameter');
      return null;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('device_connection_logs')
      .select('event_type')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString());

    if (error) {
      console.error('❌ [Security] Failed to get user logs summary:', error);
      return null;
    }

    // Aggregate statistics
    const summary = {
      totalEvents: data.length,
      connections: 0,
      disconnections: 0,
      errors: 0,
      qrGenerations: 0,
      pairingCodes: 0,
      reconnectAttempts: 0
    };

    data.forEach(log => {
      switch (log.event_type) {
        case 'connected':
          summary.connections++;
          break;
        case 'disconnected':
          summary.disconnections++;
          break;
        case 'error':
          summary.errors++;
          break;
        case 'qr_generated':
          summary.qrGenerations++;
          break;
        case 'pairing_code_generated':
          summary.pairingCodes++;
          break;
        case 'reconnect_attempt':
          summary.reconnectAttempts++;
          break;
      }
    });

    console.log(`✅ [Security] User logs summary for last ${days} days: ${summary.totalEvents} events`);
    return summary;

  } catch (error) {
    console.error('❌ [Security] Exception in getUserDeviceLogsSummary:', sanitizeErrorMessage(error.message));
    return null;
  }
}

/**
 * Update device uptime (call this periodically for connected devices)
 * @param {string} deviceId - Device UUID
 * @returns {Promise<boolean>} Success status
 */
async function updateDeviceUptime(deviceId) {
  try {
    // 🔒 SECURITY: Validate input
    validateUserId(deviceId);

    // Get device info
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('user_id, status, last_connected_at')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return false;
    }

    // Only update if device is connected
    if (device.status !== 'connected' || !device.last_connected_at) {
      return false;
    }

    // Calculate uptime in minutes
    const uptimeMinutes = Math.floor(
      (Date.now() - new Date(device.last_connected_at).getTime()) / (1000 * 60)
    );

    // Update health metrics with uptime
    const { error } = await supabase
      .from('device_health_metrics')
      .update({
        uptime_minutes: uptimeMinutes,
        last_heartbeat: new Date().toISOString()
      })
      .eq('device_id', deviceId)
      .eq('date', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('❌ [Health] Failed to update uptime:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ [Health] Exception in updateDeviceUptime:', sanitizeErrorMessage(error.message));
    return false;
  }
}

/**
 * Check device health status and return issues
 * @param {string} deviceId - Device UUID
 * @returns {Promise<Object>} Health status and issues
 */
async function checkDeviceHealthStatus(deviceId) {
  try {
    // 🔒 SECURITY: Validate input
    validateUserId(deviceId);

    const health = await getDeviceHealthSummary(deviceId);

    if (!health) {
      return {
        status: 'unknown',
        issues: ['Unable to retrieve health data']
      };
    }

    const issues = [];

    // Check error rate
    if (health.error_rate_percent > 20) {
      issues.push(`High error rate: ${health.error_rate_percent.toFixed(1)}%`);
    } else if (health.error_rate_percent > 10) {
      issues.push(`Elevated error rate: ${health.error_rate_percent.toFixed(1)}%`);
    }

    // Check recent errors
    if (health.last_error_message) {
      const errorAge = Date.now() - new Date(health.last_error_at || 0).getTime();
      if (errorAge < 60 * 60 * 1000) { // Last hour
        issues.push(`Recent error: ${health.last_error_message.substring(0, 50)}`);
      }
    }

    // Check reconnect count
    if (health.reconnect_count_today > 5) {
      issues.push(`Multiple reconnects today: ${health.reconnect_count_today}`);
    }

    // Determine status
    let status = 'healthy';
    if (health.error_rate_percent > 20 || health.reconnect_count_today > 10) {
      status = 'critical';
    } else if (health.error_rate_percent > 10 || health.reconnect_count_today > 5) {
      status = 'warning';
    }

    return {
      status,
      issues,
      metrics: health
    };

  } catch (error) {
    console.error('❌ [Health] Exception in checkDeviceHealthStatus:', sanitizeErrorMessage(error.message));
    return {
      status: 'error',
      issues: ['Health check failed']
    };
  }
}

module.exports = {
  logConnectionEvent,
  updateDeviceHealth,
  getDeviceHealthSummary,
  getDeviceConnectionLogs,
  getUserDeviceLogsSummary,
  updateDeviceUptime,
  checkDeviceHealthStatus
};

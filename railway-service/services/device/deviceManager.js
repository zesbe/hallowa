/**
 * 🔒 ENTERPRISE-GRADE DEVICE MANAGER
 *
 * Purpose: Manage WhatsApp device connections with multi-server awareness
 *
 * Features:
 * - Server-aware device filtering (prevents duplicate connections)
 * - Automatic stuck device recovery
 * - Session recovery after restarts
 * - Comprehensive error handling
 * - Audit logging for all device state changes
 *
 * @module DeviceManager
 * @author HalloWa.id
 * @version 2.0.0
 */

const { supabase } = require('../../config/supabase');
const { serverAssignmentService } = require('../server/serverAssignmentService');
const { logger } = require('../../logger');

// 🔒 SECURITY: Configuration constants
const DEVICE_STUCK_TIMEOUT = 120; // seconds
const RECONNECT_DELAY_SHORT = 500; // milliseconds
const RECONNECT_DELAY_LONG = 1500; // milliseconds

/**
 * Check if device is stuck in connecting status
 * @param {Object} device - Device object
 * @returns {boolean} True if device is stuck
 */
function isDeviceStuck(device) {
  if (device.status === 'connecting' && device.updated_at) {
    const lastUpdate = new Date(device.updated_at).getTime();
    const now = Date.now();
    const stuckTime = (now - lastUpdate) / 1000; // seconds

    return stuckTime > DEVICE_STUCK_TIMEOUT;
  }
  return false;
}

/**
 * Clear stuck device session
 * @param {Object} device - Device object
 */
async function clearStuckDeviceSession(device) {
  try {
    const lastUpdate = new Date(device.updated_at).getTime();
    const now = Date.now();
    const stuckTime = Math.floor((now - lastUpdate) / 1000);

    logger.warn('⚠️ Clearing stuck device session', {
      deviceId: device.id,
      deviceName: device.device_name,
      stuckDuration: `${stuckTime}s`,
      status: device.status
    });

    const { error } = await supabase
      .from('devices')
      .update({
        status: 'disconnected',
        qr_code: null,
        session_data: null,
        error_message: `Connection stuck for ${stuckTime}s - session cleared`,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);

    if (error) {
      logger.error('❌ Failed to clear stuck device session', {
        deviceId: device.id,
        error: error.message
      });
    } else {
      logger.info('✅ Stuck device session cleared', {
        deviceId: device.id,
        deviceName: device.device_name
      });
    }
  } catch (error) {
    logger.error('❌ Exception in clearStuckDeviceSession', {
      deviceId: device?.id,
      error: error.message
    });
  }
}

/**
 * 🔒 Validate device ownership before connecting
 * @param {Object} device - Device object
 * @returns {boolean} True if valid
 */
function validateDevice(device) {
  if (!device) {
    logger.error('❌ Device validation failed: device is null');
    return false;
  }

  if (!device.id || typeof device.id !== 'string') {
    logger.error('❌ Device validation failed: invalid device ID', {
      deviceId: device.id
    });
    return false;
  }

  if (!device.user_id || typeof device.user_id !== 'string') {
    logger.error('❌ Device validation failed: invalid user ID', {
      deviceId: device.id,
      userId: device.user_id
    });
    return false;
  }

  return true;
}

/**
 * Handle device that should be online but socket doesn't exist
 * @param {Object} device - Device object
 * @param {Function} connectWhatsApp - WhatsApp connection function
 * @param {Map} activeSockets - Map of active sockets
 */
async function handleMissingSocket(device, connectWhatsApp, activeSockets) {
  try {
    // 🔒 SECURITY: Validate device before connecting
    if (!validateDevice(device)) {
      return;
    }

    const hasSessionData = device.session_data?.creds?.registered;

    if (device.status === 'connected' && hasSessionData) {
      // Railway restart detected - try to recover session
      logger.info('🔄 Recovering session (restart detected)', {
        deviceId: device.id,
        deviceName: device.device_name,
        hasSession: true
      });

      await connectWhatsApp(device, true, activeSockets);
    } else {
      logger.info('🔄 Connecting device', {
        deviceId: device.id,
        deviceName: device.device_name,
        status: device.status,
        hasSession: hasSessionData
      });

      await connectWhatsApp(device, false, activeSockets);
    }
  } catch (error) {
    logger.error('❌ Error in handleMissingSocket', {
      deviceId: device?.id,
      deviceName: device?.device_name,
      error: error.message
    });
  }
}

/**
 * Handle socket that exists but not authenticated
 * @param {Object} device - Device object
 * @param {Object} sock - WhatsApp socket
 * @param {Function} connectWhatsApp - WhatsApp connection function
 * @param {Map} activeSockets - Map of active sockets
 */
async function handleUnauthenticatedSocket(device, sock, connectWhatsApp, activeSockets) {
  try {
    const hasSessionData = device.session_data?.creds?.registered;

    logger.warn('⚠️ Socket exists but not authenticated', {
      deviceId: device.id,
      deviceName: device.device_name,
      hasSession: hasSessionData
    });

    // End existing socket
    try {
      sock.end();
    } catch (endError) {
      logger.error('❌ Error ending socket', {
        deviceId: device.id,
        error: endError.message
      });
    }

    activeSockets.delete(device.id);

    if (hasSessionData) {
      logger.info('🔄 Attempting session recovery', {
        deviceId: device.id,
        deviceName: device.device_name
      });

      setTimeout(() => {
        connectWhatsApp(device, true, activeSockets).catch((error) => {
          logger.error('❌ Session recovery failed', {
            deviceId: device.id,
            error: error.message
          });
        });
      }, RECONNECT_DELAY_SHORT);
    } else {
      logger.info('🔄 No session data - will generate QR/pairing code', {
        deviceId: device.id,
        deviceName: device.device_name
      });

      await supabase
        .from('devices')
        .update({
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);

      setTimeout(() => {
        connectWhatsApp(device, false, activeSockets).catch((error) => {
          logger.error('❌ Reconnection failed', {
            deviceId: device.id,
            error: error.message
          });
        });
      }, RECONNECT_DELAY_SHORT);
    }
  } catch (error) {
    logger.error('❌ Error in handleUnauthenticatedSocket', {
      deviceId: device?.id,
      error: error.message
    });
  }
}

/**
 * Disconnect device that should be offline
 * @param {string} deviceId - Device ID
 * @param {Object} sock - WhatsApp socket
 * @param {Map} activeSockets - Map of active sockets
 */
async function disconnectDevice(deviceId, sock, activeSockets) {
  try {
    logger.info('❌ Disconnecting device', {
      deviceId,
      reason: 'status_changed_or_deleted'
    });

    // End socket
    try {
      sock?.end();
    } catch (endError) {
      logger.error('❌ Error ending socket during disconnect', {
        deviceId,
        error: endError.message
      });
    }

    activeSockets.delete(deviceId);

    // Clean auth on explicit disconnect
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          qr_code: null,
          session_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      if (error) {
        logger.error('❌ Error cleaning auth on disconnect', {
          deviceId,
          error: error.message
        });
      }
    } catch (cleanError) {
      logger.error('❌ Exception cleaning auth on disconnect', {
        deviceId,
        error: cleanError.message
      });
    }
  } catch (error) {
    logger.error('❌ Error in disconnectDevice', {
      deviceId,
      error: error.message
    });
  }
}

/**
 * 🔒 ENTERPRISE-GRADE DEVICE CHECKER
 *
 * Main device management function that runs periodically
 * Now with multi-server awareness to prevent duplicate connections
 *
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 * @param {Function} connectWhatsApp - WhatsApp connection function
 */
async function checkDevices(activeSockets, connectWhatsApp) {
  try {
    // 🆕 MULTI-SERVER: Get devices assigned to THIS server
    const assignedDevices = await serverAssignmentService.getAssignedDevices(['connecting', 'connected']);

    // 🆕 MULTI-SERVER: Also get unassigned devices for potential assignment
    const { data: unassignedDevices, error: unassignedError } = await supabase
      .from('devices')
      .select('*')
      .in('status', ['connecting', 'connected'])
      .is('assigned_server_id', null);

    if (unassignedError) {
      logger.error('❌ Failed to fetch unassigned devices', {
        error: unassignedError.message
      });
    }

    // Combine assigned and unassigned devices
    const allDevices = [...(assignedDevices || []), ...(unassignedDevices || [])];

    if (!allDevices || allDevices.length === 0) {
      logger.debug('No devices to check', {
        serverId: serverAssignmentService.serverId
      });
      return;
    }

    logger.debug('Checking devices', {
      serverId: serverAssignmentService.serverId,
      assignedCount: assignedDevices?.length || 0,
      unassignedCount: unassignedDevices?.length || 0,
      totalCount: allDevices.length
    });

    // Ensure sockets for devices that should be online
    const needSockets = allDevices.filter(d => ['connecting', 'connected'].includes(d.status));

    for (const device of needSockets) {
      // 🔒 SECURITY: Validate device before processing
      if (!validateDevice(device)) {
        continue;
      }

      // 🆕 MULTI-SERVER: Auto-assign unassigned devices with load balancing
      if (!device.assigned_server_id) {
        logger.info('📋 Unassigned device detected - attempting auto-assignment', {
          deviceId: device.id,
          deviceName: device.device_name
        });

        const shouldHandle = await serverAssignmentService.autoAssignDevice(device);
        
        if (!shouldHandle) {
          logger.info('📤 Device assigned to another server - skipping', {
            deviceId: device.id,
            deviceName: device.device_name
          });
          continue;
        }

        // Update device object with new assignment
        device.assigned_server_id = serverAssignmentService.serverId;
        logger.info('✅ Device assigned to this server', {
          deviceId: device.id,
          serverId: serverAssignmentService.serverId
        });
      }

      // 🆕 MULTI-SERVER: Verify this server should handle this device
      if (!serverAssignmentService.shouldHandleDevice(device)) {
        logger.warn('⚠️ Device not assigned to this server - skipping', {
          deviceId: device.id,
          deviceName: device.device_name,
          assignedServer: device.assigned_server_id,
          currentServer: serverAssignmentService.serverId
        });
        continue;
      }

      const sock = activeSockets.get(device.id);

      // Check if device stuck in connecting for too long (>2 minutes)
      if (isDeviceStuck(device)) {
        await clearStuckDeviceSession(device);
        continue;
      }

      if (!sock) {
        // No socket exists, create new connection
        await handleMissingSocket(device, connectWhatsApp, activeSockets);
      } else if (device.status === 'connected' && !sock.user) {
        // Socket exists but not authenticated, try session recovery first
        await handleUnauthenticatedSocket(device, sock, connectWhatsApp, activeSockets);
      }
    }

    // Disconnect devices that should be disconnected
    for (const [deviceId, sock] of activeSockets) {
      const device = allDevices.find(d => d.id === deviceId);

      if (!device || device.status === 'disconnected') {
        await disconnectDevice(deviceId, sock, activeSockets);
      }
    }

    logger.info('✅ Device check complete', {
      serverId: serverAssignmentService.serverId,
      activeConnections: activeSockets.size,
      assignedDevices: assignedDevices?.length || 0,
      processedDevices: allDevices.length
    });

  } catch (error) {
    logger.error('❌ Error in checkDevices', {
      error: error.message,
      stack: error.stack
    });
  }
}

module.exports = {
  checkDevices,
  isDeviceStuck,
  clearStuckDeviceSession,
  validateDevice,
  handleMissingSocket,
  handleUnauthenticatedSocket,
  disconnectDevice
};

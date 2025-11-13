const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const os = require('os');
const { supabase } = require('../../config/supabase');
const { useSupabaseAuthState } = require('./authStateManager');
const { handleQRCode } = require('../../qr-handler');
const { setupCRMMessageListeners } = require('../../crm-message-handler');
const { logger } = require('../../logger');
const { logConnectionEvent, updateDeviceHealth } = require('../device/deviceSecurityLogger'); // 🔒 Security logging

/**
 * Request pairing code for WhatsApp connection
 * @param {Object} sock - WhatsApp socket
 * @param {Object} device - Device object
 * @param {string} phoneForPairing - Phone number for pairing
 * @returns {Promise<boolean>} Success status
 */
async function requestPairingCode(sock, device, phoneForPairing) {
  try {
    console.log(`🔐 [${device.device_name}] Requesting pairing code for: ${phoneForPairing}`);

    // For Baileys v7+, use requestPairingCode if available
    if (sock.requestPairingCode) {
      const cleanPhone = phoneForPairing.replace(/[^\d]/g, '');
      const code = await sock.requestPairingCode(cleanPhone);

      if (code) {
        console.log(`✅ [${device.device_name}] Pairing code received: ${code}`);

        // Save pairing code to database
        await supabase
          .from('devices')
          .update({
            status: 'connecting',
            pairing_code: code,
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);

        // 🔒 SECURITY: Log pairing code generation
        await logConnectionEvent({
          deviceId: device.id,
          userId: device.user_id,
          eventType: 'pairing_code_generated',
          details: { phoneNumber: cleanPhone, method: 'pairing' }
        });

        return true;
      }
    } else {
      console.log(`⚠️ [${device.device_name}] requestPairingCode not available, waiting for code in update...`);
    }
  } catch (err) {
    console.error(`❌ [${device.device_name}] Error requesting pairing code:`, err);
  }

  return false;
}

/**
 * Handle pairing code from connection update
 * @param {Object} update - Connection update object
 * @param {Object} device - Device object
 * @param {boolean} isPairingMode - Whether pairing mode is enabled
 * @param {boolean} hasValidSession - Whether device has valid session
 */
async function handlePairingCodeUpdate(update, device, isPairingMode, hasValidSession) {
  if (update.pairingCode && isPairingMode && !hasValidSession) {
    const code = update.pairingCode;
    console.log(`📱 [${device.device_name}] Pairing code from update: ${code}`);

    // Save to database
    await supabase
      .from('devices')
      .update({
        status: 'connecting',
        pairing_code: code,
        qr_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);
  }
}

/**
 * Handle successful connection
 * @param {Object} sock - WhatsApp socket
 * @param {Object} device - Device object
 * @param {boolean} isRecovery - Whether this is a session recovery
 */
async function handleConnectionOpen(sock, device, isRecovery) {
  if (isRecovery) {
    console.log('🎉 Session recovered successfully:', device.device_name);
  } else {
    console.log('✅ Connected:', device.device_name);
  }

  try {
    // Get phone number
    const phoneNumber = sock.user?.id.split(':')[0];
    console.log('📞 Phone number:', phoneNumber);

    // Update database
    const { error } = await supabase
      .from('devices')
      .update({
        status: 'connected',
        phone_number: phoneNumber,
        last_connected_at: new Date().toISOString(),
        qr_code: null,
        pairing_code: null,
        server_id: process.env.RAILWAY_STATIC_URL || os.hostname()
      })
      .eq('id', device.id);

    if (error) {
      console.error('❌ Error updating device status:', error);
    } else {
      if (isRecovery) {
        console.log('🎉 Session restored without needing re-scan!');
      } else {
        console.log('✅ Device status updated to connected');
      }
    }

    // 🔒 SECURITY: Log successful connection
    await logConnectionEvent({
      deviceId: device.id,
      userId: device.user_id,
      eventType: 'connected',
      details: {
        phoneNumber,
        isRecovery,
        server: process.env.RAILWAY_STATIC_URL || os.hostname(),
        timestamp: new Date().toISOString()
      }
    });

    // Store user_id in socket for HTTP endpoint access
    sock.deviceUserId = device.user_id;

    // Setup CRM message listeners to save all incoming/outgoing messages
    setupCRMMessageListeners(sock, device.id, device.user_id);

  } catch (connError) {
    console.error('❌ Error handling connection:', connError);
  }
}

/**
 * Handle disconnection and reconnection logic
 * @param {Object} params - Disconnect parameters
 */
async function handleDisconnection({
  lastDisconnect,
  device,
  deviceId,
  activeSockets,
  connectWhatsApp
}) {
  const deviceName = device.device_name || 'Unknown';
  const code = lastDisconnect?.error?.output?.statusCode;
  const message = lastDisconnect?.error?.message || '';
  const restartRequired = code === DisconnectReason.restartRequired || code === 515 || /restart required/i.test(message);
  const loggedOut = code === DisconnectReason.loggedOut;

  console.log('🔌 Connection closed');
  console.log('📊 Disconnect statusCode:', code);
  console.log('🧾 Error message:', message);

  activeSockets.delete(deviceId);

  // 🔒 SECURITY: Log disconnection event
  await logConnectionEvent({
    deviceId: device.id,
    userId: device.user_id,
    eventType: loggedOut ? 'logout' : 'disconnected',
    errorCode: code ? code.toString() : null,
    errorMessage: message,
    details: {
      restartRequired,
      loggedOut,
      disconnectCode: code,
      timestamp: new Date().toISOString()
    }
  });

  try {
    // Respect user-initiated cancel: do nothing if already disconnected
    const { data: current } = await supabase
      .from('devices')
      .select('status, session_data')
      .eq('id', deviceId)
      .single();

    if (current?.status === 'disconnected') {
      console.log(`🧘 [${deviceName}] User set status to disconnected — skipping auto-reconnect`);
      return;
    }

    if (restartRequired) {
      // Keep auth, try session recovery
      console.log(`♻️ [${deviceName}] Restart required - attempting session recovery`);
      const hasSessionData = current?.session_data?.creds?.registered;

      if (hasSessionData) {
        console.log(`🔄 [${deviceName}] Session data available - recovering without QR`);
        setTimeout(() => {
          if (!activeSockets.has(deviceId)) {
            connectWhatsApp(device, true).catch(() => {}); // Recovery mode
          }
        }, 1500);
      } else {
        console.log(`⚠️ [${deviceName}] No session data - will generate QR/pairing`);
        await supabase.from('devices').update({ status: 'connecting' }).eq('id', deviceId);
        setTimeout(() => {
          if (!activeSockets.has(deviceId)) {
            connectWhatsApp(device).catch(() => {});
          }
        }, 1500);
      }
    } else if (code === 401 || code === 405) {
      // Authentication failed: clear auth and force fresh login (QR/Pairing)
      console.log(`❌ [${deviceName}] ${code} Authentication failed - clearing session`);
      await supabase.from('devices').update({
        status: 'connecting',
        qr_code: null,
        pairing_code: null,
        session_data: null
      }).eq('id', deviceId);
      setTimeout(() => {
        if (!activeSockets.has(deviceId)) {
          console.log(`🔁 [${deviceName}] Reconnect after auth failure...`);
          connectWhatsApp(device).catch(() => {});
        }
      }, 1000);
    } else if (loggedOut) {
      console.log(`👋 [${deviceName}] Logged out - clearing session`);
      await supabase.from('devices').update({
        status: 'disconnected',
        phone_number: null,
        qr_code: null,
        pairing_code: null,
        session_data: null
      }).eq('id', deviceId);
    } else {
      // Other transient errors -> try session recovery if available
      console.log(`⚠️ [${deviceName}] Transient error - checking session data`);
      const hasSessionData = current?.session_data?.creds?.registered;

      if (hasSessionData) {
        console.log(`🔄 [${deviceName}] Session data available - attempting recovery`);
        setTimeout(() => {
          if (!activeSockets.has(deviceId)) {
            console.log(`🔁 [${deviceName}] Attempting session recovery...`);
            connectWhatsApp(device, true).catch(() => {});
          }
        }, 500);
      } else {
        console.log(`⚠️ [${deviceName}] No session data - will generate QR/pairing`);
        await supabase.from('devices').update({ status: 'connecting' }).eq('id', deviceId);
        setTimeout(() => {
          if (!activeSockets.has(deviceId)) {
            console.log(`🔁 [${deviceName}] Attempting reconnect...`);
            connectWhatsApp(device).catch(() => {});
          }
        }, 500);
      }
    }
  } catch (discError) {
    console.error(`❌ [${deviceName}] Error handling disconnection:`, discError);
  }
}

/**
 * Connect WhatsApp device with QR or Pairing code
 * @param {Object} device - Device object from database
 * @param {boolean} isRecovery - Whether this is a session recovery attempt
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 */
async function connectWhatsApp(device, isRecovery = false, activeSockets) {
  const deviceName = device.device_name || 'Unknown';
  const deviceId = device.id;

  if (isRecovery) {
    console.log(`🔄 [${deviceName}] Session Recovery Mode`);
  } else {
    console.log(`📱 [${deviceName}] Starting connection...`);
  }

  try {
    // Load auth state from Supabase
    const { state, saveCreds } = await useSupabaseAuthState(deviceId);

    // Check if already has valid session
    const hasValidSession = state.creds.registered;

    if (hasValidSession) {
      console.log(`✅ [${deviceName}] Valid session found - will auto-restore`);
    } else {
      console.log(`⚠️ [${deviceName}] No valid session - needs QR/pairing`);
    }

    // Get device configuration
    const { data: deviceConfig } = await supabase
      .from('devices')
      .select('connection_method, phone_for_pairing')
      .eq('id', deviceId)
      .single();

    const isPairingMode = deviceConfig?.connection_method === 'pairing' && !!deviceConfig?.phone_for_pairing;
    const phoneForPairing = deviceConfig?.phone_for_pairing;

    if (isPairingMode) {
      logger.info(`🔑 [${deviceName}] Pairing mode enabled`);
    }

    // Get latest WhatsApp Web version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📱 [${deviceName}] Using WA version: ${version.join('.')}`);

    // Create WhatsApp socket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 10_000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      mobile: false,
      pairingCode: isPairingMode ? true : undefined,
      phoneNumber: isPairingMode ? phoneForPairing : undefined,
      getMessage: async () => null,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
    });

    // Store socket
    activeSockets.set(deviceId, sock);
    console.log(`✅ [${deviceName}] Socket created`);

    // Track if pairing code has been requested (prevent duplicates)
    let pairingCodeRequested = false;

    // ==========================================
    // Handle connection updates
    // ==========================================
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      console.log(`📡 [${deviceName}] Connection update:`, {
        connection,
        registered: sock.authState.creds.registered,
        hasQR: !!qr,
        isPairingMode
      });

      // Request pairing code if needed
      if (isPairingMode && !hasValidSession && !isRecovery && !pairingCodeRequested) {
        if (!sock.authState.creds.registered && phoneForPairing) {
          pairingCodeRequested = true;
          await requestPairingCode(sock, device, phoneForPairing);
        }
      }

      // Handle pairing code in connection update
      await handlePairingCodeUpdate(update, device, isPairingMode, hasValidSession);

      // Handle QR code for QR method (not pairing mode)
      if (qr && !isPairingMode && !sock.authState.creds.registered && !isRecovery) {
        console.log(`📷 [${deviceName}] QR code received - generating...`);
        await handleQRCode(device, qr, supabase);
      } else if (qr && isPairingMode) {
        console.log(`⛔ [${deviceName}] QR received but skipped (pairing mode)`);
      }

      // Connected successfully
      if (connection === 'open') {
        await handleConnectionOpen(sock, device, isRecovery);
      }

      // Disconnected
      if (connection === 'close') {
        await handleDisconnection({
          lastDisconnect,
          device,
          deviceId,
          activeSockets,
          connectWhatsApp
        });
      }
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (e) {
        console.error(`❌ [${deviceName}] saveCreds error:`, e);
      }
    });

    // Handle messages (optional - for future message handling)
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const jid = messages[0]?.key?.remoteJid;
      if (jid) {
        console.log(`💬 [${deviceName}] Message from:`, jid);
      }
    });

    // Store device reference on socket
    sock.deviceId = deviceId;

  } catch (error) {
    console.error(`❌ [${deviceName}] Error connecting WhatsApp:`, error);

    // Update status to error
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: error.message || 'Connection error',
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (updateError) {
      console.error(`❌ [${deviceName}] Error updating error status:`, updateError);
    }

    activeSockets.delete(deviceId);
  }
}

module.exports = { connectWhatsApp };

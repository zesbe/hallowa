/**
 * Pairing Connection Manager
 * Handles WhatsApp connection lifecycle using Pairing Code method
 */

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { useSupabaseAuthState } = require('./shared/auth-state');
const simplePairingHandler = require('./pairing-handler-stable');
const os = require('os');

class PairingConnectionManager {
  constructor(supabase, activeSockets) {
    this.supabase = supabase;
    this.activeSockets = activeSockets;
  }

  /**
   * Connect device using pairing code method
   * @param {Object} device - Device data from database
   * @param {boolean} isRecovery - Whether this is a session recovery
   */
  async connect(device, isRecovery = false) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔶 [Pairing-Manager] Starting Pairing connection for: ${deviceName}`);
    console.log(`${'='.repeat(60)}`);

    if (isRecovery) {
      console.log(`🔄 [Pairing-Manager] Recovery mode enabled`);
    }

    try {
      // Load auth state
      const { state, saveCreds } = await useSupabaseAuthState(deviceId, this.supabase);
      const hasValidSession = state.creds.registered;

      if (hasValidSession) {
        console.log(`✅ [Pairing-Manager] Valid session found - will auto-restore`);
      } else {
        console.log(`⚠️ [Pairing-Manager] No valid session - pairing code will be generated`);
      }

      // Get device configuration
      const { data: deviceConfig } = await this.supabase
        .from('devices')
        .select('connection_method, phone_for_pairing')
        .eq('id', deviceId)
        .single();

      const phoneForPairing = deviceConfig?.phone_for_pairing;

      if (!phoneForPairing) {
        throw new Error('No phone number configured for pairing');
      }

      console.log(`🔑 [Pairing-Manager] Phone for pairing: ${phoneForPairing}`);

      // Get latest WhatsApp Web version
      const { version } = await fetchLatestBaileysVersion();
      console.log(`📱 [Pairing-Manager] Using WA version: ${version.join('.')}`);

      // Create WhatsApp socket
      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['HalloWa', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
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
      this.activeSockets.set(deviceId, sock);
      sock.deviceId = deviceId;
      console.log(`✅ [Pairing-Manager] Socket created and stored`);

      // Request pairing code IMMEDIATELY (before connection established)
      if (!hasValidSession && !isRecovery) {
        console.log(`🔐 [Pairing-Manager] Requesting pairing code immediately...`);

        // Small delay to let socket initialize
        await new Promise(resolve => setTimeout(resolve, 2000));

        const result = await simplePairingHandler.generatePairingCode(
          sock,
          device,
          this.supabase
        );

        if (result) {
          console.log(`✅ [Pairing-Manager] Pairing code generated successfully`);
        } else {
          console.error(`❌ [Pairing-Manager] Pairing code generation failed`);
        }
      }

      // Setup event handlers
      this.setupConnectionHandlers(sock, device, saveCreds, isRecovery, hasValidSession);
      this.setupCredentialsHandler(sock, saveCreds, deviceName);
      this.setupMessagesHandler(sock, deviceName);

      console.log(`✅ [Pairing-Manager] Event handlers registered`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
      console.error(`\n❌ [Pairing-Manager] Fatal error for ${deviceName}:`, error);
      await this.handleConnectionError(deviceId, error);
    }
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers(sock, device, saveCreds, isRecovery, hasValidSession) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      console.log(`📡 [Pairing-Manager] ${deviceName} - Connection update:`, {
        connection,
        registered: sock.authState.creds.registered,
        hasQR: !!qr,
      });

      // Skip QR code in pairing mode
      if (qr) {
        console.log(`⛔ [Pairing-Manager] ${deviceName} - QR received but skipped (pairing mode)`);
      }

      // Connected successfully
      if (connection === 'open') {
        await this.handleConnectionOpen(sock, device, isRecovery);
      }

      // Disconnected
      if (connection === 'close') {
        await this.handleConnectionClose(sock, device, lastDisconnect);
      }
    });
  }

  /**
   * Handle successful connection
   */
  async handleConnectionOpen(sock, device, isRecovery) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    if (isRecovery) {
      console.log(`🎉 [Pairing-Manager] ${deviceName} - Session recovered successfully!`);
    } else {
      console.log(`✅ [Pairing-Manager] ${deviceName} - Connected successfully!`);
    }

    try {
      // Get phone number
      const phoneNumber = sock.user?.id.split(':')[0];
      console.log(`📞 [Pairing-Manager] ${deviceName} - Phone: ${phoneNumber}`);

      // Update database
      const { error } = await this.supabase
        .from('devices')
        .update({
          status: 'connected',
          phone_number: phoneNumber,
          last_connected_at: new Date().toISOString(),
          qr_code: null,
          pairing_code: null,
          error_message: null,
          server_id: process.env.RAILWAY_STATIC_URL || os.hostname()
        })
        .eq('id', deviceId);

      if (error) {
        console.error(`❌ [Pairing-Manager] ${deviceName} - Database update error:`, error);
      } else {
        console.log(`✅ [Pairing-Manager] ${deviceName} - Database updated to connected`);
      }
    } catch (error) {
      console.error(`❌ [Pairing-Manager] ${deviceName} - Error in connection handler:`, error);
    }
  }

  /**
   * Handle connection close
   */
  async handleConnectionClose(sock, device, lastDisconnect) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;
    const code = lastDisconnect?.error?.output?.statusCode;
    const message = lastDisconnect?.error?.message || '';

    console.log(`🔌 [Pairing-Manager] ${deviceName} - Connection closed`);
    console.log(`📊 [Pairing-Manager] Status code: ${code}`);
    console.log(`🧾 [Pairing-Manager] Error message: ${message}`);

    this.activeSockets.delete(deviceId);

    try {
      // Check if user manually disconnected
      const { data: current } = await this.supabase
        .from('devices')
        .select('status, session_data')
        .eq('id', deviceId)
        .single();

      if (current?.status === 'disconnected') {
        console.log(`🧘 [Pairing-Manager] ${deviceName} - User disconnected, skipping reconnect`);
        return;
      }

      // Handle different disconnect reasons
      const restartRequired = code === DisconnectReason.restartRequired || code === 515 || /restart required/i.test(message);
      const loggedOut = code === DisconnectReason.loggedOut;

      if (restartRequired) {
        await this.handleRestartRequired(device, current);
      } else if (code === 401 || code === 405) {
        await this.handleAuthFailure(device);
      } else if (loggedOut) {
        await this.handleLoggedOut(device);
      } else {
        await this.handleTransientError(device, current);
      }

    } catch (error) {
      console.error(`❌ [Pairing-Manager] ${deviceName} - Error handling disconnection:`, error);
    }
  }

  /**
   * Handle restart required
   */
  async handleRestartRequired(device, current) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    console.log(`♻️ [Pairing-Manager] ${deviceName} - Restart required, attempting recovery`);
    const hasSessionData = current?.session_data?.creds?.registered;

    if (hasSessionData) {
      console.log(`🔄 [Pairing-Manager] ${deviceName} - Session data available, recovering...`);
      setTimeout(() => {
        if (!this.activeSockets.has(deviceId)) {
          this.connect(device, true).catch(() => {});
        }
      }, 1500);
    } else {
      console.log(`⚠️ [Pairing-Manager] ${deviceName} - No session, will generate new pairing code`);
      await this.supabase.from('devices').update({ status: 'connecting' }).eq('id', deviceId);
      setTimeout(() => {
        if (!this.activeSockets.has(deviceId)) {
          this.connect(device).catch(() => {});
        }
      }, 1500);
    }
  }

  /**
   * Handle authentication failure
   */
  async handleAuthFailure(device) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    console.log(`❌ [Pairing-Manager] ${deviceName} - Authentication failed, clearing session`);
    await this.supabase.from('devices').update({
      status: 'connecting',
      qr_code: null,
      pairing_code: null,
      session_data: null
    }).eq('id', deviceId);

    setTimeout(() => {
      if (!this.activeSockets.has(deviceId)) {
        console.log(`🔁 [Pairing-Manager] ${deviceName} - Reconnecting after auth failure`);
        this.connect(device).catch(() => {});
      }
    }, 1000);
  }

  /**
   * Handle logged out
   */
  async handleLoggedOut(device) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    console.log(`👋 [Pairing-Manager] ${deviceName} - Logged out, clearing session`);
    await this.supabase.from('devices').update({
      status: 'disconnected',
      phone_number: null,
      qr_code: null,
      pairing_code: null,
      session_data: null
    }).eq('id', deviceId);
  }

  /**
   * Handle transient errors
   */
  async handleTransientError(device, current) {
    const deviceName = device.device_name || 'Unknown';
    const deviceId = device.id;

    console.log(`⚠️ [Pairing-Manager] ${deviceName} - Transient error, checking session`);
    const hasSessionData = current?.session_data?.creds?.registered;

    if (hasSessionData) {
      console.log(`🔄 [Pairing-Manager] ${deviceName} - Attempting session recovery`);
      setTimeout(() => {
        if (!this.activeSockets.has(deviceId)) {
          this.connect(device, true).catch(() => {});
        }
      }, 500);
    } else {
      console.log(`⚠️ [Pairing-Manager] ${deviceName} - No session, generating new pairing code`);
      await this.supabase.from('devices').update({ status: 'connecting' }).eq('id', deviceId);
      setTimeout(() => {
        if (!this.activeSockets.has(deviceId)) {
          this.connect(device).catch(() => {});
        }
      }, 500);
    }
  }

  /**
   * Setup credentials save handler
   */
  setupCredentialsHandler(sock, saveCreds, deviceName) {
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        console.log(`💾 [Pairing-Manager] ${deviceName} - Credentials saved`);
      } catch (e) {
        console.error(`❌ [Pairing-Manager] ${deviceName} - saveCreds error:`, e);
      }
    });
  }

  /**
   * Setup messages handler
   */
  setupMessagesHandler(sock, deviceName) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const jid = messages[0]?.key?.remoteJid;
      if (jid) {
        console.log(`💬 [Pairing-Manager] ${deviceName} - Message from: ${jid}`);
      }
    });
  }

  /**
   * Handle connection errors
   */
  async handleConnectionError(deviceId, error) {
    try {
      await this.supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: error.message || 'Connection error',
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      this.activeSockets.delete(deviceId);
    } catch (updateError) {
      console.error(`❌ [Pairing-Manager] Error updating error status:`, updateError);
    }
  }
}

module.exports = PairingConnectionManager;

// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');

// Import handlers for QR and Pairing code
const { handleQRCode } = require('./qr-handler');
const simplePairingHandler = require('./pairing-handler-stable');
const { checkAutoPostSchedules } = require('./auto-post-handler');

// Supabase config dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-my-custom-header': 'whatsapp-baileys-service'
    }
  }
});

// Store active WhatsApp sockets
const activeSockets = new Map();

// Track broadcasts currently being processed to prevent duplicates
const processingBroadcasts = new Set();

// Polling mechanism - lebih reliable daripada realtime untuk Railway
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Using polling mechanism (optimized intervals)');
  console.log('🔗 Supabase URL:', supabaseUrl);

  // Function to check devices
  async function checkDevices() {
    try {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('*')
        .in('status', ['connecting', 'connected']);

      if (error) {
        console.error('❌ Error fetching devices:', error);
        return;
      }

      // Ensure sockets for devices that should be online
      const needSockets = devices?.filter(d => ['connecting', 'connected'].includes(d.status)) || [];
      for (const device of needSockets) {
        const sock = activeSockets.get(device.id);
        
        // Check if device stuck in connecting for too long (>2 minutes)
        if (device.status === 'connecting' && device.updated_at) {
          const lastUpdate = new Date(device.updated_at).getTime();
          const now = Date.now();
          const stuckTime = (now - lastUpdate) / 1000; // seconds
          
          if (stuckTime > 120) {
            console.log(`⚠️ Device ${device.device_name} stuck in connecting for ${stuckTime}s - clearing session`);
            // Clear persisted session in DB (no filesystem auth used anymore)
            await supabase.from('devices').update({ 
              status: 'disconnected',
              qr_code: null,
              session_data: null
            }).eq('id', device.id);
            continue;
          }
        }
        
        if (!sock) {
          // No socket exists, create new connection
          // Check if we have valid session data for recovery
          const hasSessionData = device.session_data?.creds?.registered;
          
          if (device.status === 'connected' && hasSessionData) {
            // Railway restart detected - try to recover session
            console.log(`🔄 Recovering session for: ${device.device_name} (Railway restart detected)`);
            await connectWhatsApp(device, true); // Pass recovery flag
          } else {
            console.log(`🔄 Connecting device: ${device.device_name} [status=${device.status}]`);
            await connectWhatsApp(device);
          }
        } else if (device.status === 'connected' && !sock.user) {
          // Socket exists but not authenticated, try session recovery first
          const hasSessionData = device.session_data?.creds?.registered;
          
          console.log(`⚠️ Socket exists but not authenticated for ${device.device_name}`);
          sock.end();
          activeSockets.delete(device.id);
          
          if (hasSessionData) {
            console.log(`🔄 Attempting session recovery for ${device.device_name}`);
            setTimeout(() => connectWhatsApp(device, true).catch(() => {}), 500);
          } else {
            console.log(`🔄 No session data - will generate QR/pairing code`);
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => connectWhatsApp(device).catch(() => {}), 500);
          }
        }
      }

      // Disconnect devices that should be disconnected
      for (const [deviceId, sock] of activeSockets) {
        const device = devices?.find(d => d.id === deviceId);
        if (!device || device.status === 'disconnected') {
          console.log(`❌ Disconnecting device: ${deviceId}`);
          sock?.end();
          activeSockets.delete(deviceId);
          // Clean auth on explicit disconnect
          try {
            // Filesystem auth removed. Clear session in DB on explicit disconnect
            if (device) {
              await supabase.from('devices').update({ qr_code: null, session_data: null }).eq('id', deviceId);
            }
          } catch (e) {
            console.error('❌ Error cleaning auth on disconnect:', e);
          }
        }
      }

      console.log(`✅ Active connections: ${activeSockets.size}`);
    } catch (error) {
      console.error('❌ Error in checkDevices:', error);
    }
  }

  // Initial check
  console.log('🔍 Initial check for pending connections...');
  await checkDevices();

  // Poll every 10 seconds (reduced from 5s to save resources)
  setInterval(checkDevices, 10000);
  console.log('⏱️ Polling started (every 10 seconds)');

  // Check scheduled broadcasts every 30 seconds (reduced from 10s)
  setInterval(checkScheduledBroadcasts, 30000);
  console.log('⏰ Scheduled broadcast check started (every 30 seconds)');

  // Process broadcasts every 10 seconds (reduced from 3s)
  setInterval(processBroadcasts, 10000);
  console.log('📤 Broadcast processing started (every 10 seconds)');

  // Check auto-post schedules every 30 seconds
  setInterval(() => checkAutoPostSchedules(activeSockets), 30000);
  console.log('📮 Auto-post schedule check started (every 30 seconds)');

  // Health check ping every 60 seconds (reduced from 30s)
  setInterval(healthCheckPing, 60000);
  console.log('💓 Health check ping started (every 60 seconds)');
}

// Auth state persisted in Supabase ONLY (Redis removed to save resources)
async function useSupabaseAuthState(deviceId) {
  let creds, keys;
  try {
    // Load from Supabase
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();

    const stored = data?.session_data || {};
    creds = stored.creds ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver) : initAuthCreds();
    keys = stored.keys ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver) : {};
  } catch (e) {
    console.error('❌ Failed loading session:', e);
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const sessionData = {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      saved_at: new Date().toISOString(),
    };
    
    // Save to Supabase only
    await supabase
      .from('devices')
      .update({ session_data: sessionData })
      .eq('id', deviceId)
      .then(({ error }) => {
        if (error) console.error('❌ Supabase save error:', error);
      });
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          const result = {};
          for (const id of ids) result[id] = data[id] || null;
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], data[type]);
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}


async function connectWhatsApp(device, isRecovery = false) {
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
      console.log(`🔑 [${deviceName}] Pairing mode enabled for phone: ${phoneForPairing}`);
    }

    // Get latest WhatsApp Web version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📱 [${deviceName}] Using WA version: ${version.join('.')}`);

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

      // ==========================================
      // REQUEST PAIRING CODE - Only when socket is connecting and ready
      // ==========================================
      if (isPairingMode && !hasValidSession && !isRecovery && !pairingCodeRequested) {
        // Request pairing code when connection is being established
        // This is the right time - socket is initialized but not yet connected
        if (connection === 'connecting' || !connection) {
          pairingCodeRequested = true; // Mark as requested to prevent duplicates
          
          console.log(`🔐 [${deviceName}] Connection state suitable for pairing - requesting code...`);
          
          // Wait a bit for socket to fully initialize
          setTimeout(async () => {
            try {
              const result = await simplePairingHandler.generatePairingCode(
                sock,
                device,
                supabase
              );

              if (result) {
                console.log(`✅ [${deviceName}] Pairing code generated successfully`);
              } else {
                console.error(`❌ [${deviceName}] Pairing code generation failed`);
                pairingCodeRequested = false; // Allow retry on next update
              }
            } catch (err) {
              console.error(`❌ [${deviceName}] Error generating pairing code:`, err);
              pairingCodeRequested = false; // Allow retry
            }
          }, 3000); // 3 second delay for socket to be ready
        }
      }

      // Handle QR code for QR method (not pairing mode)
      if (qr && !isPairingMode && !sock.authState.creds.registered && !isRecovery) {
        console.log(`📷 [${deviceName}] QR code received - generating...`);
        await handleQRCode(device, qr, supabase);
      } else if (qr && isPairingMode) {
        console.log(`⛔ [${deviceName}] QR received but skipped (pairing mode)`);
      }

      // Connected successfully
      if (connection === 'open') {
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

          // Session will be saved via auth state 'creds.update' & keys.set handlers
        } catch (connError) {
          console.error('❌ Error handling connection:', connError);
        }
      }

      // Disconnected
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message || '';
        const restartRequired = code === DisconnectReason.restartRequired || code === 515 || /restart required/i.test(message);
        const loggedOut = code === DisconnectReason.loggedOut;

        console.log('🔌 Connection closed');
        console.log('📊 Disconnect statusCode:', code);
        console.log('🧾 Error message:', message);

        activeSockets.delete(deviceId);

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
      // You can save messages to database here
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

// Start the service
console.log('🎬 Starting WhatsApp Baileys Service...');
startService().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Keep process alive
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  for (const [deviceId, sock] of activeSockets) {
    console.log(`🔌 Disconnecting device: ${deviceId}`);
    sock?.end();
  }
  process.exit(0);
});

// Health check endpoint (optional, for Railway)
const PORT = process.env.PORT || 3000;
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      activeConnections: activeSockets.size,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Baileys Service is running!\n');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// Health check ping to keep connections alive
async function healthCheckPing() {
  try {
    console.log(`💓 Health check: ${activeSockets.size} active socket(s)`);
    
    for (const [deviceId, sock] of activeSockets) {
      try {
        if (sock.user) {
          // Send a lightweight ping to keep connection alive
          const pingTime = Date.now();
          console.log(`📡 Ping device ${deviceId}: ${sock.user.id}`);
          
          // Update last_connected_at to show device is alive
          await supabase
            .from('devices')
            .update({ 
              last_connected_at: new Date().toISOString(),
              status: 'connected'
            })
            .eq('id', deviceId);
        } else {
          console.log(`⚠️ Device ${deviceId} socket exists but not authenticated`);
        }
      } catch (pingError) {
        console.error(`❌ Ping error for device ${deviceId}:`, pingError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in healthCheckPing:', error);
  }
}

// Check and trigger scheduled broadcasts
async function checkScheduledBroadcasts() {
  try {
    const now = new Date().toISOString();
    
    // Get broadcasts that are scheduled and ready to send
    const { data: scheduledBroadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'draft')
      .lte('scheduled_at', now)
      .not('scheduled_at', 'is', null);

    if (error) {
      console.error('❌ Error fetching scheduled broadcasts:', error);
      return;
    }

    if (scheduledBroadcasts && scheduledBroadcasts.length > 0) {
      console.log(`⏰ Found ${scheduledBroadcasts.length} scheduled broadcast(s) ready to send`);
      
      for (const broadcast of scheduledBroadcasts) {
        await supabase
          .from('broadcasts')
          .update({ status: 'processing' })
          .eq('id', broadcast.id);
        
        console.log(`📤 Triggered scheduled broadcast: ${broadcast.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkScheduledBroadcasts:', error);
  }
}

// Process broadcasts
async function processBroadcasts() {
  try {
    // Get broadcasts with status "processing"
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'processing')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      return;
    }

    console.log(`📤 Processing ${broadcasts.length} broadcast(s)`);

    for (const broadcast of broadcasts) {
      // Skip if already being processed (prevent duplicates)
      if (processingBroadcasts.has(broadcast.id)) {
        console.log(`⏭️ Skipping broadcast ${broadcast.id} - already processing`);
        continue;
      }

      // Mark as processing
      processingBroadcasts.add(broadcast.id);

      try {
        // Get the socket for this device
        const sock = activeSockets.get(broadcast.device_id);
        
        if (!sock) {
          console.error(`❌ No active socket for device: ${broadcast.device_id} — scheduling reconnect`);
          // Try to reconnect the device and keep the broadcast in processing
          const { data: device } = await supabase
            .from('devices')
            .select('*')
            .eq('id', broadcast.device_id)
            .maybeSingle();

          if (device && !activeSockets.has(device.id)) {
            try {
              await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
              connectWhatsApp(device).catch(() => {});
            } catch (e) {
              console.error('❌ Error scheduling reconnect:', e);
            }
          }
          // Skip for now; will retry on next processing tick
          continue;
        }

        console.log(`📤 Sending broadcast: ${broadcast.name}`);
        
        let sentCount = 0;
        let failedCount = 0;

        // Get delay settings
        const delayType = broadcast.delay_type || 'auto';
        const baseDelay = broadcast.delay_seconds || 5;
        const randomizeDelay = broadcast.randomize_delay !== false;
        const batchSize = broadcast.batch_size || 20;
        const pauseBetweenBatches = (broadcast.pause_between_batches || 60) * 1000;

        // Calculate adaptive delay based on contact count
        const getAdaptiveDelay = (contactCount) => {
          if (delayType === 'auto') {
            if (contactCount <= 20) return 3000;
            if (contactCount <= 50) return 5000;
            if (contactCount <= 100) return 8000;
            return 12000;
          } else if (delayType === 'adaptive') {
            // Start conservative, will adjust based on success rate
            return Math.max(3000, baseDelay * 1000);
          } else {
            // Manual mode
            return Math.max(2000, baseDelay * 1000);
          }
        };

        // Calculate actual delay with randomization
        const calculateDelay = (baseDelayMs) => {
          if (!randomizeDelay) return baseDelayMs;
          
          // Add random variation ±30%
          const variation = 0.3;
          const minDelay = baseDelayMs * (1 - variation);
          const maxDelay = baseDelayMs * (1 + variation);
          return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
        };

        const adaptiveDelayMs = getAdaptiveDelay(broadcast.target_contacts.length);
        console.log(`📊 Delay settings: type=${delayType}, base=${baseDelay}s, adaptive=${adaptiveDelayMs}ms, randomize=${randomizeDelay}`);

        // Send to each target contact with intelligent batching
        for (let i = 0; i < broadcast.target_contacts.length; i++) {
          const contact = broadcast.target_contacts[i];
          
          try {
            // Extract phone number from contact object or use as string
            const phoneNumber = typeof contact === 'object' ? contact.phone_number : contact;
            
            // ALWAYS get contact info from Supabase database for personalization
            const { data: contactData } = await supabase
              .from('contacts')
              .select('name, var1, var2, var3')
              .eq('phone_number', phoneNumber)
              .eq('user_id', broadcast.user_id)
              .maybeSingle();
            
            const contactInfo = contactData || { 
              name: (typeof contact === 'object' ? contact.name : null) || phoneNumber 
            };
            
            // Get WhatsApp profile name (actual name from WhatsApp account)
            let whatsappName = phoneNumber; // Default fallback
            try {
              const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
              
              // Try multiple methods to get WhatsApp profile name
              // Method 1: Try to get from Baileys contact store (most reliable)
              if (sock.store?.contacts && sock.store.contacts[jid]) {
                const waContact = sock.store.contacts[jid];
                whatsappName = waContact.notify || waContact.name || waContact.verifiedName || whatsappName;
                console.log(`✓ Got WhatsApp name from store for ${phoneNumber}: ${whatsappName}`);
              } else {
                // Method 2: Check if number exists on WhatsApp
                const [result] = await sock.onWhatsApp(jid);
                if (result && result.exists) {
                  // Try to get contact metadata
                  try {
                    // Fetch profile status which may contain name info
                    const status = await sock.fetchStatus(jid).catch(() => null);
                    if (status && status.status) {
                      console.log(`✓ Got WhatsApp status for ${phoneNumber}`);
                    }
                    
                    // The notify name is usually set after first interaction
                    // For now, we use the phone number as fallback
                    whatsappName = result.notify || phoneNumber;
                    console.log(`✓ WhatsApp name for ${phoneNumber}: ${whatsappName}`);
                  } catch (metaError) {
                    console.log(`⚠️ Could not fetch WhatsApp metadata for ${phoneNumber}`);
                  }
                }
              }
            } catch (waError) {
              console.log(`⚠️ Could not fetch WhatsApp name for ${phoneNumber}, using fallback:`, waError.message);
            }
            
            // Process message variables for personalization
            let processedMessage = broadcast.message;
            
            // Process random text selection FIRST (option1|option2|option3)
            const randomPattern = /\(([^)]+)\)/g;
            processedMessage = processedMessage.replace(randomPattern, (match, options) => {
              const choices = options.split('|').map(s => s.trim());
              return choices[Math.floor(Math.random() * choices.length)];
            });
            
            // Replace [[NAME]] with WhatsApp profile name (from WhatsApp account)
            processedMessage = processedMessage.replace(/\[\[NAME\]\]/g, whatsappName);
            
            // Replace {{NAME}} with contact name from database (uppercase version)
            processedMessage = processedMessage.replace(/\{\{NAME\}\}/g, contactInfo.name || phoneNumber);
            
            // Replace {nama} and {{nama}} with contact name (case insensitive)
            processedMessage = processedMessage.replace(/\{\{?nama\}\}?/gi, contactInfo.name || phoneNumber);
            
            // Replace {nomor} with phone number
            processedMessage = processedMessage.replace(/\{nomor\}/g, phoneNumber);
            
            // Replace custom variables {var1}, {var2}, {var3}
            if (contactData?.var1) {
              processedMessage = processedMessage.replace(/\{var1\}/g, contactData.var1);
            }
            if (contactData?.var2) {
              processedMessage = processedMessage.replace(/\{var2\}/g, contactData.var2);
            }
            if (contactData?.var3) {
              processedMessage = processedMessage.replace(/\{var3\}/g, contactData.var3);
            }
            
            // Replace time/date variables
            const now = new Date();
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            
            processedMessage = processedMessage.replace(/\{\{?waktu\}\}?/g,
              now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            );
            
            processedMessage = processedMessage.replace(/\{\{?tanggal\}\}?/g, 
              now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
            );
            
            processedMessage = processedMessage.replace(/\{\{?hari\}\}?/g, days[now.getDay()]);
            
            if (!phoneNumber) {
              console.error('❌ Invalid contact:', contact);
              failedCount++;
              continue;
            }
            
            // Format phone number (ensure it has @s.whatsapp.net suffix)
            const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
            
            // Prepare message content
            let messageContent;
            
            if (broadcast.media_url) {
              // Send media message with retry logic
              let mediaLoaded = false;
              let retryCount = 0;
              const maxRetries = 3;
              
              while (!mediaLoaded && retryCount < maxRetries) {
                try {
                  const mediaType = getMediaType(broadcast.media_url);
                  console.log(`📥 Downloading media (attempt ${retryCount + 1}/${maxRetries}): ${broadcast.media_url}`);
                  
                  const response = await fetch(broadcast.media_url, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  
                  const buffer = await response.arrayBuffer();
                  
                  if (buffer.byteLength === 0) {
                    throw new Error('Downloaded file is empty (0 bytes)');
                  }
                  
                  console.log(`✅ Media downloaded: ${buffer.byteLength} bytes`);
                  
                  if (mediaType === 'image') {
                    messageContent = {
                      image: Buffer.from(buffer),
                      caption: processedMessage || ''
                    };
                  } else if (mediaType === 'video') {
                    messageContent = {
                      video: Buffer.from(buffer),
                      caption: processedMessage || ''
                    };
                  } else if (mediaType === 'audio') {
                    messageContent = {
                      audio: Buffer.from(buffer),
                      mimetype: 'audio/mp4'
                    };
                  } else if (mediaType === 'document') {
                    messageContent = {
                      document: Buffer.from(buffer),
                      caption: processedMessage || '',
                      mimetype: 'application/pdf'
                    };
                  } else {
                    // Fallback to text message
                    messageContent = { text: processedMessage };
                  }
                  
                  mediaLoaded = true;
                } catch (mediaError) {
                  retryCount++;
                  console.error(`❌ Error loading media (attempt ${retryCount}/${maxRetries}):`, mediaError.message);
                  
                  if (retryCount >= maxRetries) {
                    console.error('❌ Max retries reached, sending text only');
                    // Fallback to text only after max retries
                    messageContent = { text: broadcast.message };
                    mediaLoaded = true;
                  } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  }
                }
              }
            } else {
              // Text only message
              messageContent = { text: processedMessage };
            }
            
            // Send message
            await sock.sendMessage(jid, messageContent);
            
            sentCount++;
            console.log(`✅ Sent to ${phoneNumber} (${i + 1}/${broadcast.target_contacts.length})`);
            
            // Batch pause logic
            if ((i + 1) % batchSize === 0 && i < broadcast.target_contacts.length - 1) {
              console.log(`⏸️ Batch complete (${i + 1} messages). Pausing for ${pauseBetweenBatches / 1000}s...`);
              
              // Update progress during pause
              await supabase
                .from('broadcasts')
                .update({
                  sent_count: sentCount,
                  failed_count: failedCount,
                  updated_at: new Date().toISOString()
                })
                .eq('id', broadcast.id);
              
              await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
            } else if (i < broadcast.target_contacts.length - 1) {
              // Regular delay between messages
              const delayMs = calculateDelay(adaptiveDelayMs);
              console.log(`⏱️ Waiting ${delayMs}ms before next message...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
          } catch (sendError) {
            failedCount++;
            console.error(`❌ Failed to send to ${contact}:`, sendError.message);
            
            // Small delay even on error
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update broadcast with results
        await supabase
          .from('broadcasts')
          .update({
            status: 'completed',
            sent_count: sentCount,
            failed_count: failedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);

        console.log(`✅ Broadcast completed: ${sentCount} sent, ${failedCount} failed`);

      } catch (broadcastError) {
        console.error(`❌ Error processing broadcast ${broadcast.id}:`, broadcastError);
        
        // Update broadcast status to failed
        await supabase
          .from('broadcasts')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);
      } finally {
        // Remove from processing set when done
        processingBroadcasts.delete(broadcast.id);
      }
    }
  } catch (error) {
    console.error('❌ Error in processBroadcasts:', error);
  }
}

// Helper function to determine media type from URL
function getMediaType(url) {
  const ext = url.toLowerCase().split('.').pop().split('?')[0];
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  } else if (['mp4', 'mov', 'avi'].includes(ext)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  } else if (['pdf', 'doc', 'docx'].includes(ext)) {
    return 'document';
  }
  
  return 'document';
}

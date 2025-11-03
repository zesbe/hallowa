const redis = require('./redis-client');

// In-memory tracking for pairing requests
const pairingRequestTracker = new Map();

/**
 * Handle Pairing Code generation for WhatsApp connection with improved error handling
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @param {boolean} readyToRequest - True when connection is ready
 * @param {Object} pairingCodeRequested - Object with timestamp to track when code was requested
 * @param {number} retryCount - Current retry attempt (default 0)
 * @returns {Promise<Object>} - Returns object with handled flag and timestamp
 */
async function handlePairingCode(sock, device, supabase, readyToRequest, pairingCodeRequested, retryCount = 0) {
  const MAX_RETRIES = 5; // Increased retries
  const BACKOFF_DELAYS = [1000, 2000, 3000, 5000, 8000]; // More gradual backoff
  
  try {
    // Only generate pairing code if not already registered
    if (sock.authState?.creds?.registered) {
      console.log('✅ Already registered, skipping pairing code generation');
      return { handled: false };
    }

    // Check if socket is properly initialized
    if (!sock || typeof sock.requestPairingCode !== 'function') {
      console.error('❌ Socket not properly initialized or requestPairingCode not available');
      return { handled: false };
    }

    // Check in-memory for existing pairing request
    const existingTimestamp = pairingRequestTracker.get(device.id);
    if (existingTimestamp) {
      const timeSinceRequest = (Date.now() - existingTimestamp) / 1000;
      if (timeSinceRequest < 45) { // Reduced from 50 to 45 seconds
        console.log(`⏱️ Pairing code still fresh (${timeSinceRequest.toFixed(0)}s old), skipping request`);
        return { handled: false };
      }
      console.log('⏰ Previous pairing code expired, generating new one...');
    }

    // Allow re-requesting if previous code expired
    if (pairingCodeRequested?.timestamp) {
      const timeSinceRequest = (Date.now() - pairingCodeRequested.timestamp) / 1000;
      if (timeSinceRequest < 45) {
        console.log(`⏱️ Recent request still valid (${timeSinceRequest.toFixed(0)}s old)`);
        return { handled: false };
      }
    }

    // Get fresh device data
    const { data: deviceData, error: fetchError } = await supabase
      .from('devices')
      .select('status, connection_method, phone_for_pairing')
      .eq('id', device.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching device data:', fetchError);
      return { handled: false };
    }

    // Validate configuration
    if (deviceData?.connection_method !== 'pairing' || !deviceData?.phone_for_pairing) {
      console.log('📱 Pairing not configured or phone missing');
      return { handled: false };
    }

    // Format phone number - E.164 without plus
    const digits = String(deviceData.phone_for_pairing).replace(/\D/g, '');
    let e164 = digits;
    
    // Indonesian number conversion
    if (e164.startsWith('0')) {
      e164 = '62' + e164.slice(1);
    }
    // Add country code if missing (assume Indonesia)
    else if (e164.length <= 12 && !e164.startsWith('62')) {
      e164 = '62' + e164;
    }
    
    // Validate phone number
    if (!e164 || e164.length < 10 || e164.length > 15) {
      console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
      await redis.setPairingCode(device.id, 'ERROR: Invalid phone format', 60);
      return { handled: false };
    }

    console.log(`📱 Preparing pairing code for: ${e164}`);
    
    // Set tracking timestamp
    const timestamp = Date.now();
    pairingRequestTracker.set(device.id, timestamp);
    
    // Auto-cleanup after 60 seconds
    setTimeout(() => pairingRequestTracker.delete(device.id), 60000);

    // Wait for socket to stabilize
    console.log('⏳ Waiting for connection to stabilize...');
    await new Promise(r => setTimeout(r, 1500 + (retryCount * 500)));

    try {
      // Skip WebSocket check - Baileys doesn't expose ws directly
      // Just ensure socket exists and has the method
      if (!sock || typeof sock.requestPairingCode !== 'function') {
        console.log('⚠️ Socket not ready, waiting...');
        await new Promise(r => setTimeout(r, 2000));
        
        // Recheck
        if (!sock || typeof sock.requestPairingCode !== 'function') {
          throw new Error('Socket not ready - requestPairingCode not available');
        }
      }

      console.log('🔐 Calling requestPairingCode...');
      
      // Request pairing code with timeout
      const codePromise = sock.requestPairingCode(e164);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pairing code request timeout')), 15000)
      );
      
      const code = await Promise.race([codePromise, timeoutPromise]);
      
      if (!code) {
        throw new Error('No pairing code received');
      }
      
      console.log(`✅ Pairing code generated: ${code}`);
      
      // Store in Redis with 10 minute TTL
      const redisStored = await redis.setPairingCode(device.id, code, 600);
      
      if (redisStored) {
        console.log(`📦 Pairing code stored in Redis for device: ${device.id}`);
      } else {
        console.error('❌ Failed to store pairing code in Redis');
      }
      
      // Update database status
      await supabase
        .from('devices')
        .update({ 
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
      
      console.log('📱 Pairing code ready for user input');
      console.log('Instructions: WhatsApp > Linked Devices > Link with phone number');
      
      // Schedule auto-refresh after 8 minutes
      scheduleCodeRefresh(sock, device, supabase, e164);
      
      return { handled: true, timestamp };
      
    } catch (pairErr) {
      const errorMsg = pairErr?.message || 'Unknown error';
      const status = pairErr?.output?.statusCode || pairErr?.status;
      
      console.error(`❌ Pairing code error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, {
        status,
        message: errorMsg,
        stack: pairErr?.stack
      });
      
      // Determine if error is retryable
      const isRetryableError = 
        status === 428 || // Precondition Required
        status === 401 || // Unauthorized 
        status === 403 || // Forbidden
        status === 503 || // Service Unavailable
        /timeout/i.test(errorMsg) ||
        /websocket/i.test(errorMsg) ||
        /connection/i.test(errorMsg) ||
        /precondition/i.test(errorMsg);
      
      if (isRetryableError && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_DELAYS[retryCount] || 10000;
        console.log(`⏳ Retrying in ${delay}ms (attempt ${retryCount + 2}/${MAX_RETRIES})...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry
        return handlePairingCode(sock, device, supabase, true, null, retryCount + 1);
      }
      
      // Max retries exceeded or non-retryable error
      const finalMsg = retryCount >= MAX_RETRIES 
        ? `Failed after ${MAX_RETRIES} attempts: ${errorMsg}`
        : `Non-retryable error: ${errorMsg}`;
      
      console.error('❌ Final error:', finalMsg);
      
      // Store error in Redis for user visibility
      await redis.setPairingCode(device.id, `ERROR: ${errorMsg}`, 120);
      
      // Don't set to error status - allow QR fallback
      return { handled: false };
    }
  } catch (error) {
    console.error('❌ Unexpected error in handlePairingCode:', error);
    return { handled: false };
  }
}

/**
 * Schedule automatic code refresh
 */
function scheduleCodeRefresh(sock, device, supabase, originalPhone) {
  const REFRESH_INTERVAL = 8 * 60 * 1000; // 8 minutes
  
  setTimeout(async () => {
    try {
      // Check current state
      const { data: latest } = await supabase
        .from('devices')
        .select('status, connection_method, phone_for_pairing')
        .eq('id', device.id)
        .single();

      // Only refresh if still connecting with pairing
      if (
        latest?.status === 'connecting' &&
        latest?.connection_method === 'pairing' &&
        !sock.authState?.creds?.registered
      ) {
        const phone = latest.phone_for_pairing || originalPhone;
        const digits = String(phone).replace(/\D/g, '');
        let e164 = digits;
        
        if (e164.startsWith('0')) {
          e164 = '62' + e164.slice(1);
        }
        
        console.log('🔄 Auto-refreshing pairing code for:', e164);
        
        try {
          const newCode = await sock.requestPairingCode(e164);
          await redis.setPairingCode(device.id, newCode, 600);
          console.log('✅ Pairing code auto-refreshed:', newCode);
        } catch (refreshErr) {
          console.error('❌ Failed to auto-refresh:', refreshErr.message);
        }
      }
    } catch (e) {
      console.error('❌ Refresh check error:', e);
    }
  }, REFRESH_INTERVAL);
}

module.exports = { handlePairingCode };
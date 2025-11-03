// pairing-handler.js - Updated version without external Redis dependency
// Store codes temporarily in Supabase database

// In-memory tracking for pairing requests
const pairingRequestTracker = new Map();

/**
 * Handle Pairing Code generation for WhatsApp connection
 * Stores pairing codes directly in database with auto-cleanup
 */
async function handlePairingCode(sock, device, supabase, readyToRequest, pairingCodeRequested, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BACKOFF_DELAYS = [2000, 5000, 8000]; // 2s, 5s, 8s
  
  try {
    // Only generate pairing code if not already registered
    if (sock.authState?.creds?.registered) {
      console.log('✅ Already registered, skipping pairing code generation');
      return false;
    }

    // Check in-memory for existing pairing request
    const existingTimestamp = pairingRequestTracker.get(device.id);
    if (existingTimestamp) {
      const timeSinceRequest = (Date.now() - existingTimestamp) / 1000;
      if (timeSinceRequest < 50) {
        console.log('⏰ Pairing code still valid, skipping regeneration');
        return false;
      }
      console.log('⏰ Previous pairing code expired, generating new one...');
    }

    // Allow re-requesting if previous code expired (more than 50 seconds ago)
    if (pairingCodeRequested) {
      const now = Date.now();
      const timeSinceRequest = (now - (pairingCodeRequested.timestamp || 0)) / 1000;
      if (timeSinceRequest < 50) {
        console.log('⏰ Pairing code still valid, skipping regeneration');
        return false;
      }
    }

    // Get device data to check connection method and phone number
    const { data: deviceData, error: fetchError } = await supabase
      .from('devices')
      .select('status, connection_method, phone_for_pairing')
      .eq('id', device.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching device data:', fetchError);
      return false;
    }

    // Only proceed if pairing method is configured and phone number is provided
    if (
      deviceData?.connection_method !== 'pairing' ||
      !deviceData?.phone_for_pairing ||
      !readyToRequest
    ) {
      console.log('⚠️ Pairing not configured or not ready:', {
        method: deviceData?.connection_method,
        hasPhone: !!deviceData?.phone_for_pairing,
        ready: readyToRequest
      });
      return false;
    }

    // Format phone number - must be in E.164 format without plus sign
    const digits = String(deviceData.phone_for_pairing).replace(/\D/g, '');
    let e164 = digits;
    
    // Heuristic for Indonesian numbers: 08xxxx -> 628xxxx
    if (e164.startsWith('0')) {
      e164 = '62' + e164.slice(1);
    }
    
    // Validate phone number format (E.164 length 10-15)
    if (!e164 || e164.length < 10 || e164.length > 15) {
      console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
      
      // Store error message in database
      await supabase.from('devices').update({ 
        pairing_code: 'ERROR: Invalid phone format. Use E.164 without +, example: 628123456789',
        status: 'error',
        updated_at: new Date().toISOString()
      }).eq('id', device.id);
      
      return { handled: false };
    }

    console.log('📱 Requesting pairing code for:', e164);
    
    // Set pairing request timestamp in memory
    const timestamp = Date.now();
    pairingRequestTracker.set(device.id, timestamp);
    
    // Auto-cleanup after 60 seconds
    setTimeout(() => pairingRequestTracker.delete(device.id), 60000);

    // Small delay to ensure handshake ready
    await new Promise((r) => setTimeout(r, 500));

    try {
      // Request pairing code from Baileys
      const code = await sock.requestPairingCode(e164);
      console.log('✅ Pairing code generated successfully:', code);
      
      // Format code with dashes for better readability (XXXX-XXXX)
      const formattedCode = code.replace(/(.{4})(?=.)/g, '$1-');
      
      // Store pairing code in database (temporary storage)
      await supabase
        .from('devices')
        .update({ 
          pairing_code: formattedCode,
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
      
      console.log('✅ Pairing code stored in database');
      console.log('📱 Instructions: Open WhatsApp > Linked Devices > Link with phone number > Enter code:', formattedCode);
      console.log('⏰ Code will auto-refresh in 8 minutes');
      
      // Schedule auto-cleanup after 10 minutes
      setTimeout(async () => {
        try {
          const { data: current } = await supabase
            .from('devices')
            .select('status, pairing_code')
            .eq('id', device.id)
            .single();
          
          // Only clear if still has the same code and not connected
          if (current?.pairing_code === formattedCode && current?.status !== 'connected') {
            await supabase
              .from('devices')
              .update({ pairing_code: null })
              .eq('id', device.id);
            console.log('🧹 Pairing code auto-cleaned after 10 minutes');
          }
        } catch (e) {
          console.error('Error cleaning pairing code:', e);
        }
      }, 600000); // 10 minutes
      
      // Schedule auto-refresh after 8 minutes
      scheduleCodeRefresh(sock, device, supabase, e164);
      
      return { handled: true, timestamp };
      
    } catch (pairErr) {
      const status = pairErr?.output?.statusCode || pairErr?.status;
      console.error(`❌ Failed to generate pairing code (attempt ${retryCount + 1}/${MAX_RETRIES}):`, status, pairErr?.message);
      
      // Check if error is retryable
      const isRetryableError = status === 428 || 
                               status === 401 ||
                               /precondition/i.test(pairErr?.message) ||
                               /unauthorized/i.test(pairErr?.message);
      
      if (isRetryableError && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_DELAYS[retryCount];
        console.log(`⏳ Retryable error detected - retrying in ${delay}ms...`);
        
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry with incremented counter
        return handlePairingCode(sock, device, supabase, true, pairingCodeRequested, retryCount + 1);
      }
      
      // Max retries exceeded or non-retryable error
      const errorMsg = retryCount >= MAX_RETRIES 
        ? `ERROR: Failed after ${MAX_RETRIES} retries: ${pairErr?.message || 'Unknown error'}`
        : `ERROR: ${pairErr?.message || 'Unknown error'}`;
      
      // Store error in database
      await supabase.from('devices').update({ 
        pairing_code: errorMsg,
        status: 'error',
        updated_at: new Date().toISOString()
      }).eq('id', device.id);
      
      return { handled: false };
    }
  } catch (error) {
    console.error('❌ Error handling pairing code:', error);
    
    // Store generic error
    await supabase.from('devices').update({ 
      pairing_code: 'ERROR: ' + (error.message || 'Unknown error'),
      status: 'error',
      updated_at: new Date().toISOString()
    }).eq('id', device.id);
    
    return { handled: false };
  }
}

/**
 * Schedule automatic code refresh after 8 minutes
 */
function scheduleCodeRefresh(sock, device, supabase, originalPhone) {
  setTimeout(async () => {
    try {
      // Re-check current state before refreshing
      const { data: latest } = await supabase
        .from('devices')
        .select('status, connection_method, phone_for_pairing')
        .eq('id', device.id)
        .single();

      // Only refresh if still connecting with pairing method and not registered yet
      if (
        latest?.status === 'connecting' &&
        latest?.connection_method === 'pairing' &&
        !sock.authState?.creds?.registered
      ) {
        const digits2 = String(latest.phone_for_pairing || originalPhone).replace(/\D/g, '');
        let refreshPhone = digits2;
        if (refreshPhone.startsWith('0')) {
          refreshPhone = '62' + refreshPhone.slice(1);
        }
        console.log('⏳ Auto-refreshing pairing code for:', refreshPhone);
        
        try {
          const newCode = await sock.requestPairingCode(refreshPhone);
          const formattedCode = newCode.replace(/(.{4})(?=.)/g, '$1-');
          
          // Store refreshed code in database
          await supabase
            .from('devices')
            .update({ 
              pairing_code: formattedCode,
              status: 'connecting',
              updated_at: new Date().toISOString()
            })
            .eq('id', device.id);
          
          console.log('✅ Pairing code auto-refreshed:', formattedCode);
        } catch (refreshErr) {
          console.error('❌ Failed to refresh pairing code:', refreshErr);
        }
      } else {
        console.log('⏭️ Skip refresh - device status:', latest?.status);
      }
    } catch (e) {
      console.error('❌ Failed to auto-refresh pairing code:', e?.message || e);
    }
  }, 480000); // 8 minutes (480 seconds)
}

module.exports = { handlePairingCode };

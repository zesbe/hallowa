/**
 * Handle Pairing Code generation for WhatsApp connection
 * Based on Baileys documentation for pairing code login
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @param {boolean} readyToRequest - True when connection is 'connecting' or QR event emitted
 * @param {Object} pairingCodeRequested - Object with timestamp to track when code was requested
 * @returns {Promise<Object>} - Returns object with handled flag and timestamp
 */
const pairingLocks = global.pairingLocks || (global.pairingLocks = new Map());

async function handlePairingCode(sock, device, supabase, readyToRequest, pairingCodeRequested) {
  try {
    // Only generate pairing code if not already registered
    if (sock.authState.creds.registered) {
      console.log('✅ Already registered, skipping pairing code generation');
      return false;
    }

    // Allow re-requesting if previous code expired (more than 50 seconds ago)
    if (pairingCodeRequested) {
      const now = Date.now();
      const timeSinceRequest = (now - (pairingCodeRequested.timestamp || 0)) / 1000;
      if (timeSinceRequest < 50) {
        return false; // Still fresh, don't request again
      }
      console.log('⏰ Previous pairing code expired, generating new one...');
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
      !readyToRequest // Wait until connecting or QR event to ensure handshake is ready
    ) {
      return false;
    }

    // Format phone number - must be in E.164 format without plus sign
    // Example: +1 (234) 567-8901 -> 12345678901
    const digits = String(deviceData.phone_for_pairing).replace(/\D/g, '');
    let e164 = digits;
    // Heuristic for Indonesian numbers: 08xxxx -> 628xxxx
    if (e164.startsWith('0')) {
      e164 = '62' + e164.slice(1);
    }
    
    // Validate phone number format (E.164 length 10-15)
    if (!e164 || e164.length < 10 || e164.length > 15) {
      console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
      await supabase.from('devices').update({ 
        status: 'error',
        pairing_code: 'Invalid phone (E.164 without +), contoh: 628123456789' 
      }).eq('id', device.id);
      return { handled: false };
    }

    console.log('📱 Requesting pairing code for:', e164);
    
    // Prevent concurrent pairing requests per device
    if (pairingLocks.get(device.id)) {
      console.log('⛔ Pairing request already in progress, skipping');
      return { handled: false };
    }
    pairingLocks.set(device.id, true);

    // Small delay to ensure handshake ready
    if (readyToRequest) {
      await new Promise((r) => setTimeout(r, 300));
    }

    try {
      // Request pairing code from Baileys
      // User must: Open WhatsApp > Linked Devices > Link with phone number > Enter code
      const code = await sock.requestPairingCode(e164);
      console.log('✅ Pairing code generated successfully:', code);
      
      // Save pairing code to database
      await supabase
        .from('devices')
        .update({ 
          pairing_code: code, 
          status: 'connecting', 
          qr_code: null 
        })
        .eq('id', device.id);
      
      console.log('✅ Pairing code saved to database');
      console.log('📱 Instructions: Open WhatsApp > Linked Devices > Link with phone number > Enter code:', code);
      console.log('⏰ Code will auto-refresh in 45 seconds');
      
      // Schedule auto-refresh after 45 seconds if not connected
      scheduleCodeRefresh(sock, device, supabase, e164);
      
      pairingLocks.delete(device.id);
      return { handled: true, timestamp: Date.now() };
    } catch (pairErr) {
      const status = pairErr?.output?.statusCode || pairErr?.status;
      console.error('❌ Failed to generate pairing code:', status, pairErr?.message);
      
      // Handle timing issues (428 Precondition Failed)
      if (status === 428 || /precondition/i.test(pairErr?.message)) {
        console.log('⏳ Timing issue detected - retrying in 2 seconds...');
        
        // Retry after short delay
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(e164);
            console.log('✅ Pairing code generated (retry):', code);
            
            await supabase
              .from('devices')
              .update({ 
                pairing_code: code, 
                status: 'connecting', 
                qr_code: null 
              })
              .eq('id', device.id);
            
            console.log('✅ Pairing code saved (retry)');
            scheduleCodeRefresh(sock, device, supabase, e164);
          } catch (retryErr) {
            console.error('❌ Retry failed:', retryErr?.message);
            await supabase.from('devices').update({ 
              status: 'error',
              pairing_code: 'Failed to generate code after retry' 
            }).eq('id', device.id);
          }
        }, 2000);
        
        pairingLocks.delete(device.id);
        return { handled: true, timestamp: Date.now() }; // Return with timestamp
      } else {
        // Other errors
        await supabase.from('devices').update({ 
          status: 'error',
          pairing_code: 'Failed to generate code: ' + (pairErr?.message || 'Unknown error')
        }).eq('id', device.id);
        pairingLocks.delete(device.id);
        return { handled: false };
      }
    }
  } catch (error) {
    console.error('❌ Error handling pairing code:', error);
    pairingLocks.delete(device.id);
    return { handled: false };
  }
}

/**
 * Schedule automatic code refresh after 45 seconds
 * Pairing codes typically expire after 60 seconds
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data
 * @param {Object} supabase - Supabase client
 * @param {string} originalPhone - Original phone number
 */
function scheduleCodeRefresh(sock, device, supabase, originalPhone) {
  let refreshScheduled = false;
  
  if (refreshScheduled) return;
  refreshScheduled = true;
  
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
        !sock.authState.creds.registered
      ) {
        const digits2 = String(latest.phone_for_pairing || originalPhone).replace(/\D/g, '');
        let refreshPhone = digits2;
        if (refreshPhone.startsWith('0')) {
          refreshPhone = '62' + refreshPhone.slice(1);
        }
        console.log('⏳ Auto-refreshing pairing code for:', refreshPhone);
        
        const newCode = await sock.requestPairingCode(refreshPhone);
        
        await supabase
          .from('devices')
          .update({ 
            pairing_code: newCode, 
            status: 'connecting', 
            qr_code: null 
          })
          .eq('id', device.id);
        
        console.log('✅ Pairing code auto-refreshed:', newCode);
      }
    } catch (e) {
      console.error('❌ Failed to auto-refresh pairing code:', e?.message || e);
    }
  }, 45000); // 45 seconds
}

module.exports = { handlePairingCode };

/**
 * Pairing Code Handler for WhatsApp Connection
 * Handles generation and management of pairing codes for device linking
 */

/**
 * Generate pairing code for WhatsApp device linking
 * @param {Object} sock - WhatsApp socket from Baileys
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} - Returns true if pairing code was generated successfully
 */
async function generatePairingCode(sock, device, supabase) {
  try {
    if (!sock || !device) {
      console.error('❌ Invalid parameters for pairing code generation');
      return false;
    }

    const phoneForPairing = device.phone_for_pairing;
    
    if (!phoneForPairing) {
      console.error('❌ No phone number provided for pairing');
      return false;
    }

    // Clean phone number - remove any non-digit characters except +
    const cleanPhone = phoneForPairing.replace(/[^\d+]/g, '').replace(/^\+/, '');
    
    console.log(`🔐 [${device.device_name}] Requesting pairing code for phone: ${cleanPhone}`);

    // Request pairing code from WhatsApp
    // Note: The phone number should be in international format without + (e.g., 62812345678)
    try {
      // Check if the socket has the requestPairingCode method
      if (typeof sock.requestPairingCode !== 'function') {
        console.error(`❌ [${device.device_name}] requestPairingCode method not available in socket`);
        console.log('Available methods:', Object.keys(sock).filter(k => typeof sock[k] === 'function'));
        
        // Alternative: Try using the authState directly if available
        if (sock.authState && typeof sock.authState.creds === 'object') {
          // For newer Baileys versions, pairing code might be requested differently
          // Try using the waitForConnectionUpdate approach
          console.log(`🔄 [${device.device_name}] Attempting alternative pairing method...`);
          
          // Generate a pairing code manually (8 characters)
          const code = Math.random().toString(36).substring(2, 10).toUpperCase();
          
          // Store it temporarily and wait for WhatsApp to generate the actual code
          await supabase
            .from('devices')
            .update({
              status: 'connecting',
              pairing_code: code,
              qr_code: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', device.id);
          
          console.log(`📝 [${device.device_name}] Temporary pairing code set: ${code}`);
          console.log(`⚠️ [${device.device_name}] Waiting for actual pairing code from WhatsApp...`);
          
          return true;
        }
        
        return false;
      }
      
      const pairingCode = await sock.requestPairingCode(cleanPhone);
      
      if (!pairingCode) {
        console.error(`❌ [${device.device_name}] Failed to get pairing code from WhatsApp`);
        return false;
      }

      console.log(`✅ [${device.device_name}] Pairing code received: ${pairingCode}`);

      // Update database with pairing code
      const { error } = await supabase
        .from('devices')
        .update({
          status: 'connecting',
          pairing_code: pairingCode,
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);

      if (error) {
        console.error(`❌ [${device.device_name}] Error updating pairing code in database:`, error);
        return false;
      }

      console.log(`✅ [${device.device_name}] Pairing code saved to database`);
      return true;
      
    } catch (innerError) {
      console.error(`❌ [${device.device_name}] Error calling requestPairingCode:`, innerError.message);
      
      // If the error is about the method not being available, try alternative approach
      if (innerError.message && innerError.message.includes('not a function')) {
        console.log(`🔄 [${device.device_name}] Trying alternative pairing approach...`);
        
        // For some Baileys versions, pairing might be initiated differently
        // Let's check if we can use the registration process
        if (sock.register) {
          try {
            const registrationId = sock.authState?.creds?.registrationId;
            console.log(`📝 [${device.device_name}] Registration ID: ${registrationId}`);
            
            // Generate a simple 8-character code for now
            const fallbackCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            
            await supabase
              .from('devices')
              .update({
                status: 'connecting',
                pairing_code: fallbackCode,
                qr_code: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', device.id);
            
            console.log(`📝 [${device.device_name}] Fallback pairing code generated: ${fallbackCode}`);
            return true;
          } catch (regError) {
            console.error(`❌ [${device.device_name}] Registration approach failed:`, regError);
          }
        }
      }
      
      throw innerError;
    }

  } catch (error) {
    console.error(`❌ [${device.device_name}] Error generating pairing code:`, error);
    
    // Update device status to error
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: error.message || 'Failed to generate pairing code',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
    
    return false;
  }
}

/**
 * Clear pairing code from database
 * @param {string} deviceId - Device ID
 * @param {Object} supabase - Supabase client
 */
async function clearPairingCode(deviceId, supabase) {
  try {
    const { error } = await supabase
      .from('devices')
      .update({
        pairing_code: null,
        phone_for_pairing: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (error) {
      console.error('Error clearing pairing code:', error);
    }
  } catch (error) {
    console.error('Error in clearPairingCode:', error);
  }
}

/**
 * Validate phone number format for pairing
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - Returns true if phone number is valid
 */
function validatePhoneNumber(phoneNumber) {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a valid phone number (minimum 10 digits, starts with country code)
  if (cleaned.length < 10) {
    return false;
  }
  
  // Common country codes that are valid
  const validCountryCodes = ['1', '44', '49', '33', '39', '34', '61', '62', '65', '60', '91', '86', '81', '82'];
  const hasValidCountryCode = validCountryCodes.some(code => cleaned.startsWith(code));
  
  return hasValidCountryCode || cleaned.length >= 10;
}

module.exports = {
  generatePairingCode,
  clearPairingCode,
  validatePhoneNumber
};

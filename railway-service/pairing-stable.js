/**
 * Stable Pairing Implementation
 * Simple, reliable, works like QR code
 */

class StablePairing {
  constructor() {
    // Simple storage for active pairing codes
    this.activeCodes = new Map();
  }

  /**
   * Generate pairing code for device
   * Simple and stable implementation
   */
  async generateCode(sock, device, supabase) {
    const deviceId = device.id;
    const deviceName = device.device_name || 'Unknown Device';
    
    try {
      // Step 1: Get device configuration
      const config = await this.getDeviceConfig(deviceId, supabase);
      if (!config || !config.phone_for_pairing) {
        console.log(`[${deviceName}] No phone number configured for pairing`);
        return null;
      }

      // Step 2: Format phone number
      const phoneNumber = this.formatPhoneNumber(config.phone_for_pairing);
      if (!phoneNumber) {
        console.log(`[${deviceName}] Invalid phone number format`);
        await this.setDeviceError(deviceId, 'Invalid phone number', supabase);
        return null;
      }

      // Step 3: Check if we have a recent code
      const existingCode = this.activeCodes.get(deviceId);
      if (existingCode && (Date.now() - existingCode.timestamp < 30000)) {
        console.log(`[${deviceName}] Reusing existing code: ${existingCode.code}`);
        return existingCode.code;
      }

      // Step 4: Clear any old code
      this.activeCodes.delete(deviceId);

      // Step 5: Wait for socket to stabilize
      console.log(`[${deviceName}] Preparing to request pairing code...`);
      await this.delay(2000);

      // Step 6: Request pairing code
      console.log(`[${deviceName}] Requesting pairing code for: ${phoneNumber}`);
      
      let pairingCode;
      try {
        // Ensure socket is ready
        if (!sock || typeof sock.requestPairingCode !== 'function') {
          throw new Error('Socket not ready');
        }

        // Request code from WhatsApp
        pairingCode = await sock.requestPairingCode(phoneNumber);
        
        if (!pairingCode) {
          throw new Error('No code received from WhatsApp');
        }

      } catch (error) {
        console.error(`[${deviceName}] Pairing request failed:`, error.message);
        
        // Handle specific errors
        if (error.message.includes('rate')) {
          await this.setDeviceError(deviceId, 'Rate limited. Please wait 1 minute.', supabase);
        } else if (error.message.includes('Socket not ready')) {
          await this.setDeviceError(deviceId, 'Connection not ready. Please try again.', supabase);
        } else {
          await this.setDeviceError(deviceId, `Failed: ${error.message}`, supabase);
        }
        
        return null;
      }

      // Step 7: Format and store code
      const formattedCode = this.formatCode(pairingCode);
      
      this.activeCodes.set(deviceId, {
        code: formattedCode,
        phone: phoneNumber,
        timestamp: Date.now()
      });

      // Step 8: Save to database
      await this.saveToDatabase(deviceId, formattedCode, supabase);

      // Step 9: Print instructions
      this.printInstructions(deviceName, phoneNumber, formattedCode);

      // Step 10: Auto cleanup after 5 minutes
      setTimeout(() => {
        this.activeCodes.delete(deviceId);
        console.log(`[${deviceName}] Pairing code expired and cleaned up`);
      }, 300000);

      return formattedCode;

    } catch (error) {
      console.error(`[${deviceName}] Unexpected error:`, error);
      return null;
    }
  }

  /**
   * Get device configuration
   */
  async getDeviceConfig(deviceId, supabase) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', deviceId)
        .single();

      if (error || !data) {
        return null;
      }

      // Only return if configured for pairing
      if (data.connection_method !== 'pairing') {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching device config:', error);
      return null;
    }
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;

    // Convert to string and remove non-digits
    let digits = String(phone).replace(/\D/g, '');

    // Handle Indonesian numbers
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      digits = '62' + digits;
    } else if (!digits.startsWith('62') && digits.length <= 12) {
      digits = '62' + digits;
    }

    // Validate length
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }

    return digits;
  }

  /**
   * Format pairing code
   */
  formatCode(code) {
    if (!code) return null;

    const codeStr = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Format as XXXX-XXXX if 8 characters
    if (codeStr.length === 8) {
      return `${codeStr.slice(0, 4)}-${codeStr.slice(4)}`;
    }

    return codeStr;
  }

  /**
   * Save to database
   */
  async saveToDatabase(deviceId, code, supabase) {
    try {
      await supabase
        .from('devices')
        .update({
          pairing_code: code,
          status: 'connecting',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (error) {
      console.error('Failed to save pairing code:', error);
    }
  }

  /**
   * Set device error
   */
  async setDeviceError(deviceId, message, supabase) {
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (error) {
      console.error('Failed to set device error:', error);
    }
  }

  /**
   * Print pairing instructions
   */
  printInstructions(deviceName, phone, code) {
    console.log('\n========================================');
    console.log(`📱 PAIRING CODE: ${code}`);
    console.log(`📱 PHONE: ${phone}`);
    console.log(`📱 DEVICE: ${deviceName}`);
    console.log('========================================');
    console.log('Instructions:');
    console.log('1. Open WhatsApp on the phone number above');
    console.log('2. Go to Settings > Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Choose "Link with phone number"');
    console.log('5. Enter the code above');
    console.log('========================================\n');
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if device is ready for pairing
   */
  isDeviceReady(deviceId) {
    const code = this.activeCodes.get(deviceId);
    if (!code) return true; // No active code, ready for new one
    
    // Check if existing code is still fresh (less than 30 seconds)
    return (Date.now() - code.timestamp) > 30000;
  }

  /**
   * Clear device pairing data
   */
  clearDevice(deviceId) {
    this.activeCodes.delete(deviceId);
    console.log(`Cleared pairing data for device: ${deviceId}`);
  }

  /**
   * Clear all pairing data
   */
  clearAll() {
    this.activeCodes.clear();
    console.log('All pairing data cleared');
  }
}

// Export single instance
module.exports = new StablePairing();
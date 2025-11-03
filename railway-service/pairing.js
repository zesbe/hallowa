/**
 * WhatsApp Pairing Implementation
 * Simple and working implementation for pairing with phone number
 */

class WhatsAppPairing {
  constructor(redis) {
    this.redis = redis;
    this.activePairings = new Map();
  }

  /**
   * Generate pairing code for device
   */
  async generatePairingCode(sock, device, supabase) {
    try {
      console.log('📱 Starting pairing process for:', device.device_name);

      // Step 1: Get device configuration
      const { data: config } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', device.id)
        .single();

      if (!config || config.connection_method !== 'pairing') {
        console.log('❌ Device not configured for pairing');
        return null;
      }

      // Step 2: Format phone number
      const phoneNumber = this.formatPhoneNumber(config.phone_for_pairing);
      if (!phoneNumber) {
        console.error('❌ Invalid phone number:', config.phone_for_pairing);
        await this.setError(supabase, device.id, 'Invalid phone number format');
        return null;
      }

      // Step 3: Check if we already have an active pairing
      const existing = this.activePairings.get(device.id);
      if (existing && (Date.now() - existing.timestamp) < 60000) {
        console.log('✅ Using existing pairing code:', existing.code);
        return existing.code;
      }

      // Step 4: Request pairing code from WhatsApp
      console.log('🔐 Requesting pairing code for:', phoneNumber);
      
      try {
        // Request the pairing code
        const pairingCode = await sock.requestPairingCode(phoneNumber);
        
        if (!pairingCode) {
          throw new Error('No pairing code received from WhatsApp');
        }

        // Format the code (XXXX-XXXX format)
        const formattedCode = this.formatCode(pairingCode);
        
        // Store pairing info
        const pairingInfo = {
          code: formattedCode,
          phone: phoneNumber,
          timestamp: Date.now()
        };
        
        this.activePairings.set(device.id, pairingInfo);

        // Save to Redis (5 minute TTL)
        await this.redis.setPairingCode(device.id, formattedCode, 300);

        // Update database
        await supabase
          .from('devices')
          .update({
            pairing_code: formattedCode,
            status: 'connecting',
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);

        // Print success message
        this.printSuccess(phoneNumber, formattedCode);

        // Start monitoring for completion
        this.monitorPairing(sock, device, supabase);

        return formattedCode;

      } catch (error) {
        console.error('❌ Failed to generate pairing code:', error.message);
        
        // Handle specific errors
        if (error.message?.includes('rate') || error.status === 428) {
          await this.setError(supabase, device.id, 'Too many attempts. Please wait 1 minute.');
        } else {
          await this.setError(supabase, device.id, error.message || 'Failed to generate code');
        }
        
        return null;
      }

    } catch (error) {
      console.error('❌ Unexpected error in pairing:', error);
      return null;
    }
  }

  /**
   * Monitor pairing completion
   */
  monitorPairing(sock, device, supabase) {
    let checkCount = 0;
    const maxChecks = 150; // 5 minutes

    const checkInterval = setInterval(async () => {
      checkCount++;

      // Check if successfully paired
      if (sock.user && sock.authState?.creds?.registered) {
        console.log('');
        console.log('🎉 ═══════════════════════════════════════');
        console.log('🎉 PAIRING SUCCESSFUL!');
        console.log('🎉 Device connected:', sock.user.id);
        console.log('🎉 ═══════════════════════════════════════');
        console.log('');

        // Clean up
        clearInterval(checkInterval);
        this.activePairings.delete(device.id);

        // Update database
        try {
          await supabase
            .from('devices')
            .update({
              status: 'connected',
              phone_number: sock.user.id.split(':')[0],
              pairing_code: null,
              error_message: null,
              last_connected_at: new Date().toISOString()
            })
            .eq('id', device.id);
        } catch (error) {
          console.error('Failed to update device status:', error);
        }
      }

      // Timeout after 5 minutes
      if (checkCount >= maxChecks) {
        console.log('⏰ Pairing timeout - no connection after 5 minutes');
        clearInterval(checkInterval);
        this.activePairings.delete(device.id);
      }
    }, 2000); // Check every 2 seconds

    // Safety timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      this.activePairings.delete(device.id);
    }, 300000); // 5 minutes
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digits
    let digits = String(phone).replace(/\D/g, '');
    
    // Handle Indonesian numbers
    if (digits.startsWith('0')) {
      // 08xxx -> 628xxx
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      // 8xxx -> 628xxx
      digits = '62' + digits;
    } else if (!digits.startsWith('62') && digits.length <= 12) {
      // Add Indonesia code if missing
      digits = '62' + digits;
    }
    
    // Validate length (10-15 digits)
    if (digits.length < 10 || digits.length > 15) {
      console.error('Invalid phone number length:', digits.length);
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code
   */
  formatCode(code) {
    if (!code) return code;
    
    // Remove any non-alphanumeric characters
    const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Format as XXXX-XXXX if 8 characters
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    
    return clean;
  }

  /**
   * Print success message with instructions
   */
  printSuccess(phone, code) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📱 PAIRING CODE READY                     ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Phone: ${phone.padEnd(54)}║`);
    console.log(`║ Code:  ${code.padEnd(54)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                        INSTRUCTIONS                          ║');
    console.log('║                                                              ║');
    console.log('║ On your WhatsApp:                                           ║');
    console.log('║ 1. Open WhatsApp on your phone                              ║');
    console.log('║ 2. Go to Settings > Linked Devices                          ║');
    console.log('║ 3. Tap "Link a Device"                                      ║');
    console.log('║ 4. Tap "Link with phone number instead"                     ║');
    console.log('║ 5. Enter the phone number and pairing code above            ║');
    console.log('║                                                              ║');
    console.log('║ Note: You may receive a notification. Tap it to auto-link.  ║');
    console.log('║ Code expires in 5 minutes.                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Set error status for device
   */
  async setError(supabase, deviceId, message) {
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
      console.error('Failed to set error:', error);
    }
  }

  /**
   * Clear pairing data
   */
  clearPairing(deviceId) {
    this.activePairings.delete(deviceId);
  }
}

module.exports = WhatsAppPairing;
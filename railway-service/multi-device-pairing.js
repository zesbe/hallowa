/**
 * Multi-Device Pairing Handler
 * Supports multiple devices pairing simultaneously
 */

class MultiDevicePairing {
  constructor() {
    // Store pairing sessions for multiple devices
    this.pairingSessions = new Map();
    this.pairingAttempts = new Map();
  }

  /**
   * Start pairing for a device
   * Each device gets its own independent pairing session
   */
  async startPairing(sock, device, supabase) {
    const deviceId = device.id;
    const deviceName = device.device_name;
    
    console.log(`\n🚀 [${deviceName}] Starting pairing process...`);
    
    try {
      // Check if device has phone number configured
      const { data: config } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', deviceId)
        .single();

      if (!config?.phone_for_pairing) {
        console.error(`❌ [${deviceName}] No phone number configured`);
        return null;
      }

      if (config.connection_method !== 'pairing') {
        console.log(`📷 [${deviceName}] Device not configured for pairing mode`);
        return null;
      }

      // Format phone number
      const phoneNumber = this.formatPhoneNumber(config.phone_for_pairing);
      if (!phoneNumber) {
        console.error(`❌ [${deviceName}] Invalid phone number format`);
        return null;
      }

      // Check if we already have an active pairing session for this device
      if (this.pairingSessions.has(deviceId)) {
        const existingSession = this.pairingSessions.get(deviceId);
        const age = (Date.now() - existingSession.timestamp) / 1000;
        
        if (age < 60) {
          console.log(`✅ [${deviceName}] Using existing pairing code (${age.toFixed(0)}s old): ${existingSession.code}`);
          return existingSession.code;
        }
        
        // Clear old session
        this.clearSession(deviceId);
      }

      // Track pairing attempts per device
      const attempts = this.pairingAttempts.get(deviceId) || 0;
      if (attempts >= 3) {
        console.error(`❌ [${deviceName}] Max pairing attempts reached (3)`);
        
        // Reset attempts after 60 seconds
        setTimeout(() => {
          this.pairingAttempts.delete(deviceId);
        }, 60000);
        
        return null;
      }

      // Increment attempt counter
      this.pairingAttempts.set(deviceId, attempts + 1);
      
      console.log(`📱 [${deviceName}] Pairing attempt ${attempts + 1}/3 for phone: ${phoneNumber}`);
      
      // Add delay to ensure socket is ready
      await this.delay(2000);
      
      // Request pairing code
      console.log(`🔐 [${deviceName}] Requesting pairing code from WhatsApp...`);
      
      let pairingCode;
      try {
        pairingCode = await sock.requestPairingCode(phoneNumber);
      } catch (err) {
        console.error(`❌ [${deviceName}] Failed to request pairing code:`, err.message);
        
        if (err.message?.includes('rate')) {
          console.log(`⏳ [${deviceName}] Rate limited - please wait 1 minute`);
          
          // Clear attempts after rate limit
          setTimeout(() => {
            this.pairingAttempts.delete(deviceId);
          }, 60000);
        }
        
        return null;
      }

      if (!pairingCode) {
        console.error(`❌ [${deviceName}] No pairing code received`);
        return null;
      }

      // Format code
      const formattedCode = this.formatCode(pairingCode);
      
      // Store session
      const session = {
        deviceId,
        deviceName,
        phoneNumber,
        code: formattedCode,
        timestamp: Date.now(),
        sock
      };
      
      this.pairingSessions.set(deviceId, session);
      
      // Save to database
      await this.saveToDatabase(deviceId, formattedCode, supabase);
      
      // Print instructions
      this.printInstructions(deviceName, phoneNumber, formattedCode);
      
      // Start monitoring for this device
      this.startMonitoring(session, supabase);
      
      // Auto cleanup after 5 minutes
      setTimeout(() => {
        this.clearSession(deviceId);
      }, 300000);
      
      return formattedCode;
      
    } catch (error) {
      console.error(`❌ [${deviceName}] Unexpected error:`, error.message);
      return null;
    }
  }

  /**
   * Monitor pairing completion for a specific device
   */
  startMonitoring(session, supabase) {
    const { deviceId, deviceName, sock } = session;
    
    let checkCount = 0;
    const maxChecks = 150; // 5 minutes
    
    const interval = setInterval(async () => {
      checkCount++;
      
      // Check if paired
      if (sock?.user && sock?.authState?.creds?.registered) {
        console.log(`\n🎉🎉🎉 [${deviceName}] PAIRING SUCCESSFUL!`);
        console.log(`📱 [${deviceName}] Connected as: ${sock.user.id}\n`);
        
        clearInterval(interval);
        
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
            .eq('id', deviceId);
        } catch (error) {
          console.error(`❌ [${deviceName}] Failed to update status:`, error.message);
        }
        
        // Clear session
        this.clearSession(deviceId);
        
        // Reset attempts on success
        this.pairingAttempts.delete(deviceId);
      }
      
      if (checkCount >= maxChecks) {
        console.log(`⏰ [${deviceName}] Pairing timeout after 5 minutes`);
        clearInterval(interval);
        this.clearSession(deviceId);
      }
    }, 2000);
    
    // Store interval reference for cleanup
    session.monitorInterval = interval;
  }

  /**
   * Clear pairing session for a device
   */
  clearSession(deviceId) {
    const session = this.pairingSessions.get(deviceId);
    
    if (session) {
      // Clear monitoring interval
      if (session.monitorInterval) {
        clearInterval(session.monitorInterval);
      }
      
      // Remove from sessions
      this.pairingSessions.delete(deviceId);
      
      console.log(`🧹 [${session.deviceName}] Pairing session cleared`);
    }
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    let digits = String(phone).replace(/\D/g, '');
    
    // Indonesian number handling
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      digits = '62' + digits;
    }
    
    // Validate
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code
   */
  formatCode(code) {
    if (!code) return code;
    
    const codeStr = String(code).toUpperCase();
    
    if (codeStr.length === 8) {
      return `${codeStr.slice(0, 4)}-${codeStr.slice(4)}`;
    }
    
    return codeStr;
  }

  /**
   * Save pairing code to database
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
      console.error(`❌ Failed to save pairing code:`, error.message);
    }
  }

  /**
   * Print pairing instructions
   */
  printInstructions(deviceName, phone, code) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║ 📱 PAIRING CODE READY - ${deviceName.padEnd(36)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Phone: ${phone.padEnd(53)}║`);
    console.log(`║ Code:  ${code.padEnd(53)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ Instructions:                                                ║');
    console.log('║ 1. Open WhatsApp on your phone                              ║');
    console.log('║ 2. Go to Settings → Linked Devices                          ║');
    console.log('║ 3. Tap "Link a Device"                                      ║');
    console.log('║ 4. Tap "Link with phone number instead"                     ║');
    console.log('║ 5. Enter the phone number and code above                    ║');
    console.log('║                                                              ║');
    console.log('║ Note: You can pair multiple devices simultaneously          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active pairing sessions count
   */
  getActiveSessions() {
    return this.pairingSessions.size;
  }

  /**
   * Get all active sessions info
   */
  getSessionsInfo() {
    const info = [];
    for (const [deviceId, session] of this.pairingSessions) {
      const age = Math.floor((Date.now() - session.timestamp) / 1000);
      info.push({
        deviceId,
        deviceName: session.deviceName,
        phone: session.phoneNumber,
        code: session.code,
        age: `${age}s`
      });
    }
    return info;
  }
}

// Export singleton instance for multi-device support
module.exports = new MultiDevicePairing();
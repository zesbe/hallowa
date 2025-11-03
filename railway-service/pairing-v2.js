/**
 * WhatsApp Pairing V2 - Complete Rewrite
 * Fresh approach to handle multiple pairing attempts
 */

const { delay } = require('@whiskeysockets/baileys');

class WhatsAppPairingV2 {
  constructor(redis) {
    this.redis = redis;
    // Store pairing sessions separately from sockets
    this.pairingSessions = new Map();
    this.pairingTimeouts = new Map();
  }

  /**
   * Main entry point for pairing
   */
  async startPairing(sock, device, supabase) {
    const deviceId = device.id;
    
    console.log('');
    console.log('=====================================');
    console.log('🚀 STARTING NEW PAIRING SESSION');
    console.log('Device:', device.device_name);
    console.log('Device ID:', deviceId);
    console.log('=====================================');
    
    // Step 1: Clean up any existing pairing session
    this.cleanupExistingSession(deviceId);
    
    // Step 2: Validate device configuration
    const config = await this.getDeviceConfig(supabase, deviceId);
    if (!config) {
      console.error('❌ Device not configured for pairing');
      return null;
    }
    
    // Step 3: Format and validate phone number
    const phoneNumber = this.formatPhoneNumber(config.phone_for_pairing);
    if (!phoneNumber) {
      console.error('❌ Invalid phone number format');
      await this.updateDeviceError(supabase, deviceId, 'Invalid phone number');
      return null;
    }
    
    // Step 4: Create new pairing session
    const session = {
      deviceId,
      phoneNumber,
      attempts: 0,
      maxAttempts: 3,
      startTime: Date.now(),
      sock: sock
    };
    
    this.pairingSessions.set(deviceId, session);
    
    // Step 5: Attempt pairing with retry logic
    const code = await this.attemptPairing(session, supabase);
    
    if (code) {
      // Step 6: Start monitoring for success
      this.startMonitoring(session, supabase);
      
      // Step 7: Set timeout for cleanup
      this.setCleanupTimeout(deviceId, 300000); // 5 minutes
      
      return code;
    }
    
    // Clean up on failure
    this.cleanupExistingSession(deviceId);
    return null;
  }

  /**
   * Attempt pairing with retry logic
   */
  async attemptPairing(session, supabase) {
    const { deviceId, phoneNumber, sock } = session;
    
    while (session.attempts < session.maxAttempts) {
      session.attempts++;
      
      console.log(`📱 Pairing attempt ${session.attempts}/${session.maxAttempts} for ${phoneNumber}`);
      
      try {
        // Wait before attempt (longer for retries)
        const waitTime = session.attempts === 1 ? 1000 : 3000 * session.attempts;
        await delay(waitTime);
        
        // Check if socket exists (don't check readyState as it may not be exposed)
        if (!sock) {
          throw new Error('Socket not ready');
        }
        
        // Clear any existing registration
        if (sock.authState?.creds) {
          console.log('🔧 Resetting auth state for fresh pairing');
          sock.authState.creds.registered = false;
          sock.authState.creds.me = null;
          sock.authState.creds.account = null;
        }
        
        // Request pairing code
        console.log('🔐 Calling sock.requestPairingCode(' + phoneNumber + ')...');
        
        const code = await sock.requestPairingCode(phoneNumber);
        
        console.log('🎆 Response received:', code ? 'Got code: ' + code : 'No code');
        
        if (!code) {
          throw new Error('No code received');
        }
        
        // Format code
        const formattedCode = this.formatPairingCode(code);
        
        // Store in session
        session.code = formattedCode;
        session.codeGeneratedAt = Date.now();
        
        // Save to database and Redis
        await this.savePairingCode(supabase, deviceId, formattedCode);
        await this.redis.setPairingCode(deviceId, formattedCode, 300);
        
        // Print instructions
        this.printInstructions(phoneNumber, formattedCode);
        
        return formattedCode;
        
      } catch (error) {
        console.error(`❌ Attempt ${session.attempts} failed:`, error.message);
        
        // Check if it's a rate limit error
        if (error.message?.includes('rate') || error.status === 428) {
          console.log('⏳ Rate limited - waiting 60 seconds...');
          await this.updateDeviceError(supabase, deviceId, 'Rate limited - please wait 1 minute');
          await delay(60000);
        } else if (session.attempts < session.maxAttempts) {
          console.log(`⏳ Retrying in ${3 * session.attempts} seconds...`);
          await delay(3000 * session.attempts);
        }
      }
    }
    
    // All attempts failed
    console.error('❌ All pairing attempts failed');
    await this.updateDeviceError(supabase, deviceId, 'Failed after 3 attempts');
    return null;
  }

  /**
   * Monitor for successful pairing
   */
  startMonitoring(session, supabase) {
    const { deviceId, sock } = session;
    let checkCount = 0;
    const maxChecks = 150; // 5 minutes
    
    const interval = setInterval(async () => {
      checkCount++;
      
      // Check if pairing succeeded
      if (sock?.user && sock?.authState?.creds?.registered) {
        console.log('');
        console.log('🎉🎉🎉 PAIRING SUCCESSFUL! 🎉🎉🎉');
        console.log('Device ID:', sock.user.id);
        console.log('');
        
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
          
          console.log('✅ Device status updated');
        } catch (error) {
          console.error('Failed to update device:', error);
        }
        
        // Clean up session
        this.cleanupExistingSession(deviceId);
      }
      
      // Timeout check
      if (checkCount >= maxChecks) {
        console.log('⏰ Monitoring timeout');
        clearInterval(interval);
        this.cleanupExistingSession(deviceId);
      }
    }, 2000);
    
    session.monitorInterval = interval;
  }

  /**
   * Clean up existing pairing session
   */
  cleanupExistingSession(deviceId) {
    const session = this.pairingSessions.get(deviceId);
    
    if (session) {
      // Clear monitoring interval
      if (session.monitorInterval) {
        clearInterval(session.monitorInterval);
      }
      
      // Remove from map
      this.pairingSessions.delete(deviceId);
      
      console.log(`🧹 Cleaned up pairing session for device ${deviceId}`);
    }
    
    // Clear timeout
    if (this.pairingTimeouts.has(deviceId)) {
      clearTimeout(this.pairingTimeouts.get(deviceId));
      this.pairingTimeouts.delete(deviceId);
    }
  }

  /**
   * Set cleanup timeout
   */
  setCleanupTimeout(deviceId, duration) {
    const timeout = setTimeout(() => {
      console.log(`⏰ Auto cleanup for device ${deviceId}`);
      this.cleanupExistingSession(deviceId);
    }, duration);
    
    this.pairingTimeouts.set(deviceId, timeout);
  }

  /**
   * Get device configuration
   */
  async getDeviceConfig(supabase, deviceId) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('connection_method, phone_for_pairing')
        .eq('id', deviceId)
        .single();
      
      if (error || !data || data.connection_method !== 'pairing') {
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching device config:', error);
      return null;
    }
  }

  /**
   * Save pairing code to database
   */
  async savePairingCode(supabase, deviceId, code) {
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
   * Update device with error
   */
  async updateDeviceError(supabase, deviceId, message) {
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
      console.error('Failed to update error:', error);
    }
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    let digits = String(phone).replace(/\D/g, '');
    
    // Indonesian numbers
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      digits = '62' + digits;
    } else if (!digits.startsWith('62') && digits.length <= 12) {
      digits = '62' + digits;
    }
    
    // Validation
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code
   */
  formatPairingCode(code) {
    if (!code) return code;
    
    const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    
    return clean;
  }

  /**
   * Print pairing instructions
   */
  printInstructions(phone, code) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      📱 PAIRING CODE READY                     ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║ Phone: ${phone.padEnd(56)}║`);
    console.log(`║ Code:  ${code.padEnd(56)}║`);
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║ STEPS:                                                         ║');
    console.log('║ 1. Open WhatsApp on your phone                                ║');
    console.log('║ 2. Settings → Linked Devices                                  ║');
    console.log('║ 3. Link a Device                                              ║');
    console.log('║ 4. Link with phone number instead                             ║');
    console.log('║ 5. Enter phone and code above                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Check if device has active pairing session
   */
  hasActiveSession(deviceId) {
    return this.pairingSessions.has(deviceId);
  }

  /**
   * Get active session
   */
  getActiveSession(deviceId) {
    return this.pairingSessions.get(deviceId);
  }
}

module.exports = WhatsAppPairingV2;
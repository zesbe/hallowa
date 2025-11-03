/**
 * Fixed WhatsApp Pairing Handler
 */

class PairingHandler {
  constructor(redis) {
    this.redis = redis;
  }

  async startPairing(sock, device, supabase) {
    try {
      console.log('📱 Starting pairing for:', device.device_name);

      // Get phone number from device config
      const { data } = await supabase
        .from('devices')
        .select('phone_for_pairing')
        .eq('id', device.id)
        .single();

      if (!data?.phone_for_pairing) {
        console.error('❌ No phone number configured');
        return null;
      }

      // Format phone number - ensure it's a string
      let phone = String(data.phone_for_pairing).replace(/\D/g, '');
      
      // Handle Indonesian numbers
      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      } else if (phone.startsWith('8') && phone.length <= 12) {
        phone = '62' + phone;
      }

      // Validate phone number
      if (!phone || phone.length < 10 || phone.length > 15) {
        console.error('❌ Invalid phone number:', phone);
        return null;
      }

      console.log('📞 Formatted phone number:', phone);

      // Wait for socket to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Request pairing code
      console.log('🔐 Requesting pairing code from WhatsApp...');
      
      let code;
      try {
        // Make sure phone is a string when calling requestPairingCode
        code = await sock.requestPairingCode(phone);
      } catch (err) {
        console.error('❌ Failed to request pairing code:', err.message);
        return null;
      }

      if (!code) {
        console.error('❌ No pairing code received');
        return null;
      }

      // Format the pairing code
      const formattedCode = this.formatCode(code);
      console.log('✅ Pairing code generated:', formattedCode);

      // Save to database
      try {
        await supabase
          .from('devices')
          .update({
            pairing_code: formattedCode,
            status: 'connecting',
            error_message: null
          })
          .eq('id', device.id);
      } catch (err) {
        console.error('❌ Failed to save pairing code to database:', err.message);
      }

      // Store in Redis if available
      if (this.redis && typeof this.redis.setPairingCode === 'function') {
        try {
          await this.redis.setPairingCode(device.id, formattedCode, 300);
        } catch (err) {
          console.error('⚠️ Failed to save to Redis:', err.message);
        }
      }

      // Print instructions
      this.printInstructions(phone, formattedCode);

      return formattedCode;

    } catch (error) {
      console.error('❌ Unexpected pairing error:', error);
      return null;
    }
  }

  formatCode(code) {
    if (!code) return code;
    
    // Convert to string if needed
    const codeStr = String(code).toUpperCase();
    
    // Format as XXXX-XXXX if 8 characters
    if (codeStr.length === 8) {
      return `${codeStr.slice(0, 4)}-${codeStr.slice(4)}`;
    }
    
    return codeStr;
  }

  printInstructions(phone, code) {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         📱 PAIRING CODE READY                ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║ Phone: ${phone.padEnd(38)}║`);
    console.log(`║ Code:  ${code.padEnd(38)}║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ Instructions:                                ║');
    console.log('║ 1. Open WhatsApp on your phone              ║');
    console.log('║ 2. Go to Settings → Linked Devices          ║');
    console.log('║ 3. Tap "Link a Device"                      ║');
    console.log('║ 4. Tap "Link with phone number instead"     ║');
    console.log('║ 5. Enter the phone number and code above    ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  }
}

module.exports = PairingHandler;
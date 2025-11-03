/**
 * Simple WhatsApp Pairing Handler
 */

class PairingHandler {
  constructor(redis) {
    this.redis = redis;
    this.activeCodes = new Map();
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

      // Format phone number
      let phone = String(data.phone_for_pairing).replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      } else if (phone.startsWith('8')) {
        phone = '62' + phone;
      }

      console.log('📞 Phone number:', phone);

      // Wait a bit for socket to be ready
      await new Promise(r => setTimeout(r, 2000));

      // Request pairing code
      console.log('🔐 Requesting pairing code...');
      const code = await sock.requestPairingCode(phone);

      if (!code) {
        console.error('❌ No code received');
        return null;
      }

      // Format code
      const formatted = code.length === 8 ? 
        `${code.slice(0, 4)}-${code.slice(4)}` : code;

      console.log('✅ Pairing code:', formatted);

      // Save to database
      await supabase
        .from('devices')
        .update({
          pairing_code: formatted,
          status: 'connecting'
        })
        .eq('id', device.id);

      // Store in Redis
      if (this.redis?.setPairingCode) {
        await this.redis.setPairingCode(device.id, formatted, 300);
      }

      // Print instructions
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('📱 PAIRING CODE READY');
      console.log('Phone:', phone);
      console.log('Code:', formatted);
      console.log('');
      console.log('Instructions:');
      console.log('1. Open WhatsApp');
      console.log('2. Settings > Linked Devices');
      console.log('3. Link with phone number');
      console.log('4. Enter phone and code');
      console.log('═══════════════════════════════════════');
      console.log('');

      return formatted;

    } catch (error) {
      console.error('❌ Pairing error:', error.message);
      return null;
    }
  }
}

module.exports = PairingHandler;
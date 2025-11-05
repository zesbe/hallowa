const QRCode = require('qrcode');

/**
 * Handle QR Code generation for WhatsApp connection
 * QR codes are stored in Supabase database
 * @param {Object} device - Device data from database
 * @param {string} qr - QR code string from Baileys
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} - Returns true if QR was handled successfully
 */
async function handleQRCode(device, qr, supabase) {
  try {
    if (!qr) {
      return false;
    }

    console.log('📷 QR Code generated for', device.device_name);
    
    // Convert QR string to data URL
    const qrDataUrl = await QRCode.toDataURL(qr);
    
    // Update database with QR code
    const { error } = await supabase
      .from('devices')
      .update({ 
        status: 'connecting',
        qr_code: qrDataUrl,
        pairing_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);

    if (error) {
      console.error('❌ Error updating status:', error);
      return false;
    }

    console.log('✅ QR stored in Supabase - scan with WhatsApp app');
    return true;
  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return false;
  }
}

module.exports = { handleQRCode };

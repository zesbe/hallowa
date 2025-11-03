/**
 * Redis Upstash Client for WhatsApp Session Management
 * Handles session data, QR codes, and pairing codes
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

class RedisClient {
  constructor() {
    if (!REDIS_URL || !REDIS_TOKEN) {
      throw new Error('Redis credentials not configured');
    }
    this.baseUrl = REDIS_URL;
    this.token = REDIS_TOKEN;
  }

  async execute(command) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  // QR Code Management (Keep - temporary data)
  async setQRCode(deviceId, qrCode, ttl = 600) {
    try {
      // TTL 10 minutes for QR codes (extended for better stability)
      const key = `qr:${deviceId}`;
      const result = await this.execute(['SET', key, qrCode, 'EX', ttl]);
      console.log(`Redis SET result for qr:${deviceId}:`, result);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setQRCode error:', error);
      return false;
    }
  }

  async getQRCode(deviceId) {
    const key = `qr:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deleteQRCode(deviceId) {
    const key = `qr:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Pairing Code Management (Keep - temporary data)
  async setPairingCode(deviceId, pairingCode, ttl = 600) {
    try {
      // TTL 10 minutes for pairing codes (extended for better stability)
      const key = `pairing:${deviceId}`;
      const result = await this.execute(['SET', key, pairingCode, 'EX', ttl]);
      console.log(`Redis SET result for pairing:${deviceId}:`, result);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setPairingCode error:', error);
      return false;
    }
  }

  async getPairingCode(deviceId) {
    const key = `pairing:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deletePairingCode(deviceId) {
    const key = `pairing:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Cleanup all device data (only temporary codes)
  async cleanupDevice(deviceId) {
    await Promise.all([
      this.deleteQRCode(deviceId),
      this.deletePairingCode(deviceId),
    ]);
  }
}

module.exports = new RedisClient();

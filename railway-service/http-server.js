/**
 * Simple HTTP Server for Baileys service
 * Provides REST API endpoints for sending messages
 */

const http = require('http');
const url = require('url');

/**
 * Create HTTP server for handling send message requests
 */
function createHTTPServer(activeSockets) {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Health check endpoint
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        activeConnections: activeSockets.size,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Send message endpoint
    if (pathname === '/send-message' && req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const { deviceId, targetJid, messageType, message, mediaUrl, caption } = JSON.parse(body);

          if (!deviceId || !targetJid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'deviceId and targetJid are required' }));
            return;
          }

          // Get socket for device
          const sock = activeSockets.get(deviceId);

          if (!sock || !sock.user) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Device not connected' }));
            return;
          }

          // Prepare message content
          let messageContent;

          if (messageType === 'text' || !messageType) {
            messageContent = { text: message };
          } else if (messageType === 'image') {
            // Fetch image from URL and send
            const response = await fetch(mediaUrl);
            const buffer = await response.arrayBuffer();
            const imageBuffer = Buffer.from(buffer);

            messageContent = {
              image: imageBuffer,
              caption: caption || message || ''
            };
          } else if (messageType === 'video') {
            const response = await fetch(mediaUrl);
            const buffer = await response.arrayBuffer();
            const videoBuffer = Buffer.from(buffer);

            messageContent = {
              video: videoBuffer,
              caption: caption || message || ''
            };
          } else if (messageType === 'document') {
            const response = await fetch(mediaUrl);
            const buffer = await response.arrayBuffer();
            const docBuffer = Buffer.from(buffer);

            messageContent = {
              document: docBuffer,
              caption: caption || message || '',
              fileName: 'document.pdf'
            };
          }

          // Send message via Baileys
          const sentMessage = await sock.sendMessage(targetJid, messageContent);

          // Save sent message to database for CRM
          const { saveMessageToDatabase } = require('./crm-message-handler');

          // Get device info from socket
          const deviceUserId = sock.deviceUserId || null;

          if (deviceUserId) {
            await saveMessageToDatabase(deviceId, deviceUserId, {
              key: sentMessage.key,
              message: sentMessage.message,
              pushName: sock.user?.name || 'Me',
              fromMe: true
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            messageId: sentMessage.key.id,
            timestamp: Date.now()
          }));

          console.log(`📤 Message sent via HTTP: ${targetJid} - ${messageType}`);

        } catch (error) {
          console.error('Error sending message via HTTP:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Failed to send message',
            details: error.message
          }));
        }
      });

      return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

module.exports = { createHTTPServer };

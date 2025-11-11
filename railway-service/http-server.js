/**
 * Simple HTTP Server for Baileys service
 * Provides REST API endpoints for sending messages
 */

const http = require('http');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');
const {
  hashApiKey,
  RateLimiter,
  validatePhoneNumber,
  validateMessage,
  validateMediaUrl
} = require('./auth-utils');
const redisClient = require('./redis-client');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize rate limiter
const rateLimiter = new RateLimiter();

// Internal API key for edge function authentication
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY || INTERNAL_API_KEY.length < 32) {
  console.warn('⚠️  WARNING: INTERNAL_API_KEY not set or too short. Edge function authentication will fail.');
}

// Allowed origins for CORS (configure based on your domains)
const ALLOWED_ORIGINS = [
  'https://multi-wa-mate.lovable.app',
  'https://hallowa.lovable.app',
  'http://localhost:5173', // Development only
  'http://localhost:8080'  // Development only
];

/**
 * Create HTTP server for handling send message requests
 */
function createHTTPServer(activeSockets) {
  const server = http.createServer(async (req, res) => {
    // CORS headers - only allow specific origins
    const origin = req.headers.origin;

    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow localhost with any port
      if (origin && origin.startsWith('http://localhost:')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

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

      req.on('error', (err) => {
        console.error('Request error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request error' }));
      });

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          // Parse JSON body
          let parsedBody;
          try {
            parsedBody = JSON.parse(body);
          } catch (parseError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
            return;
          }

          const { deviceId, targetJid, messageType, message, mediaUrl, caption } = parsedBody;

          // === AUTHENTICATION ===
          // Check for Authorization header
          const authHeader = req.headers['authorization'] || req.headers['Authorization'];
          if (!authHeader) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }));
            return;
          }

          // Extract API key (Bearer token)
          const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();
          if (!apiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Invalid Authorization format' }));
            return;
          }

          let userId;
          let isInternalRequest = false;

          // Check if this is an internal request from edge functions
          if (INTERNAL_API_KEY && apiKey === INTERNAL_API_KEY) {
            // Internal request - authenticated
            isInternalRequest = true;
            console.log('🔒 Internal API request authenticated');
          } else {
            // External user API request - validate against database
            const hashedKey = hashApiKey(apiKey);

            // Verify API key in database
            const { data: keyData, error: keyError } = await supabase
              .from('api_keys')
              .select('user_id, is_active')
              .eq('api_key_hash', hashedKey)
              .eq('is_active', true)
              .maybeSingle();

            if (keyError || !keyData) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized: Invalid API key' }));
              return;
            }

            userId = keyData.user_id;
          }

          // === RATE LIMITING ===
          // Skip rate limiting for internal requests
          if (!isInternalRequest) {
            const clientIdentifier = `api:${apiKey.substring(0, 16)}`; // Use partial API key as identifier

            // Try Redis distributed rate limiting first
            let rateLimitOk = await redisClient.checkRateLimit(clientIdentifier, 100, 60);

            // Fallback to in-memory rate limiter if Redis fails
            if (!redisClient.enabled) {
              rateLimitOk = rateLimiter.checkLimit(clientIdentifier, 100, 60000);
            }

            if (!rateLimitOk) {
              res.writeHead(429, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Rate limit exceeded. Max 100 requests per minute.',
                retryAfter: 60
              }));
              return;
            }
          }

          // === INPUT VALIDATION ===
          if (!deviceId || !targetJid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'deviceId and targetJid are required' }));
            return;
          }

          // Verify device ownership (skip for internal requests as they're pre-authenticated)
          if (!isInternalRequest) {
            const { data: device, error: deviceError } = await supabase
              .from('devices')
              .select('user_id')
              .eq('id', deviceId)
              .maybeSingle();

            if (deviceError || !device) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Device not found' }));
              return;
            }

            // Check if user owns the device
            if (device.user_id !== userId) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden: You do not own this device' }));
              return;
            }
          }

          // Validate phone number format
          if (!validatePhoneNumber(targetJid)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid phone number format' }));
            return;
          }

          // Validate message content
          try {
            if (message) {
              validateMessage(message);
            }
          } catch (validationError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: validationError.message }));
            return;
          }

          // Validate media URL if provided
          if (mediaUrl && !validateMediaUrl(mediaUrl)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid or unsafe media URL' }));
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
          console.error('Error sending message via HTTP:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Failed to send message'
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

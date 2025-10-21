# Railway Service Template - WhatsApp Baileys Integration

Deploy Node.js service ini ke Railway untuk integrasi WhatsApp via Baileys dengan database Supabase.

## Setup Railway Service

### 1. Buat project Node.js baru

```bash
mkdir whatsapp-baileys-service
cd whatsapp-baileys-service
npm init -y
```

### 2. Install dependencies

```bash
npm install @whiskeysockets/baileys @supabase/supabase-js qrcode-terminal
```

### 3. Buat file `index.js`

```javascript
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

// Supabase config dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Store active WhatsApp sockets
const activeSockets = new Map();

// Listen to devices table for 'connecting' status
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Listening to devices table...');

  // Subscribe to real-time changes
  const channel = supabase
    .channel('devices-listener')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'devices'
      },
      async (payload) => {
        console.log('Device change detected:', payload);

        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const device = payload.new;

          // Start connection if status is 'connecting'
          if (device.status === 'connecting' && !activeSockets.has(device.id)) {
            await connectWhatsApp(device);
          }

          // Disconnect if status is 'disconnected'
          if (device.status === 'disconnected' && activeSockets.has(device.id)) {
            const sock = activeSockets.get(device.id);
            sock?.end();
            activeSockets.delete(device.id);
            console.log(`Disconnected device: ${device.id}`);
          }
        }
      }
    )
    .subscribe();

  // Initial check for any 'connecting' devices
  const { data: devices, error } = await supabase
    .from('devices')
    .select('*')
    .eq('status', 'connecting');

  if (error) {
    console.error('Error fetching devices:', error);
    return;
  }

  // Connect all pending devices
  for (const device of devices) {
    if (!activeSockets.has(device.id)) {
      await connectWhatsApp(device);
    }
  }
}

async function connectWhatsApp(device) {
  console.log(`📱 Connecting device: ${device.device_name} (${device.id})`);

  try {
    // Use multi-file auth state stored in memory (you can save to DB later)
    const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_${device.id}`);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // We'll handle QR ourselves
    });

    activeSockets.set(device.id, sock);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Generate QR code
      if (qr) {
        console.log('📷 QR Code generated for', device.device_name);
        
        // Generate QR as data URL
        const QRCode = require('qrcode');
        const qrDataUrl = await QRCode.toDataURL(qr);

        // Update database with QR code
        await supabase
          .from('devices')
          .update({ 
            qr_code: qrDataUrl,
            status: 'connecting'
          })
          .eq('id', device.id);

        console.log('✅ QR saved to database');
      }

      // Connected successfully
      if (connection === 'open') {
        console.log('✅ Connected:', device.device_name);

        // Get phone number
        const phoneNumber = sock.user?.id.split(':')[0];

        // Update database
        await supabase
          .from('devices')
          .update({
            status: 'connected',
            phone_number: phoneNumber,
            last_connected_at: new Date().toISOString(),
            qr_code: null
          })
          .eq('id', device.id);

        // Save session data
        const sessionData = JSON.stringify(state);
        await supabase
          .from('devices')
          .update({ session_data: sessionData })
          .eq('id', device.id);
      }

      // Disconnected
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed. Reconnect:', shouldReconnect);

        activeSockets.delete(device.id);

        if (shouldReconnect) {
          // Update status to error
          await supabase
            .from('devices')
            .update({ status: 'error' })
            .eq('id', device.id);
        } else {
          // Logged out
          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              phone_number: null,
              qr_code: null
            })
            .eq('id', device.id);
        }
      }
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // Handle messages (optional - for future message handling)
    sock.ev.on('messages.upsert', async ({ messages }) => {
      console.log('Message received:', messages);
      // You can save messages to database here
    });

  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    
    // Update status to error
    await supabase
      .from('devices')
      .update({ status: 'error' })
      .eq('id', device.id);
    
    activeSockets.delete(device.id);
  }
}

// Start the service
startService().catch(console.error);

// Keep process alive
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  for (const [deviceId, sock] of activeSockets) {
    sock?.end();
  }
  process.exit(0);
});
```

### 4. Update `package.json`

```json
{
  "name": "whatsapp-baileys-service",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.8",
    "@supabase/supabase-js": "^2.45.0",
    "qrcode": "^1.5.3",
    "qrcode-terminal": "^0.12.0"
  }
}
```

### 5. Deploy ke Railway

1. Push code ke GitHub repository
2. Di Railway, buat New Project → Deploy from GitHub
3. Pilih repository kamu
4. Tambahkan Environment Variables:
   ```
   SUPABASE_URL=https://ierdfxgeectqoekugyvb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[ambil dari Supabase Dashboard → Settings → API]
   ```
5. Deploy!

### 6. Testing

1. Buka frontend Lovable kamu
2. Klik "Scan QR" pada device
3. QR code akan muncul (generate dari Railway service)
4. Scan dengan WhatsApp
5. Status akan berubah menjadi "Connected"

## Arsitektur

```
Frontend (Lovable)
    ↓ Update status='connecting'
Database (Supabase)
    ↓ Real-time subscription
Railway Service (Baileys)
    ↓ Generate QR & update database
Database (Supabase)
    ↓ Frontend polls database
Frontend (Lovable) - Shows QR
```

## Notes

- Service ini running 24/7 di Railway
- Baileys akan maintain WhatsApp connection
- Session data disimpan di database untuk restore connection
- QR code expire setelah 60 detik (generate ulang otomatis)

## Troubleshooting

**QR tidak muncul?**
- Check Railway logs: `railway logs`
- Pastikan environment variables sudah di-set
- Check database: `SELECT * FROM devices WHERE status='connecting'`

**Connection failed?**
- Check internet connection di Railway
- Restart Railway service
- Clear session: klik "Clear Session" di frontend

**Need SUPABASE_SERVICE_ROLE_KEY?**
1. Buka Supabase Dashboard
2. Settings → API
3. Copy "service_role" key (secret!)

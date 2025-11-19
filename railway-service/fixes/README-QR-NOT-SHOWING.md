# Fix: QR Code Not Showing After Redis Migration

## 🔍 Root Cause Analysis

After the Redis migration from Upstash to local Redis, QR codes are not appearing because:

1. **Multi-server load balancing** was implemented recently
2. Devices get assigned to specific backend servers
3. If a device is assigned to an **inactive/offline server**, the active server will **skip** processing it
4. Without processing, no QR code is generated or stored in the database

### Technical Details

**Location:** `railway-service/services/device/deviceManager.js:379-387`

```javascript
// Verify this server should handle this device
if (!serverAssignmentService.shouldHandleDevice(device)) {
  logger.warn('⚠️ Device not assigned to this server - skipping', {
    deviceId: device.id,
    assignedServer: device.assigned_server_id,
    currentServer: serverAssignmentService.serverId
  });
  continue; // ← DEVICE SKIPPED, NO QR GENERATED!
}
```

### Flow Diagram

```
User clicks "Connect Device"
  ↓
Device status set to "connecting"
  ↓
Backend service runs checkDevices()
  ↓
Check if device.assigned_server_id matches current server
  ↓
  ├─ YES → Process device → Generate QR → Save to database ✅
  │
  └─ NO → Skip device → No QR generated ❌
```

## ✅ Solutions

### Option 1: SQL Fix (RECOMMENDED - Fastest)

Run this SQL in Supabase SQL Editor:

```sql
-- Reset assigned_server_id for all connecting devices
UPDATE devices
SET
  assigned_server_id = NULL,
  updated_at = NOW()
WHERE
  status = 'connecting'
  AND assigned_server_id IS NOT NULL;
```

**Result:** Devices will be auto-assigned to the active server on next polling cycle (within 10 seconds).

### Option 2: Node.js Script Fix

```bash
cd railway-service/fixes
node fix-multi-server-check.js reset-all
```

**Other commands:**
```bash
# Reset specific device
node fix-multi-server-check.js reset-device 338f1456-00b2-4d9f-8876-0464a63acd50

# Reset all devices on inactive servers
node fix-multi-server-check.js reset-inactive
```

### Option 3: Manual Fix via Supabase Dashboard

1. Go to Supabase → Table Editor → `devices`
2. Find devices with `status = 'connecting'`
3. Set `assigned_server_id` to `NULL` for those devices
4. Click Save

## 🧪 Verification

After applying the fix:

1. **Check database:**
   ```sql
   SELECT
     id,
     device_name,
     status,
     assigned_server_id,
     qr_code IS NOT NULL as has_qr_code,
     updated_at
   FROM devices
   WHERE status = 'connecting'
   ORDER BY updated_at DESC
   LIMIT 5;
   ```

2. **Check backend logs:**
   - Look for: `📷 [DeviceName] QR code received - generating...`
   - Look for: `✅ QR stored in Supabase - scan with WhatsApp app`

3. **Check frontend:**
   - Refresh the device page
   - QR code should appear within 10-15 seconds

## 🔧 Backend Service Health Check

If QR still doesn't appear, verify backend service is running:

1. **Check Railway service logs:**
   ```
   ✅ Server identified
   ✅ Server assignment service ready
   🌐 HTTP Server listening on port 3000
   ⏱️ Device check polling started (every 10 seconds)
   ```

2. **Check server registration:**
   ```sql
   SELECT
     server_name,
     is_active,
     is_healthy,
     current_load,
     last_health_ping
   FROM backend_servers
   WHERE is_active = true
   ORDER BY last_health_ping DESC;
   ```

3. **Verify server ID:**
   Check Railway logs for:
   ```
   🔧 Initializing server identification...
   ✅ Server identified: railway-production-xxxxx
   ```

## 🚀 Long-term Solutions

### Automatic Cleanup (Recommended)

Add a scheduled job to reset devices on inactive servers:

```javascript
// In railway-service/index.js
const { resetDevicesOnInactiveServers } = require('./fixes/fix-multi-server-check');

// Run every 5 minutes
setInterval(() => {
  resetDevicesOnInactiveServers().catch(error => {
    logger.error('❌ Failed to reset inactive devices', { error: error.message });
  });
}, 5 * 60 * 1000);
```

### Fallback to Any Server

Modify `deviceManager.js` to allow QR generation even if server doesn't match:

```javascript
// Line 379-387 in deviceManager.js
if (!serverAssignmentService.shouldHandleDevice(device)) {
  // ONLY skip if device is CONNECTED (active session)
  // Allow QR generation for CONNECTING devices
  if (device.status === 'connected') {
    logger.warn('⚠️ Device not assigned to this server - skipping');
    continue;
  } else {
    logger.info('📋 Device connecting on different server - auto-reassigning');
    device.assigned_server_id = null; // Allow auto-assignment
  }
}
```

## 📝 Related Files

- **Main issue:** `railway-service/services/device/deviceManager.js:379-387`
- **QR handler:** `railway-service/qr-handler.js`
- **Connection manager:** `railway-service/services/whatsapp/connectionManager.js:477-479`
- **Server assignment:** `railway-service/services/server/serverAssignmentService.js`
- **Fix scripts:** `railway-service/fixes/fix-multi-server-check.js`
- **Fix SQL:** `railway-service/fixes/fix-qr-not-showing-multi-server.sql`

## 🐛 Debug Checklist

If QR still not showing after fix:

- [ ] Backend service is running on Railway
- [ ] Redis is connected (check logs for `✅ ioredis ready`)
- [ ] Server is registered in `backend_servers` table
- [ ] Device `assigned_server_id` is NULL or matches current server
- [ ] Device `status` is 'connecting'
- [ ] No error in backend logs
- [ ] Edge function `get-device-qr` is deployed
- [ ] Frontend is calling the edge function correctly

## 📞 Support

If issue persists:

1. Share backend service logs (last 100 lines)
2. Share device info from database
3. Share server info from `backend_servers` table
4. Check Supabase edge function logs for `get-device-qr`

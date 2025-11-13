# 🔒 Device Security & Monitoring Guide

> **Version**: 1.0
> **Last Updated**: 2025-11-13
> **Purpose**: Comprehensive guide for device security, monitoring, and best practices

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Security Architecture](#security-architecture)
3. [Components Reference](#components-reference)
4. [Database Schema](#database-schema)
5. [Backend API](#backend-api)
6. [Frontend Integration](#frontend-integration)
7. [Security Best Practices](#security-best-practices)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What's Implemented

This security infrastructure provides comprehensive logging, monitoring, and protection for WhatsApp device management operations.

**Key Features:**
- ✅ Connection event audit trail
- ✅ Real-time health monitoring
- ✅ Automatic issue detection
- ✅ RLS-protected data access
- ✅ Input sanitization & validation
- ✅ XSS protection on all inputs
- ✅ Paginated log queries
- ✅ Auto-cleanup (90-day retention)

---

## Security Architecture

### Data Flow

```
User Input → SecureInput (XSS sanitization)
           ↓
React Frontend (validated)
           ↓
Supabase RLS (authorization)
           ↓
PostgreSQL Functions (parameterized queries)
           ↓
Database Tables (RLS protected)
           ↓
Railway Service (event logging)
           ↓
Baileys WebSocket (WhatsApp API)
```

### Security Layers

1. **Frontend Layer**
   - SecureInput components (auto-sanitization)
   - Character limits enforced
   - Input validation before submission
   - Error message sanitization

2. **Transport Layer**
   - HTTPS only
   - JWT authentication
   - PKCE flow for auth
   - Session in sessionStorage

3. **Database Layer**
   - Row-Level Security (RLS) policies
   - Parameterized queries via RPC
   - UUID validation
   - Foreign key constraints

4. **Backend Layer**
   - Input validation module
   - Error message sanitization
   - Hashed logging for sensitive data
   - Rate limiting ready

---

## Components Reference

### DeviceHealthCard

**Location**: `src/components/device/DeviceHealthCard.tsx`

**Purpose**: Display real-time device health metrics

**Props**:
```typescript
interface DeviceHealthCardProps {
  deviceId: string;           // Device UUID
  deviceName: string;         // Display name
  deviceStatus: string;       // Connection status
  refreshInterval?: number;   // Auto-refresh (ms, default: 30000)
  compact?: boolean;          // Compact view (default: false)
}
```

**Usage**:
```tsx
import { DeviceHealthCard } from '@/components/device';

<DeviceHealthCard
  deviceId={device.id}
  deviceName={device.device_name}
  deviceStatus={device.status}
  refreshInterval={30000}
/>
```

**Health Status Thresholds**:
- 🟢 **Healthy**: Error rate < 5%, no issues
- 🟡 **Warning**: Error rate 5-10%, or 5+ reconnects/day
- 🔴 **Critical**: Error rate > 20%, or 10+ reconnects/day
- ⚫ **Offline**: Device not connected

---

### ConnectionLogsTimeline

**Location**: `src/components/device/ConnectionLogsTimeline.tsx`

**Purpose**: Display chronological connection event history

**Props**:
```typescript
interface ConnectionLogsTimelineProps {
  deviceId: string;           // Device UUID
  maxHeight?: string;         // ScrollArea height (default: "500px")
  autoRefresh?: boolean;      // Enable auto-refresh (default: false)
  refreshInterval?: number;   // Refresh interval (ms, default: 60000)
  pageSize?: number;          // Logs per page (max 50, default: 50)
}
```

**Usage**:
```tsx
import { ConnectionLogsTimeline } from '@/components/device';

<ConnectionLogsTimeline
  deviceId={device.id}
  maxHeight="600px"
  autoRefresh={true}
  refreshInterval={60000}
  pageSize={50}
/>
```

**Event Types**:
- ✅ `connected` - Successful connection
- ❌ `disconnected` - Connection lost
- 🔴 `error` - Connection error
- 🚪 `logout` - User-initiated logout
- 📷 `qr_generated` - QR code generated
- 📱 `pairing_code_generated` - Pairing code created
- 🔄 `reconnect_attempt` - Auto-reconnect triggered

---

### SecureInput (Applied to Devices.tsx)

**Location**: `src/components/secure/SecureInput.tsx`

**Security Features**:
- Automatic XSS sanitization on blur
- Character limit enforcement
- Visual character counter
- Callback for sanitized values

**Applied to**:
1. Device name input (max 100 chars)
2. Pairing phone number (max 20 digits)

**Example**:
```tsx
<SecureInput
  id="deviceName"
  value={deviceName}
  onChange={(e) => setDeviceName(e.target.value)}
  maxLength={100}
  placeholder="Device Name"
  required
/>
```

---

## Database Schema

### device_connection_logs

**Purpose**: Audit trail for all connection events

```sql
CREATE TABLE device_connection_logs (
  id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT CHECK (event_type IN (...)),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB,
  ip_address TEXT,
  error_code TEXT,
  error_message TEXT,
  connection_duration_seconds INTEGER
);
```

**RLS Policy**:
```sql
-- Users can only view own logs
CREATE POLICY "Users can view own device logs"
  ON device_connection_logs FOR SELECT
  USING (auth.uid() = user_id);
```

**Indexes**:
- `idx_device_logs_device_timestamp` (device_id, timestamp DESC)
- `idx_device_logs_user` (user_id, timestamp DESC)
- `idx_device_logs_event_type` (event_type, timestamp DESC)

---

### device_health_metrics

**Purpose**: Daily health and performance tracking

```sql
CREATE TABLE device_health_metrics (
  id UUID PRIMARY KEY,
  device_id UUID REFERENCES devices(id),
  user_id UUID REFERENCES auth.users(id),
  uptime_minutes INTEGER DEFAULT 0,
  messages_sent_today INTEGER DEFAULT 0,
  messages_failed_today INTEGER DEFAULT 0,
  error_count_today INTEGER DEFAULT 0,
  error_rate_percent DECIMAL(5,2) DEFAULT 0,
  health_status TEXT CHECK (health_status IN (...)),
  date DATE NOT NULL,
  UNIQUE(device_id, date)
);
```

**RLS Policy**:
```sql
-- Users can view own health metrics
CREATE POLICY "Users can view own device health"
  ON device_health_metrics FOR SELECT
  USING (auth.uid() = user_id);
```

---

### device_reconnect_settings

**Purpose**: Auto-reconnect configuration per device

```sql
CREATE TABLE device_reconnect_settings (
  device_id UUID PRIMARY KEY REFERENCES devices(id),
  user_id UUID REFERENCES auth.users(id),
  enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 5,
  retry_interval_seconds INTEGER DEFAULT 30,
  exponential_backoff BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true
);
```

---

## Backend API

### Security Logger Module

**Location**: `railway-service/services/device/deviceSecurityLogger.js`

#### logConnectionEvent()

**Purpose**: Log connection events with validation

**Parameters**:
```javascript
{
  deviceId: string,           // UUID validated
  userId: string,             // UUID validated
  eventType: string,          // Enum validated
  details: object,            // Optional metadata
  ipAddress: string,          // Optional
  errorCode: string,          // Optional
  errorMessage: string        // Sanitized
}
```

**Usage**:
```javascript
const { logConnectionEvent } = require('../device/deviceSecurityLogger');

await logConnectionEvent({
  deviceId: device.id,
  userId: device.user_id,
  eventType: 'connected',
  details: { phoneNumber, server: 'railway-1' }
});
```

**Security**:
- ✅ UUID validation
- ✅ Error message sanitization
- ✅ Sensitive data hashing in logs
- ✅ Non-blocking (failures don't break flow)

---

#### updateDeviceHealth()

**Purpose**: Update daily health metrics

**Parameters**:
```javascript
{
  deviceId: string,
  userId: string,
  messagesSent: number,       // >= 0
  messagesFailed: number,     // >= 0
  errorOccurred: boolean,
  errorMessage: string        // Sanitized
}
```

**Auto-calculated**:
- Error rate percentage
- Health status (healthy/warning/critical)
- Last heartbeat timestamp

---

#### getDeviceHealthSummary()

**Purpose**: Retrieve current health status

**Parameters**:
```javascript
deviceId: string  // UUID validated
```

**Returns**:
```javascript
{
  health_status: string,
  uptime_minutes: number,
  messages_sent_today: number,
  error_rate_percent: number,
  last_error_message: string,
  reconnect_count_today: number
}
```

---

## Frontend Integration

### Step 1: Import Components

```tsx
import { DeviceHealthCard, ConnectionLogsTimeline } from '@/components/device';
```

### Step 2: Add to Device Detail Page

```tsx
// In device detail view or modal
<div className="grid gap-4">
  <DeviceHealthCard
    deviceId={device.id}
    deviceName={device.device_name}
    deviceStatus={device.status}
  />

  <ConnectionLogsTimeline
    deviceId={device.id}
    maxHeight="500px"
    autoRefresh={true}
  />
</div>
```

### Step 3: Add to Dashboard Overview

```tsx
// Compact view for dashboard
<div className="grid grid-cols-3 gap-4">
  {devices.map(device => (
    <DeviceHealthCard
      key={device.id}
      deviceId={device.id}
      deviceName={device.device_name}
      deviceStatus={device.status}
      compact={true}
    />
  ))}
</div>
```

---

## Security Best Practices

### Input Validation

**DO ✅**:
```tsx
<SecureInput
  value={input}
  onChange={(e) => setInput(e.target.value)}
  maxLength={100}
  required
/>
```

**DON'T ❌**:
```tsx
<Input
  value={input}
  onChange={(e) => setInput(e.target.value)}
  // No sanitization, no length limit!
/>
```

---

### Database Queries

**DO ✅**:
```javascript
// Use RPC with parameterized queries
const { data } = await supabase.rpc('log_device_connection_event', {
  p_device_id: deviceId,  // Parameters prevent SQL injection
  p_user_id: userId
});
```

**DON'T ❌**:
```javascript
// Raw SQL with string interpolation
const { data } = await supabase
  .rpc('raw_query', {
    query: `INSERT INTO logs VALUES ('${deviceId}', '${userId}')`
    // ❌ SQL injection vulnerability!
  });
```

---

### Error Handling

**DO ✅**:
```javascript
const { logConnectionEvent } = require('../device/deviceSecurityLogger');

try {
  await connectDevice();
} catch (error) {
  // Sanitized error logging
  await logConnectionEvent({
    eventType: 'error',
    errorMessage: sanitizeErrorMessage(error.message)
  });
}
```

**DON'T ❌**:
```javascript
// Raw error exposed to user
console.log('Error:', error.stack);  // ❌ Sensitive info exposed
toast.error(error.message);          // ❌ Unsanitized error
```

---

### RLS Policies

**DO ✅**:
```sql
-- Enforce user ownership
CREATE POLICY "Users view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);
```

**DON'T ❌**:
```sql
-- Weak or missing policies
CREATE POLICY "Public access"
  ON table_name FOR SELECT
  USING (true);  -- ❌ No access control!
```

---

## Monitoring & Alerts

### Health Status Monitoring

**Automatic Detection**:
- High error rate (>10%)
- Critical error rate (>20%)
- Multiple reconnects (>5/day)
- Connection timeout
- Session expired

**Alert Channels** (Ready to implement):
- Email notifications
- Slack webhooks
- SMS alerts (Twilio)
- In-app toast notifications

### Example Alert Setup

```typescript
// Check health every 5 minutes
setInterval(async () => {
  const health = await getDeviceHealthSummary(deviceId);

  if (health.error_rate_percent > 20) {
    // Send critical alert
    await sendAlert({
      severity: 'critical',
      message: `Device ${deviceName} error rate: ${health.error_rate_percent}%`,
      action: 'Check device connection immediately'
    });
  }
}, 5 * 60 * 1000);
```

---

## Troubleshooting

### Issue: Health data not showing

**Symptoms**: DeviceHealthCard shows "Offline" for connected device

**Solution**:
1. Check if migration ran: `SELECT * FROM device_health_metrics;`
2. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'device_health_metrics';`
3. Check backend logs for RPC errors
4. Ensure device has had activity today

---

### Issue: Connection logs not appearing

**Symptoms**: ConnectionLogsTimeline shows "Belum ada riwayat"

**Solution**:
1. Verify logging is active in Railway service
2. Check RLS policies on `device_connection_logs`
3. Test manual log: `SELECT log_device_connection_event(...)`
4. Check filter settings (might be filtering out all events)

---

### Issue: "Gagal memuat health data" error

**Symptoms**: Error message in DeviceHealthCard

**Solution**:
1. Check network tab for 401/403 errors (auth issue)
2. Verify user is authenticated: `supabase.auth.getUser()`
3. Check RPC function exists: `SELECT * FROM pg_proc WHERE proname = 'get_device_health_summary';`
4. Verify device_id is valid UUID

---

## Database Maintenance

### Manual Cleanup

```sql
-- Delete logs older than 90 days
SELECT cleanup_old_device_logs();

-- Delete health metrics older than 90 days
SELECT cleanup_old_health_metrics();
```

### Scheduled Cleanup (Cron)

```sql
-- If pg_cron available
SELECT cron.schedule(
  'cleanup-device-logs',
  '0 2 * * *',  -- Daily at 2 AM
  'SELECT cleanup_old_device_logs()'
);
```

---

## Performance Optimization

### Indexes

All critical queries are indexed:
- Device + timestamp queries
- User + timestamp queries
- Event type filters
- Date range queries

### Query Limits

**Enforced limits**:
- Connection logs: 50 per page (max 200)
- Health metrics: 1 per device per day
- Auto-cleanup: 90 days retention

### Caching Strategy

**Recommended**:
- Cache health summary for 30 seconds
- Cache connection logs for 1 minute
- Invalidate on new events (realtime subscription)

---

## Migration Checklist

### Before Deploying

- [ ] Run migration: `002_device_security_enhancements.sql`
- [ ] Verify all tables created
- [ ] Test RLS policies with test user
- [ ] Verify RPC functions work
- [ ] Check indexes created
- [ ] Test cleanup functions

### After Deploying

- [ ] Monitor error logs for RPC failures
- [ ] Verify health data populating
- [ ] Check connection logs recording
- [ ] Test frontend components
- [ ] Verify auto-refresh working
- [ ] Test pagination
- [ ] Monitor database size growth

---

## Support & Resources

### Documentation
- Backend: `railway-service/services/device/deviceSecurityLogger.js`
- Frontend: `src/components/device/`
- Database: `railway-service/migrations/002_device_security_enhancements.sql`

### Monitoring Queries

```sql
-- Check log volume
SELECT
  event_type,
  COUNT(*) as count,
  DATE(timestamp) as date
FROM device_connection_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY event_type, DATE(timestamp)
ORDER BY date DESC;

-- Check health status distribution
SELECT
  health_status,
  COUNT(*) as device_count
FROM device_health_metrics
WHERE date = CURRENT_DATE
GROUP BY health_status;

-- Check error rates
SELECT
  device_id,
  error_rate_percent,
  messages_sent_today,
  messages_failed_today
FROM device_health_metrics
WHERE date = CURRENT_DATE
  AND error_rate_percent > 10
ORDER BY error_rate_percent DESC;
```

---

## Changelog

### Version 1.0 (2025-11-13)

**Added**:
- ✅ Device connection logging infrastructure
- ✅ Health monitoring system
- ✅ Security validation & sanitization
- ✅ DeviceHealthCard component
- ✅ ConnectionLogsTimeline component
- ✅ SecureInput integration
- ✅ RLS policies for all tables
- ✅ Auto-cleanup functions
- ✅ Comprehensive documentation

**Security Improvements**:
- ✅ XSS protection on all inputs
- ✅ SQL injection prevention
- ✅ RLS enforcement
- ✅ Input validation
- ✅ Error sanitization
- ✅ Audit trail

---

**End of Guide**

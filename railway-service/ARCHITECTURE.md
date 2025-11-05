# 🏗️ Railway Service Architecture (Refactored)

## Overview

Backend service telah direfactor menjadi arsitektur modular untuk meningkatkan maintainability, debugging, dan scalability.

## 📂 Struktur File

```
railway-service/
├── index.js                          # Main orchestrator (277 lines) ⬇️ dari 1019 lines
├── connection-manager-qr.js          # QR connection lifecycle (340 lines)
├── connection-manager-pairing.js     # Pairing connection lifecycle (370 lines)
├── broadcast-processor.js            # Broadcast message processing (440 lines)
├── qr-handler.js                     # QR code generator (existing)
├── pairing-handler-stable.js         # Pairing code generator (existing)
├── redis-client.js                   # Redis client (optional)
├── shared/
│   └── auth-state.js                 # Auth state management (87 lines)
└── package.json
```

## 🔄 Perbandingan: Before vs After

### Before (Monolithic):
```javascript
index.js (1019 lines)
  ├─ Auth state logic
  ├─ QR connection logic
  ├─ Pairing connection logic
  ├─ Broadcast processing
  ├─ Event handlers
  └─ Health checks
```

**Problems:**
- ❌ Sulit debugging (semua logic tercampur)
- ❌ Hard to maintain (1000+ lines dalam 1 file)
- ❌ Tidak modular
- ❌ Testing sulit

### After (Modular):
```javascript
index.js (277 lines) - Orchestrator
  ↓
  ├─ QRConnectionManager          [Isolated QR Logic]
  ├─ PairingConnectionManager      [Isolated Pairing Logic]
  └─ BroadcastProcessor            [Isolated Broadcast Logic]
       ↓
       └─ useSupabaseAuthState     [Shared Auth Logic]
```

**Benefits:**
- ✅ Easy debugging (log prefix: `[QR-Manager]`, `[Pairing-Manager]`, `[Broadcast]`)
- ✅ Maintainable (code organized by responsibility)
- ✅ Modular & reusable
- ✅ Easy to test each component
- ✅ Clear separation of concerns

---

## 📋 Component Details

### 1. **index.js** - Main Orchestrator
**Responsibility:** Service coordination & device polling

**Key Functions:**
- `startService()` - Initialize all managers and polling
- `checkDevices()` - Poll devices and delegate to managers
- `connectWhatsApp()` - Route to QR or Pairing manager
- `healthCheckPing()` - Keep connections alive

**Size:** 277 lines (⬇️ 72% reduction from 1019 lines)

---

### 2. **connection-manager-qr.js** - QR Connection Manager
**Responsibility:** Handle full lifecycle of QR-based WhatsApp connections

**Key Methods:**
- `connect(device, isRecovery)` - Main connection logic
- `setupConnectionHandlers()` - Setup event listeners
- `handleConnectionOpen()` - On successful connection
- `handleConnectionClose()` - On disconnection
- `handleRestartRequired()` - Session recovery
- `handleAuthFailure()` - Clear session & reconnect
- `handleLoggedOut()` - Clean disconnect
- `handleTransientError()` - Temporary errors

**Features:**
- ✅ QR code generation via `qr-handler.js`
- ✅ Session recovery after Railway restart
- ✅ Automatic reconnection logic
- ✅ Detailed logging with `[QR-Manager]` prefix

**Size:** 340 lines

---

### 3. **connection-manager-pairing.js** - Pairing Connection Manager
**Responsibility:** Handle full lifecycle of Pairing Code-based connections

**Key Methods:**
- `connect(device, isRecovery)` - Main connection logic
- `setupConnectionHandlers()` - Setup event listeners
- `handleConnectionOpen()` - On successful connection
- `handleConnectionClose()` - On disconnection
- `handleRestartRequired()` - Session recovery
- `handleAuthFailure()` - Clear session & reconnect
- `handleLoggedOut()` - Clean disconnect
- `handleTransientError()` - Temporary errors

**Features:**
- ✅ Pairing code generation via `pairing-handler-stable.js`
- ✅ Immediate pairing request after socket creation
- ✅ Session recovery after Railway restart
- ✅ Automatic reconnection logic
- ✅ Detailed logging with `[Pairing-Manager]` prefix

**Size:** 370 lines

**Key Difference from QR Manager:**
```javascript
// Pairing-specific: Request pairing code IMMEDIATELY
if (!hasValidSession && !isRecovery) {
  await simplePairingHandler.generatePairingCode(sock, device, supabase);
}

// Skip QR codes in pairing mode
if (qr) {
  console.log('⛔ [Pairing-Manager] QR received but skipped');
}
```

---

### 4. **broadcast-processor.js** - Broadcast Message Processor
**Responsibility:** Handle broadcast message sending with personalization

**Key Methods:**
- `processBroadcasts()` - Check & process pending broadcasts
- `processSingleBroadcast()` - Send messages for one broadcast
- `sendMessageToContact()` - Send to individual contact
- `personalizeMessage()` - Variable replacement
- `getWhatsAppName()` - Fetch WhatsApp profile name
- `prepareMessageContent()` - Handle media/text messages
- `checkScheduledBroadcasts()` - Trigger scheduled broadcasts

**Features:**
- ✅ Message personalization ({{NAME}}, {var1}, etc.)
- ✅ Media handling (image, video, audio, document)
- ✅ Adaptive delays & batching
- ✅ Retry logic for media download
- ✅ Progress tracking during sending
- ✅ Detailed logging with `[Broadcast]` prefix

**Size:** 440 lines

**Personalization Variables:**
- `[[NAME]]` - WhatsApp profile name
- `{{NAME}}` - Contact name from database
- `{var1}`, `{var2}`, `{var3}` - Custom fields
- `{waktu}`, `{tanggal}`, `{hari}` - Time/date
- `(option1|option2)` - Random selection

---

### 5. **shared/auth-state.js** - Auth State Management
**Responsibility:** Persist WhatsApp auth credentials to Supabase

**Key Function:**
- `useSupabaseAuthState(deviceId, supabase)` - Load/save auth state

**Features:**
- ✅ Session persistence in Supabase
- ✅ Automatic credential updates
- ✅ BufferJSON serialization for Baileys
- ✅ Shared by both QR and Pairing managers

**Size:** 87 lines

---

## 🎯 Debugging Guide

### Log Prefixes (Easy Identification)

```bash
[Main]             # index.js orchestrator
[QR-Manager]       # QR connection manager
[Pairing-Manager]  # Pairing connection manager
[Broadcast]        # Broadcast processor
[Auth]             # Auth state management
[Health]           # Health check pings
```

### Example Log Output:

```
🚀 WhatsApp Baileys Service Started (Refactored Architecture)
📡 Using polling mechanism (optimized intervals)
🏗️  Architecture: Modular Connection Managers
   ├─ QR Connection Manager (QR code method)
   ├─ Pairing Connection Manager (Pairing code method)
   └─ Broadcast Processor (Message sending)

🔍 Initial check for pending connections...
📷 [Main] Using QR Manager for: Device-001
🔷 [QR-Manager] Starting QR connection for: Device-001
📦 [Auth] Loading session for device: abc-123
✅ [QR-Manager] Socket created and stored
📷 [QR-Manager] Device-001 - QR code received
✅ [QR-Manager] Device-001 - Connected successfully!
```

### Debugging Specific Issues:

#### Issue: QR Connection Fails
**Check logs for:** `[QR-Manager]` prefix
```bash
❌ [QR-Manager] Authentication failed, clearing session
```

#### Issue: Pairing Code Not Generated
**Check logs for:** `[Pairing-Manager]` prefix
```bash
❌ [Pairing-Manager] Pairing code generation failed
```

#### Issue: Broadcast Not Sending
**Check logs for:** `[Broadcast]` prefix
```bash
❌ [Broadcast] No active socket for device: xyz-789
```

---

## 🚀 How It Works

### Connection Flow (QR Method):

```
1. [Main] User creates device with connection_method='qr'
2. [Main] checkDevices() detects new device
3. [Main] Routes to QRConnectionManager.connect()
4. [QR-Manager] Creates Baileys socket
5. [QR-Manager] Receives QR code event
6. [QR-Handler] Generates QR data URL
7. [Supabase] Saves QR to database
8. [Frontend] Displays QR to user
9. [User] Scans QR with WhatsApp
10. [QR-Manager] Connection opens
11. [Auth] Saves session to Supabase
12. [QR-Manager] Updates device status to 'connected'
```

### Connection Flow (Pairing Method):

```
1. [Main] User creates device with connection_method='pairing'
2. [Main] checkDevices() detects new device
3. [Main] Routes to PairingConnectionManager.connect()
4. [Pairing-Manager] Creates Baileys socket
5. [Pairing-Manager] Immediately requests pairing code
6. [Pairing-Handler] Calls sock.requestPairingCode()
7. [Supabase] Saves pairing code to database
8. [Frontend] Displays pairing code to user
9. [User] Enters code in WhatsApp
10. [Pairing-Manager] Connection opens
11. [Auth] Saves session to Supabase
12. [Pairing-Manager] Updates device status to 'connected'
```

### Broadcast Flow:

```
1. [Frontend] User creates broadcast with status='processing'
2. [Main] Polling detects new broadcast
3. [Broadcast] processBroadcasts() called every 10s
4. [Broadcast] Fetches active socket for device
5. [Broadcast] Loops through contacts
6. [Broadcast] Personalizes message for each contact
7. [Broadcast] Downloads media (if any)
8. [Broadcast] Sends message via sock.sendMessage()
9. [Broadcast] Applies delay between messages
10. [Broadcast] Updates sent_count in database
11. [Broadcast] Marks broadcast as 'completed'
```

---

## 🧪 Testing Strategy

### Unit Testing (Recommended):

```javascript
// test/connection-manager-qr.test.js
describe('QRConnectionManager', () => {
  it('should generate QR code on connect', async () => {
    // Test QR manager in isolation
  });
});

// test/connection-manager-pairing.test.js
describe('PairingConnectionManager', () => {
  it('should request pairing code immediately', async () => {
    // Test pairing manager in isolation
  });
});

// test/broadcast-processor.test.js
describe('BroadcastProcessor', () => {
  it('should personalize messages correctly', () => {
    // Test message personalization
  });
});
```

### Integration Testing:

```bash
# Test QR connection
node -e "require('./connection-manager-qr').connect(mockDevice)"

# Test Pairing connection
node -e "require('./connection-manager-pairing').connect(mockDevice)"

# Test Broadcast
node -e "require('./broadcast-processor').processBroadcasts()"
```

---

## 📊 Performance Improvements

### Code Organization:
- **Before:** 1 file with 1019 lines
- **After:** 5 modular files with clear responsibilities

### Debugging Time:
- **Before:** Search through 1000+ lines to find issue
- **After:** Check specific manager based on log prefix

### Maintainability:
- **Before:** Risky to modify (everything coupled)
- **After:** Safe to modify one manager without affecting others

### Extensibility:
- **Before:** Hard to add new connection methods
- **After:** Just create new manager class

---

## 🔮 Future Enhancements

### Easy to Add:
1. **WebAuthConnectionManager** - For WhatsApp Web Auth method
2. **ChatbotProcessor** - Extract chatbot logic
3. **AutoPostProcessor** - Extract auto-post logic
4. **WebhookManager** - Handle webhook events

### Pattern:
```javascript
// Add new manager
const NewManager = require('./new-manager');
const newManager = new NewManager(supabase, activeSockets);

// Use in index.js
if (device.connection_method === 'new_method') {
  await newManager.connect(device);
}
```

---

## 🎓 Key Takeaways

1. **Modular is Better** - Each manager handles one responsibility
2. **Log Prefixes** - Make debugging 10x easier
3. **DRY Principle** - Auth state shared across managers
4. **Single Responsibility** - Each file has one clear purpose
5. **Easy to Test** - Components can be tested in isolation

---

## 📝 Notes

- All existing functionality preserved
- No breaking changes to frontend
- Backward compatible with existing database
- Redis remains optional (handled gracefully if unavailable)

---

**Refactored by:** Claude Agent SDK
**Date:** November 5, 2025
**Improvement:** 72% code reduction in main file + full modularity

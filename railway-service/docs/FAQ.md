# ❓ FAQ - BullMQ & Rate Limiting

## 🤔 Pertanyaan Umum

### 1. **Apakah saya harus install BullMQ atau database BullMQ secara manual?**

**Jawaban: TIDAK!** ❌

BullMQ sudah **otomatis terinstall** via npm saat kamu run `npm install`.

**Penjelasan:**
```bash
# BullMQ sudah ada di package.json
"dependencies": {
  "bullmq": "^5.63.1",    # ← Library JavaScript (sudah installed)
  "ioredis": "^5.8.2"     # ← Redis client (sudah installed)
}

# Saat run npm install, semua dependency otomatis ke-download
npm install  # ✅ BullMQ & ioredis installed!
```

**BullMQ BUKAN database!** BullMQ adalah:
- ✅ JavaScript library untuk job queue
- ✅ Pakai Redis sebagai storage (yang sudah kamu punya: Upstash)
- ✅ No additional database needed!

**Yang Perlu Kamu Lakukan:**
1. ✅ Install dependencies (via `npm install`) - **SUDAH DONE**
2. ✅ Add `UPSTASH_REDIS_URL` ke environment variables
3. ✅ Deploy ulang
4. ✅ Done! BullMQ otomatis jalan

**Tidak Perlu:**
- ❌ Install database terpisah
- ❌ Setup BullMQ server
- ❌ Install Redis lokal
- ❌ Konfigurasi tambahan

---

### 2. **Rate limit terlalu ketat! Customer saya bisa kabur!**

**Jawaban: Rate limit sudah saya ADJUST ke nilai yang business-friendly!** ✅

**SEBELUM (Terlalu Ketat):**
```javascript
❌ Broadcasts: 10/hour, 50/day     // Terlalu sedikit
❌ Messages: 30/min, 500/hour      // Terlalu ketat
❌ API: 60/min, 1000/hour          // Kurang untuk business
```

**SESUDAH (Business-Friendly):** ✅
```javascript
✅ Broadcasts: 50/hour, 200/day    // Cukup generous
✅ Messages: 100/min, 3000/hour, 10k/day  // Business-friendly
✅ API: 120/min (2/sec), 5000/hour  // Comfortable
```

**Premium Users (Automatic 3x):**
```javascript
Premium Broadcasts: 150/hour, 600/day
Premium Messages: 300/min, 9000/hour, 30k/day
Premium API: 360/min, 15k/hour
```

**Kapan Rate Limit Triggered?**

Rate limit HANYA triggered jika user:
1. Abuse sistem (spam)
2. Kirim ribuan pesan dalam hitungan menit
3. API call berlebihan

**Normal Usage:** ✅ **TIDAK KENA LIMIT**

Contoh normal usage:
- User kirim 50 pesan per menit = ✅ OK (limit: 100/min)
- User buat 20 broadcast per hari = ✅ OK (limit: 200/day)
- User hit API 50x per menit = ✅ OK (limit: 120/min)

---

### 3. **Bagaimana cara adjust rate limit sesuai kebutuhan saya?**

**Jawaban: Edit file `services/rateLimit/userRateLimit.js`**

```javascript
// File: railway-service/services/rateLimit/userRateLimit.js
// Line 25-58

const RATE_LIMITS = {
  BROADCAST: {
    MAX_PER_HOUR: 50,      // ← UBAH INI sesuai kebutuhan
    MAX_PER_DAY: 200,      // ← UBAH INI sesuai kebutuhan
  },

  MESSAGE: {
    MAX_PER_MINUTE: 100,   // ← UBAH INI
    MAX_PER_HOUR: 3000,    // ← UBAH INI
    MAX_PER_DAY: 10000,    // ← UBAH INI
  },

  API_CALL: {
    MAX_PER_MINUTE: 120,   // ← UBAH INI
    MAX_PER_HOUR: 5000,    // ← UBAH INI
  },
};
```

**Rekomendasi Berdasarkan Skala:**

**Small Business (10-50 users):**
```javascript
BROADCAST: { MAX_PER_HOUR: 50, MAX_PER_DAY: 200 }    // ✅ Current
MESSAGE: { MAX_PER_MINUTE: 100, MAX_PER_HOUR: 3000 } // ✅ Current
```

**Medium Business (50-200 users):**
```javascript
BROADCAST: { MAX_PER_HOUR: 100, MAX_PER_DAY: 500 }
MESSAGE: { MAX_PER_MINUTE: 200, MAX_PER_HOUR: 5000 }
```

**Large Business (200+ users):**
```javascript
BROADCAST: { MAX_PER_HOUR: 200, MAX_PER_DAY: 1000 }
MESSAGE: { MAX_PER_MINUTE: 300, MAX_PER_HOUR: 10000 }
```

**Unlimited (Disable Rate Limit):**
```javascript
// Set ke nilai sangat besar
BROADCAST: { MAX_PER_HOUR: 999999, MAX_PER_DAY: 999999 }
MESSAGE: { MAX_PER_MINUTE: 999999, MAX_PER_HOUR: 999999 }

// Atau skip rate limit check di code
```

**Setelah Edit:**
```bash
git add services/rateLimit/userRateLimit.js
git commit -m "Adjust rate limits"
git push
# Railway auto-deploy
```

---

### 4. **Apakah rate limit ini per user atau global?**

**Jawaban: PER USER!** ✅

Setiap user punya limit sendiri-sendiri. Tidak saling affect.

**Contoh:**
- User A kirim 100 pesan/menit = ✅ OK
- User B kirim 100 pesan/menit = ✅ OK (independent)
- User C kirim 100 pesan/menit = ✅ OK (independent)

**Total:** 300 pesan/menit across all users = ✅ **ALLOWED**

Rate limit tracking pakai Redis dengan key:
```
ratelimit:user:USER_ID:message:minute
ratelimit:user:USER_ID:broadcast:hour
```

---

### 5. **Bagaimana cara monitor rate limit?**

**Option 1: Pakai CLI**
```bash
node cli/session-manager.js stats
```

**Option 2: Pakai UserRateLimit Service**
```javascript
const userRateLimit = require('./services/rateLimit/userRateLimit');

// Get status
const status = await userRateLimit.getUserRateLimitStatus(userId);

console.log(status);
/*
{
  userId: "abc-123",
  limits: {
    broadcast: {
      allowed: true,
      hourly: { current: 15, max: 50, remaining: 35 },
      daily: { current: 45, max: 200, remaining: 155 }
    },
    message: {
      allowed: true,
      perMinute: { current: 25, max: 100, remaining: 75 },
      perHour: { current: 850, max: 3000, remaining: 2150 },
      perDay: { current: 3200, max: 10000, remaining: 6800 }
    }
  },
  overallStatus: "OK"
}
*/
```

**Option 3: Check Logs**
```bash
pm2 logs | grep "Rate limit"
# atau
railway logs | grep "Rate limit"
```

---

### 6. **Bagaimana cara disable rate limit untuk user tertentu?**

**Option 1: Buat Premium Plan** (Automatic 3x limits)
```sql
-- Di Supabase SQL Editor
INSERT INTO subscriptions (user_id, plan_id, status)
VALUES ('user-uuid', 'premium-plan-id', 'active');
```

**Option 2: Manual Reset (Admin)**
```javascript
const userRateLimit = require('./services/rateLimit/userRateLimit');

// Reset all limits for user
await userRateLimit.resetUserRateLimits(userId);
```

**Option 3: Whitelist User (Code Level)**
```javascript
// Di rate limit check, tambah whitelist
const WHITELISTED_USERS = [
  'user-id-1',
  'user-id-2',
  'admin-user-id',
];

async function checkBroadcastLimit(userId) {
  // Skip rate limit for whitelisted users
  if (WHITELISTED_USERS.includes(userId)) {
    return { allowed: true, message: 'Whitelisted user' };
  }

  // Normal rate limit check
  // ...
}
```

---

### 7. **Redis Upstash saya cuma 1 instance, cukup untuk semua?**

**Jawaban: CUKUP!** ✅

Satu instance Redis Upstash bisa handle:
- ✅ QR codes (temporary)
- ✅ Pairing codes (temporary)
- ✅ Rate limiting counters
- ✅ Cache (templates, contacts, settings)
- ✅ BullMQ job queue
- ✅ Session data (opsional)

**Cara Kerja:**
```
Upstash Redis Instance
├── Keys: qr:device-id                    (TTL: 10 min)
├── Keys: pairing:device-id               (TTL: 10 min)
├── Keys: ratelimit:user:id:*             (TTL: dynamic)
├── Keys: cache:template:*                (TTL: 1 hour)
├── Keys: cache:contact:*                 (TTL: 5-10 min)
├── Queue: bull:broadcasts:*              (persistent)
└── [Other keys...]
```

**Tidak Perlu:**
- ❌ Redis instance terpisah untuk BullMQ
- ❌ Redis instance terpisah untuk cache
- ❌ Redis instance terpisah untuk rate limit

**Satu Redis Upstash = Hemat Biaya!** 💰

---

### 8. **Web dashboard visual queue monitor itu seperti apa?**

**BullBoard Dashboard** adalah web UI untuk monitoring job queue.

**Features:**
- 📊 **Queue Statistics**: Waiting, active, completed, failed jobs
- 📋 **Job List**: See all jobs dengan filter (status, date, etc)
- 🔍 **Job Detail**: Click job untuk lihat data lengkap
- ⏱️ **Timing Info**: Job duration, timestamp, etc
- ❌ **Failed Jobs**: See error messages, retry
- 📈 **Charts**: Visual graphs untuk queue performance

**Access:**
```
http://your-domain.com/admin/queues
atau
http://localhost:3001/admin/queues
```

**Login:**
```
Username: admin
Password: [set via ADMIN_PASSWORD env var]
```

**Screenshot Konsep (Text-based):**
```
┌─────────────────────────────────────────────────────────┐
│  BullMQ Dashboard - Queue: broadcasts                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Statistics                                           │
│  ┌─────────────┬─────────────┬─────────────┬──────────┐│
│  │ Waiting: 5  │ Active: 2   │ Completed:  │ Failed: 1││
│  │             │             │ 1,234       │          ││
│  └─────────────┴─────────────┴─────────────┴──────────┘│
│                                                          │
│  📋 Recent Jobs                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ID: broadcast-abc-123                             │  │
│  │ Status: ✅ Completed                              │  │
│  │ Progress: 100%                                    │  │
│  │ Duration: 45 seconds                              │  │
│  │ Created: 2025-11-13 10:30:15                      │  │
│  │ [View Details] [Remove]                           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  │ ID: broadcast-def-456                             │  │
│  │ Status: ⏳ Active (Processing)                    │  │
│  │ Progress: 65%                                     │  │
│  │ Sent: 650/1000 messages                           │  │
│  │ [View Details] [Pause]                            │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  │ ID: broadcast-ghi-789                             │  │
│  │ Status: ❌ Failed                                 │  │
│  │ Error: Device not connected                       │  │
│  │ Attempts: 3/3                                     │  │
│  │ [View Details] [Retry]                            │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [Refresh] [Clear Completed] [Settings]                 │
└─────────────────────────────────────────────────────────┘
```

**Cara Pakai:**
1. Start monitoring server: `node monitoring/dashboard-server.js`
2. Buka browser: `http://localhost:3001/admin/queues`
3. Login dengan credentials
4. Monitor queue real-time!

**Use Cases:**
- 🔍 Debug failed jobs
- 📊 Monitor queue health
- ⏱️ Check job performance
- ❌ Retry failed jobs manually
- 🗑️ Clean completed jobs

---

### 9. **Apakah rate limit ini affect WhatsApp official API?**

**Jawaban: TIDAK!** ❌

Rate limit ini adalah **aplikasi-level**, bukan WhatsApp-level.

**2 Layer Rate Limiting:**

**Layer 1: Aplikasi HalloWa.id (This)**
- ✅ Kontrol user usage
- ✅ Prevent abuse
- ✅ Configurable
- ✅ Per-user basis

**Layer 2: WhatsApp (Official)**
- ⚠️ WhatsApp punya limit sendiri (~1000 msg/day/device)
- ⚠️ Bisa kena ban jika spam
- ⚠️ Tidak bisa di-disable

**Rekomendasi:**
Set aplikasi rate limit **BELOW** WhatsApp limit untuk safety:

```javascript
// WhatsApp Official: ~1000 messages/day/device
// HalloWa.id Setting: 10,000 messages/day/user (across all devices)

// User dengan 1 device: 10k limit (tapi WhatsApp limit 1k)
// User dengan 10 devices: 10k limit (spread across devices = 1k/device) ✅ SAFE
```

---

### 10. **Summary: Apa yang harus saya lakukan sekarang?**

**Checklist:**

1. ✅ **Rate Limit** - Already adjusted, business-friendly values
2. ✅ **BullMQ** - No manual install needed, just add `UPSTASH_REDIS_URL`
3. ✅ **Monitoring** - Optional, start with `node monitoring/dashboard-server.js`
4. ✅ **Environment Variables** - Update .env dengan values dari .env.example

**Next Steps:**

```bash
# 1. Update .env file
cp .env.example .env
nano .env  # Fill with actual values

# 2. Add UPSTASH_REDIS_URL (dari Upstash dashboard)
# Get from: https://console.upstash.com/redis/YOUR_REDIS > Details

# 3. Deploy ulang
git pull
npm install  # Re-install dependencies (if needed)
pm2 restart all  # atau railway deploy

# 4. Test
curl http://your-domain/health
node cli/session-manager.js stats

# 5. (Optional) Start monitoring
node monitoring/dashboard-server.js &
```

**That's it!** ✅ Customer tidak akan kabur, rate limit friendly! 🎉

---

## 📞 Need Help?

- Check logs: `pm2 logs` or `railway logs`
- CLI stats: `node cli/session-manager.js stats`
- Monitoring: `http://localhost:3001/admin/queues`
- Docs: `docs/VPS_DEPLOYMENT.md` atau `docs/RAILWAY_DEPLOYMENT.md`

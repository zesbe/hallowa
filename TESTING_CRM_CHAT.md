# CRM Chat Testing Guide

## ✅ Fitur yang Sudah Selesai

### Backend Integration
- ✅ Baileys message listener untuk save semua pesan ke database
- ✅ HTTP server endpoint `/send-message` untuk kirim pesan
- ✅ Auto-save pesan yang dikirim via HTTP ke database
- ✅ Timestamp validation (handle invalid timestamps)
- ✅ Skip status broadcast messages
- ✅ Null checks untuk prevent crashes
- ✅ Error handling untuk non-JSON responses

### Frontend CRM Chat
- ✅ Real WhatsApp conversations dari database
- ✅ Realtime subscriptions untuk live updates
- ✅ Performance optimization (startTransition, useCallback, useMemo)
- ✅ Send message via Edge Function
- ✅ Enterprise features (star, archive, label, notes)
- ✅ Fixed circular dependency (blank screen issue)

### Database
- ✅ `whatsapp_conversations` table
- ✅ `whatsapp_messages` table
- ✅ Triggers untuk auto-update last message
- ✅ RLS policies untuk security
- ✅ Performance indexes

---

## 🧪 Testing Checklist

### 1. Test Terima Pesan dari WhatsApp → CRM

**Steps:**
1. Pastikan device sudah connected di `/devices`
2. Buka `/crm-chat` di browser
3. Dari HP lain, kirim pesan WhatsApp ke nomor device
4. **Expected Result:**
   - ✅ Conversation muncul otomatis di CRM (tanpa refresh)
   - ✅ Pesan muncul dengan timestamp yang benar
   - ✅ Nama/nomor contact ditampilkan
   - ✅ Last message preview ter-update

**Railway Logs Should Show:**
```
💬 [DeviceName] Message from: 628xxx
💬 Saved message to CRM: 628xxx - text
```

**Supabase Realtime Should Trigger:**
Browser console log:
```
📱 Conversation update: {...}
💬 New message received: {...}
```

---

### 2. Test Kirim Pesan dari CRM → WhatsApp

**Steps:**
1. Buka `/crm-chat`
2. Pilih conversation yang ingin dikirim pesan
3. Ketik pesan di input box
4. Klik tombol Send
5. **Expected Result:**
   - ✅ Pesan muncul di CRM dengan status "sent"
   - ✅ Pesan diterima di WhatsApp HP penerima
   - ✅ Status berubah "delivered" → "read" (setelah dibaca)

**Railway Logs Should Show:**
```
📤 Message sent via HTTP: 628xxx - text
💬 Saved message to CRM: 628xxx - text
```

**Edge Function Logs (Supabase):**
```
Railway response status: 200
Railway response text: {"success":true,"messageId":"..."}
```

---

### 3. Test Enterprise Features

#### Star Conversation
1. Click icon ⭐ di conversation
2. **Expected:** Conversation marked as starred
3. Filter by "Starred" → conversation muncul

#### Add Label
1. Select conversation
2. Click label dropdown
3. Choose label (Lead, Customer, Support, VIP, Follow-up)
4. **Expected:** Label badge muncul di conversation

#### Add Notes
1. Open conversation
2. Click panel kanan (info icon)
3. Add notes di text area
4. **Expected:** Notes tersimpan, muncul saat dibuka lagi

#### Archive Conversation
1. Click Archive button
2. **Expected:** Conversation pindah ke "Archived" filter
3. Filter by "Archived" → conversation muncul

#### Search
1. Ketik nama atau nomor HP di search box
2. **Expected:** Filter conversations by search term

---

### 4. Test Realtime Updates (Multi-Tab)

**Steps:**
1. Buka `/crm-chat` di 2 browser tabs berbeda
2. Kirim pesan dari HP WhatsApp ke device
3. **Expected:**
   - ✅ Kedua tabs update secara realtime
   - ✅ Conversation muncul di kedua tabs
   - ✅ Message muncul di kedua tabs

**OR:**
1. Buka `/crm-chat` di 2 browser tabs
2. Kirim pesan dari salah satu tab
3. **Expected:**
   - ✅ Tab lainnya update dengan pesan baru
   - ✅ Last message preview ter-update di kedua tabs

---

### 5. Test Error Handling

#### Status Broadcast (Should Skip)
1. Update WhatsApp Status dari HP
2. **Expected:**
   - ✅ Railway log: `⏭️ Skipping status broadcast message`
   - ✅ Tidak ada error di Railway logs
   - ✅ Status TIDAK muncul di CRM Chat

#### Device Not Connected
1. Disconnect device di `/devices`
2. Coba kirim pesan dari CRM
3. **Expected:**
   - ✅ Error message: "Device not connected"
   - ✅ Tidak crash

#### Invalid Timestamp
1. (Automatically handled)
2. **Expected:**
   - ✅ Fallback to current time jika timestamp invalid
   - ✅ No crash

---

## 🔍 Debugging Tools

### Railway Logs
Check for:
- `✅ Connected: DeviceName`
- `📱 CRM message listeners configured`
- `💬 Saved message to CRM`
- `📤 Message sent via HTTP`
- Any errors (❌)

### Supabase Edge Function Logs
Path: **Supabase Dashboard → Edge Functions → send-crm-message → Logs**

Check for:
- `Railway response status: 200`
- Any parse errors

### Browser Console (F12)
Check for:
- `✅ Subscribed to conversations updates`
- `✅ Subscribed to messages for conversation: <name>`
- `📱 Conversation update:`
- `💬 New message received:`

### Database Queries
Check data directly:
```sql
-- Check conversations
SELECT * FROM whatsapp_conversations
ORDER BY updated_at DESC
LIMIT 10;

-- Check messages
SELECT * FROM whatsapp_messages
ORDER BY timestamp DESC
LIMIT 20;
```

---

## 🚨 Common Issues & Solutions

### Issue: "Gagal memuat percakapan"
**Solution:** Database migration belum dijalankan
- Run migration SQL di Supabase SQL Editor
- File: `supabase/migrations/20250108_create_whatsapp_conversations_safest.sql`

### Issue: Pesan tidak muncul realtime
**Solution:**
- Refresh halaman untuk reconnect subscription
- Check browser console untuk WebSocket errors
- Verify Supabase Realtime enabled di database settings

### Issue: "Device not connected" error saat send
**Solution:**
- Verify device status = "connected" di `/devices`
- Check Railway service is running
- Verify BAILEYS_SERVICE_URL di Edge Function settings

### Issue: Railway return non-JSON response
**Solution:**
- Already handled with fallback
- Check Railway logs untuk actual error
- Verify HTTP server running (check `/health` endpoint)

---

## 📊 Performance Metrics

### Target Metrics:
- ✅ Message receive latency: < 2 seconds
- ✅ Message send latency: < 3 seconds
- ✅ UI interaction (INP): < 200ms
- ✅ Realtime update: < 1 second

### How to Check:
- Browser DevTools → Performance tab
- Network tab → Check API call timing
- Console logs → Timestamp differences

---

## 🎯 Production Checklist

Before going live:
- [ ] All tests passed
- [ ] No errors in Railway logs (24h monitoring)
- [ ] No errors in Supabase Edge Function logs
- [ ] Realtime updates working consistently
- [ ] Performance metrics meet targets
- [ ] Database indexes created (already done)
- [ ] RLS policies verified (already done)
- [ ] Environment variables configured:
  - [ ] `BAILEYS_SERVICE_URL` di Supabase Edge Function
  - [ ] `SUPABASE_URL` di Railway
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` di Railway

---

## 📝 Next Features (Future)

Possible enhancements:
- [ ] Media message support (images, videos)
- [ ] Voice message playback
- [ ] Message search
- [ ] Export chat history
- [ ] Chat templates
- [ ] Auto-reply rules
- [ ] Contact management
- [ ] Analytics dashboard

---

**Last Updated:** 2025-11-08
**Version:** 1.0.0

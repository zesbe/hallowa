# Fix Pairing Code Issue - Dokumentasi

## Masalah
Kode pairing berhasil di-generate di Railway service (`7C737NN2`) tetapi tidak muncul di aplikasi frontend karena:
1. Redis credentials belum dikonfigurasi di Supabase Edge Functions
2. Edge Function `get-device-qr` tidak bisa mengambil kode dari Redis

## Log Railway yang Menunjukkan Sukses
```
📱 Preparing pairing code for: 6285222205171
⏳ Waiting for connection to stabilize...
🔐 Calling requestPairingCode...
✅ Pairing code generated: 7C737NN2
📱 Pairing code ready for user input
```

## Alur Sistem
1. **Frontend** → Request pairing dengan nomor telepon
2. **Railway Service** → Generate kode pairing via WhatsApp/Baileys
3. **Railway Service** → Simpan kode ke Redis (Upstash) 
4. **Frontend** → Poll Edge Function `get-device-qr` 
5. **Edge Function** → Ambil kode dari Redis ❌ (GAGAL - Redis tidak dikonfigurasi)
6. **Frontend** → Tampilkan kode ke user

## Solusi

### Step 1: Konfigurasi Redis di Supabase Edge Functions

#### Via Supabase Dashboard (Recommended)
1. Buka: https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/settings/vault
2. Klik "New Secret"
3. Tambahkan 2 secrets:
   
   **Secret 1:**
   - Name: `UPSTASH_REDIS_REST_URL`
   - Value: (ambil dari Railway atau Upstash console)
   
   **Secret 2:**
   - Name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: (ambil dari Railway atau Upstash console)

#### Via Supabase CLI
```bash
# Install Supabase CLI jika belum
npm install -g supabase

# Login
supabase login

# Set secrets (ganti dengan nilai yang benar)
supabase secrets set UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io" --project-ref ierdfxgeectqoekugyvb
supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-token-here" --project-ref ierdfxgeectqoekugyvb
```

### Step 2: Cara Mendapatkan Redis Credentials

#### Option A: Dari Railway Environment Variables
1. Login ke Railway: https://railway.app
2. Buka project WhatsApp service Anda
3. Go to Variables tab
4. Copy nilai dari:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### Option B: Dari Upstash Dashboard
1. Login ke: https://console.upstash.com
2. Pilih Redis database Anda
3. Scroll ke section "REST API"
4. Copy:
   - REST URL
   - REST Token

### Step 3: Deploy Ulang Edge Functions (Otomatis)
Setelah menambahkan secrets, Edge Functions akan otomatis memiliki akses. Tidak perlu deploy ulang.

### Step 4: Test Koneksi
1. Buka aplikasi
2. Go to Devices page
3. Klik "Connect" pada device
4. Pilih "Kode Pairing"
5. Masukkan nomor WhatsApp
6. Klik "Hubungkan"
7. Kode 8 digit seharusnya muncul

## Debugging

### Check Redis Connection dari Browser Console
```javascript
// Buka browser console saat di halaman Devices
// Lihat log untuk:
// "📱 Pairing code received: XXXXXXXX"
```

### Check Edge Function Logs
1. Buka: https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/functions/get-device-qr/logs
2. Cari error terkait Redis

### Test Manual Edge Function
```bash
# Test dengan curl (ganti dengan session token Anda)
curl -X POST https://ierdfxgeectqoekugyvb.supabase.co/functions/v1/get-device-qr \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "YOUR_DEVICE_ID"}'
```

## Common Issues

### Issue 1: "Redis not configured"
**Cause:** Redis credentials belum di-set di Supabase Vault
**Solution:** Ikuti Step 1 di atas

### Issue 2: Kode tidak muncul walaupun Redis sudah dikonfigurasi
**Cause:** Possible mismatch device ID atau user authentication
**Solution:** 
- Pastikan login dengan user yang sama
- Check device ID di database matches

### Issue 3: Kode expired terlalu cepat
**Cause:** TTL terlalu pendek
**Solution:** Railway service sudah set 10 menit TTL, seharusnya cukup

## Monitoring

### Railway Logs
```bash
# Check apakah kode berhasil di-generate
✅ Pairing code generated: XXXXXXXX
```

### Frontend Console
```javascript
// Check apakah kode diterima dari Edge Function
📱 Pairing code received: XXXXXXXX
```

### Redis Check (via Upstash Console)
1. Login Upstash
2. Go to Data Browser
3. Search key: `pairing:DEVICE_ID`
4. Lihat value kode pairing

## Contact Support
Jika masih ada masalah setelah mengikuti guide ini:
1. Check Railway logs untuk error detail
2. Check Supabase Edge Function logs
3. Screenshot error dan kirim untuk bantuan

## Update Frontend (Sudah Dilakukan)
Frontend sudah diupdate dengan:
- Better error logging
- Debug messages untuk pairing flow
- Toast notification dengan kode pairing

## Status: ACTION REQUIRED
✅ Railway service: Working (kode berhasil di-generate)
✅ Frontend code: Updated with debugging
❌ **Redis Credentials di Supabase: BELUM DIKONFIGURASI**
⏳ Waiting for: User menambahkan Redis credentials ke Supabase Vault

---
Last Updated: 2025-01-11
Issue: Pairing code generated but not displayed
Solution: Add Redis credentials to Supabase Edge Functions
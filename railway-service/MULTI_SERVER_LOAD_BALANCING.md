# Multi-Server Load Balancing dengan Auto-Assignment

## 🎯 Overview

Sistem multi-server sekarang **otomatis** mendistribusikan device ke server berdasarkan **capacity** dan **load** masing-masing server.

## ✨ Fitur Baru

### 1. **Auto-Assignment dengan Load Balancing**
- Device baru otomatis di-assign ke server dengan load terendah
- Menghindari **conflict error** (Stream Errored) akibat multiple connections
- Distribusi merata berdasarkan `max_capacity` setiap server

### 2. **Capacity Limits per Server**
- Setiap server punya batas capacity (default: 50 sesi)
- Load balancing otomatis memilih server dengan ruang tersedia
- Server full akan di-skip saat assignment

### 3. **Conflict Prevention**
- Hanya server yang **assigned** boleh connect ke device
- Unassigned device akan di-claim oleh server terbaik terlebih dahulu
- Eliminasi error `Stream Errored (conflict)`

## 🔧 Konfigurasi Server

### Environment Variables

Setiap server VPS harus set environment variables berikut:

```bash
# SERVER IDENTITY
SERVER_NAME="Server-VPS-1"              # Nama unik server
SERVER_TYPE="vps"                        # Type: vps, cloud, local
SERVER_REGION="asia-southeast"           # Region geografis

# CAPACITY MANAGEMENT
SERVER_MAX_CAPACITY=50                   # Max sesi per server (default: 50)
SERVER_PRIORITY=0                        # Priority (0=normal, 1=high, -1=low)

# SERVER URL (untuk health check)
SERVER_URL="http://168.110.212.151:3000"
```

### Contoh untuk Multi-VPS Setup

**Server 1 (VPS Singapore):**
```bash
SERVER_NAME="SG-Server-1"
SERVER_MAX_CAPACITY=50
SERVER_PRIORITY=1
SERVER_REGION="singapore"
SERVER_URL="http://103.xxx.xxx.xxx:3000"
```

**Server 2 (VPS Jakarta):**
```bash
SERVER_NAME="JKT-Server-1"
SERVER_MAX_CAPACITY=30
SERVER_PRIORITY=0
SERVER_REGION="jakarta"
SERVER_URL="http://168.xxx.xxx.xxx:3000"
```

**Server 3 (VPS Surabaya):**
```bash
SERVER_NAME="SBY-Server-1"
SERVER_MAX_CAPACITY=40
SERVER_PRIORITY=0
SERVER_REGION="surabaya"
SERVER_URL="http://139.xxx.xxx.xxx:3000"
```

## 🔄 Cara Kerja Auto-Assignment

### 1. Device Baru Dibuat
```
User → Tambah Device → Status: disconnected
assigned_server_id: NULL
```

### 2. User Klik "Connect"
```
Frontend → Update status: connecting
Backend → Device Manager deteksi device baru
```

### 3. Load Balancing Algorithm
```sql
-- System cari server terbaik berdasarkan:
1. is_healthy = true AND is_active = true
2. current_load < max_capacity (punya ruang)
3. priority DESC (priority tinggi dipilih dulu)
4. current_load ASC (load terendah dipilih)
```

### 4. Auto-Assignment
```
Server terpilih → Assign device ke dirinya
Device → assigned_server_id = server_id
Server → Mulai koneksi WhatsApp
```

### 5. Prevention
```
Server lain → Deteksi device sudah assigned
Server lain → SKIP device (tidak coba connect)
✅ Tidak ada conflict!
```

## 📊 Monitoring Load Balancing

### Cek Current Load per Server

```sql
SELECT 
  server_name,
  current_load,
  max_capacity,
  ROUND((current_load::FLOAT / max_capacity * 100), 2) as usage_percentage,
  is_healthy,
  is_active
FROM backend_servers
ORDER BY usage_percentage DESC;
```

### Cek Device Distribution

```sql
SELECT 
  s.server_name,
  COUNT(d.id) as device_count,
  s.max_capacity,
  s.current_load,
  COUNT(CASE WHEN d.status = 'connected' THEN 1 END) as connected_count
FROM backend_servers s
LEFT JOIN devices d ON d.assigned_server_id = s.id
GROUP BY s.id, s.server_name, s.max_capacity, s.current_load
ORDER BY device_count DESC;
```

### Lihat Device Assignment History

```sql
SELECT 
  created_at,
  message,
  details->>'device_id' as device_id,
  details->>'old_server' as old_server,
  details->>'new_server' as new_server
FROM server_logs
WHERE log_type = 'info' 
  AND message = 'Device assignment changed'
ORDER BY created_at DESC
LIMIT 20;
```

## 🚨 Troubleshooting

### Problem: Masih Ada Conflict Error

**Penyebab:** Multiple server menjalankan versi lama

**Solusi:**
```bash
# Restart SEMUA server VPS
pm2 restart all

# Atau restart satu per satu
pm2 restart multi-wa-mate
```

### Problem: Device Tidak Auto-Assign

**Penyebab:** Tidak ada server healthy

**Cek:**
```sql
SELECT * FROM backend_servers 
WHERE is_healthy = true AND is_active = true;
```

**Solusi:**
- Pastikan minimal 1 server running
- Cek health check berhasil (status 200-499, bukan 5xx)

### Problem: Server Melebihi Capacity

**Penyebab:** `max_capacity` terlalu kecil

**Solusi:**
```sql
-- Update max capacity server
UPDATE backend_servers 
SET max_capacity = 100
WHERE server_name = 'Server-VPS-1';
```

Atau set env variable:
```bash
SERVER_MAX_CAPACITY=100
```

## 🎯 Best Practices

### 1. **Set Capacity Realistis**
```
- Server 2GB RAM: max_capacity = 20-30
- Server 4GB RAM: max_capacity = 40-60
- Server 8GB RAM: max_capacity = 80-120
```

### 2. **Use Priority untuk VIP Server**
```bash
# Server utama (premium VPS)
SERVER_PRIORITY=2
SERVER_MAX_CAPACITY=100

# Server backup (shared VPS)
SERVER_PRIORITY=-1
SERVER_MAX_CAPACITY=30
```

### 3. **Monitor Resource Usage**
```bash
# Cek RAM usage
free -h

# Cek PM2 status
pm2 status

# Cek logs
pm2 logs multi-wa-mate --lines 50
```

### 4. **Failover Strategy**
- Jika server unhealthy, devices otomatis di-reassign
- Set multiple servers untuk redundancy
- Monitor health check secara berkala

## 📝 Quick Setup Checklist

- [ ] Set `SERVER_NAME` unik untuk setiap VPS
- [ ] Set `SERVER_MAX_CAPACITY` sesuai RAM server
- [ ] Set `SERVER_URL` dengan IP publik VPS
- [ ] Restart service: `pm2 restart all`
- [ ] Verifikasi server muncul di Admin → Server Management
- [ ] Test health check semua server
- [ ] Create test device dan verify auto-assignment
- [ ] Monitor logs untuk conflict errors

## 🔗 Related Files

- `railway-service/services/server/serverAssignmentService.js` - Load balancing logic
- `railway-service/services/device/deviceManager.js` - Auto-assignment implementation
- `railway-service/services/whatsapp/connectionManager.js` - Connection handler
- `supabase/migrations/*_backend_servers.sql` - Database schema

## 📞 Support

Jika masih ada masalah:
1. Check logs: `pm2 logs multi-wa-mate`
2. Verify server health di Admin Panel
3. Query database untuk cek assignment
4. Restart semua services jika perlu

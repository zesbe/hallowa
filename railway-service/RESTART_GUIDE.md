# 🔄 Guide Restart Service Setelah Update

## 📌 Setelah Update Code

Setelah pull update dari Git, **WAJIB** restart service dengan cara yang benar:

### ✅ Cara Restart yang Benar

```bash
# 1. Stop service dulu (clean shutdown)
pm2 stop multi-wa-mate

# 2. Tunggu 5 detik
sleep 5

# 3. Start ulang
pm2 start multi-wa-mate

# 4. Cek logs untuk memastikan tidak ada error
pm2 logs multi-wa-mate --lines 50
```

### ❌ Cara yang SALAH (Menyebabkan SIGTERM)

```bash
# JANGAN langsung restart tanpa stop dulu
pm2 restart multi-wa-mate  # ❌ Bisa crash!
```

## 🔍 Cek Status Service

```bash
# Lihat status
pm2 status

# Lihat logs real-time
pm2 logs multi-wa-mate

# Lihat logs terakhir
pm2 logs multi-wa-mate --lines 100
```

## 🚨 Jika Service Crash (SIGTERM Error)

### 1. Clean Restart
```bash
# Stop semua
pm2 stop all

# Delete dari PM2
pm2 delete multi-wa-mate

# Start ulang dari awal
cd /path/to/railway-service
pm2 start index.js --name multi-wa-mate

# Save PM2 config
pm2 save
```

### 2. Cek Error Logs
```bash
# Lihat npm logs
cat /root/.npm/_logs/*-debug-0.log

# Lihat PM2 error logs
pm2 logs multi-wa-mate --err --lines 100
```

### 3. Cek Resource Usage
```bash
# Cek RAM
free -h

# Cek processes
top

# Jika RAM penuh, restart server
sudo reboot
```

## 📋 Checklist Sebelum Restart

- [ ] Pull latest code dari Git
- [ ] Install dependencies jika ada perubahan: `npm install`
- [ ] Cek environment variables: `cat .env`
- [ ] Stop service dengan clean: `pm2 stop`
- [ ] Tunggu beberapa detik
- [ ] Start ulang: `pm2 start`
- [ ] Verifikasi di logs: `pm2 logs`
- [ ] Test health check: `curl http://localhost:3000/health`

## 🔧 Troubleshooting Umum

### Error: "npm error signal SIGTERM"

**Penyebab:**
- Service restart terlalu cepat (process lama belum mati)
- Out of memory
- Syntax error di code
- Missing dependencies

**Solusi:**
```bash
# 1. Stop semua
pm2 stop all

# 2. Kill process nodejs yang masih jalan
pkill -9 node

# 3. Tunggu 5 detik
sleep 5

# 4. Start ulang
pm2 start multi-wa-mate

# 5. Cek logs
pm2 logs multi-wa-mate --lines 50
```

### Service Tidak Mau Start

```bash
# Cek syntax error
cd /path/to/railway-service
node index.js

# Jika ada error, fix dulu
# Setelah fix, restart:
pm2 restart multi-wa-mate
```

### Process Memory Leak

```bash
# Restart berkala (cron job)
# Edit crontab
crontab -e

# Tambahkan (restart setiap 6 jam)
0 */6 * * * pm2 restart multi-wa-mate
```

## 🎯 Best Practices

### 1. **Scheduled Restarts**
Restart service secara berkala untuk mencegah memory leak:
```bash
# Setiap 12 jam
0 */12 * * * pm2 restart multi-wa-mate
```

### 2. **Monitor Logs**
Setup log monitoring:
```bash
# Install PM2 monitoring (opsional)
pm2 install pm2-logrotate
```

### 3. **Auto Restart on Crash**
PM2 sudah auto-restart, tapi pastikan configured:
```bash
pm2 startup
pm2 save
```

### 4. **Multiple Servers**
Saat restart multi-server, restart satu per satu:
```bash
# Server 1
ssh vps1
pm2 stop multi-wa-mate
sleep 5
pm2 start multi-wa-mate

# Tunggu 1 menit, baru restart Server 2
ssh vps2
pm2 stop multi-wa-mate
sleep 5
pm2 start multi-wa-mate
```

## 📞 Help

Jika masih error setelah restart:
1. Cek logs: `pm2 logs multi-wa-mate --err`
2. Cek system resources: `free -h && top`
3. Test manual: `node index.js`
4. Check database connection
5. Verify environment variables

## 🔗 Related Files

- `railway-service/index.js` - Main service file
- `railway-service/.env` - Environment configuration
- `railway-service/package.json` - Dependencies
- `railway-service/MULTI_SERVER_LOAD_BALANCING.md` - Multi-server docs

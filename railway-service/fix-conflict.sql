-- ============================================
-- Script untuk Fix "Stream Errored (conflict)"
-- Jalankan di Supabase SQL Editor
-- ============================================

-- ⚠️ PENTING: Update sistem ke versi terbaru!
-- Conflict error sudah DIPERBAIKI dengan auto-assignment system
-- Restart SEMUA VPS server untuk apply perubahan:
--   pm2 restart all

-- ============================================
-- PENJELASAN MASALAH & SOLUSI
-- ============================================
-- 
-- MASALAH LAMA:
-- - Multiple server mencoba connect ke device yang sama
-- - Menyebabkan "Stream Errored (conflict)"
-- 
-- SOLUSI BARU (OTOMATIS):
-- ✅ Device auto-assign ke server berdasarkan load
-- ✅ Hanya assigned server yang boleh connect
-- ✅ Load balancing otomatis berdasarkan capacity
-- 
-- Lihat: railway-service/MULTI_SERVER_LOAD_BALANCING.md
--
-- ============================================

-- 1. CEK SEMUA DEVICE DAN STATUSNYA
-- ===================================
SELECT
    id,
    name,
    phone_number,
    status,
    connection_method,
    CASE
        WHEN auth_state IS NOT NULL THEN '✅ Has Session'
        ELSE '❌ No Session'
    END as session_status,
    created_at,
    updated_at
FROM devices
ORDER BY updated_at DESC;


-- 2. RESET DEVICE YANG BERMASALAH (conflict)
-- ===========================================
-- GANTI '<device_id>' dengan ID device yang error
-- Bisa lihat ID dari query #1 di atas

UPDATE devices
SET
    status = 'disconnected',
    auth_state = NULL,
    qr_code = NULL,
    pairing_code = NULL,
    updated_at = NOW()
WHERE id = '<device_id>';

-- Contoh untuk reset device dengan nama "X60 PRO":
-- UPDATE devices
-- SET status = 'disconnected', auth_state = NULL, qr_code = NULL, pairing_code = NULL, updated_at = NOW()
-- WHERE name = 'X60 PRO';


-- 3. RESET SEMUA DEVICE (Hati-hati! Semua akan disconnect)
-- =========================================================
-- Uncomment jika mau reset SEMUA device sekaligus

-- UPDATE devices
-- SET
--     status = 'disconnected',
--     auth_state = NULL,
--     qr_code = NULL,
--     pairing_code = NULL,
--     updated_at = NOW()
-- WHERE user_id = auth.uid();


-- 4. HAPUS DEVICE YANG TIDAK DIPAKAI
-- ===================================
-- DELETE FROM devices WHERE id = '<device_id>';


-- 5. CEK DEVICE SETELAH RESET
-- ============================
SELECT
    id,
    name,
    status,
    CASE
        WHEN auth_state IS NULL THEN '✅ Session Cleared'
        ELSE '⚠️ Still has session'
    END as session_check,
    updated_at
FROM devices
ORDER BY updated_at DESC;


-- 6. CEK CONVERSATIONS YANG MASIH AKTIF
-- ======================================
SELECT
    c.device_id,
    d.name as device_name,
    COUNT(*) as total_conversations,
    SUM(CASE WHEN c.unread_count > 0 THEN 1 ELSE 0 END) as unread_conversations
FROM whatsapp_conversations c
LEFT JOIN devices d ON d.id = c.device_id
GROUP BY c.device_id, d.name
ORDER BY total_conversations DESC;


-- 7. CLEANUP OLD BROADCASTS (Opsional)
-- =====================================
-- Hapus broadcast yang sudah completed > 30 hari

-- DELETE FROM broadcasts
-- WHERE status IN ('completed', 'cancelled')
-- AND created_at < NOW() - INTERVAL '30 days';


-- 8. CLEANUP OLD MESSAGES (Opsional)
-- ===================================
-- Hapus message history > 90 hari

-- DELETE FROM message_history
-- WHERE created_at < NOW() - INTERVAL '90 days';


-- ============================================
-- QUICK FIX UNTUK CONFLICT ERROR
-- ============================================

-- Jalankan query ini untuk reset device yang conflict:

/*

1. Lihat semua device:
   SELECT id, name, status FROM devices;

2. Copy ID device yang bermasalah

3. Update dengan ID tersebut:
   UPDATE devices
   SET status = 'disconnected', auth_state = NULL, qr_code = NULL, pairing_code = NULL
   WHERE id = 'PASTE_ID_DISINI';

4. Restart VPS service:
   pm2 restart multi-wa-mate

5. Scan QR lagi di aplikasi

6. Selesai! ✅

*/

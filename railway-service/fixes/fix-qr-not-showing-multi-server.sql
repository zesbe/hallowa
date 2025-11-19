-- ==================================================
-- FIX: QR Code Not Showing After Redis Migration
-- ==================================================
--
-- Root Cause: Multi-server load balancing causing devices
-- to be assigned to inactive servers, preventing QR generation
--
-- Solution: Reset assigned_server_id for devices in connecting
-- status to allow auto-assignment to active servers
-- ==================================================

-- Option 1: Reset ALL connecting devices (SAFE - Use this first)
UPDATE devices
SET
  assigned_server_id = NULL,
  updated_at = NOW()
WHERE
  status = 'connecting'
  AND assigned_server_id IS NOT NULL;

-- Option 2: Reset specific device (if you know the device ID)
-- UPDATE devices
-- SET
--   assigned_server_id = NULL,
--   updated_at = NOW()
-- WHERE
--   id = '338f1456-00b2-4d9f-8876-0464a63acd50';

-- Option 3: Reset devices assigned to inactive servers
-- First, identify inactive servers (no health ping in last 5 minutes)
-- UPDATE devices
-- SET
--   assigned_server_id = NULL,
--   updated_at = NOW()
-- WHERE
--   assigned_server_id IN (
--     SELECT id
--     FROM backend_servers
--     WHERE
--       is_healthy = false
--       OR last_health_ping < NOW() - INTERVAL '5 minutes'
--       OR is_active = false
--   )
--   AND status = 'connecting';

-- Verify the fix
SELECT
  id,
  device_name,
  status,
  assigned_server_id,
  updated_at
FROM devices
WHERE status = 'connecting'
ORDER BY updated_at DESC
LIMIT 10;

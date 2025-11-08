-- Migration: Clean dummy/test groups from contacts table
-- Created: 2025-01-07
-- Purpose: Remove all dummy groups that were created during testing
--          Only keep real WhatsApp groups from Baileys

-- Delete dummy groups with specific names
DELETE FROM contacts
WHERE is_group = true
  AND name IN ('Grup Keluarga', 'Tim Kerja', 'Komunitas');

-- Delete groups with UUID-like device IDs (dummy pattern)
-- Real WhatsApp group IDs should be phone numbers like: 628123456789-1234567890@g.us
DELETE FROM contacts
WHERE is_group = true
  AND phone_number LIKE '%ae415888-98bf-460e-8308-17ca0888cbd6%';

-- Delete any other groups with UUID patterns in phone_number
DELETE FROM contacts
WHERE is_group = true
  AND phone_number ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

-- Log the cleanup
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % dummy groups from contacts table', deleted_count;
END $$;

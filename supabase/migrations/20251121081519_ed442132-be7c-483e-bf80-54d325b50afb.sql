-- ========================================
-- DROP UNUSED TABLES - CLEANUP
-- Total savings: ~2.9 MB (21% of database)
-- ========================================

-- 1. Drop auto_replies (references sessions, not used)
DROP TABLE IF EXISTS public.auto_replies CASCADE;

-- 2. Drop messages (references sessions, not used) 
DROP TABLE IF EXISTS public.messages CASCADE;

-- 3. Drop sessions (not used, only referenced by unused tables)
DROP TABLE IF EXISTS public.sessions CASCADE;

-- 4. Drop users table (duplicate, not used - different from auth.users)
DROP TABLE IF EXISTS public.users CASCADE;

-- 5. Drop communication_logs (has 1 unused reference in code)
DROP TABLE IF EXISTS public.communication_logs CASCADE;

-- 6. Drop CRM leftover tables (failed deletion from previous migration)
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;

-- Note: All these tables are confirmed unused in the codebase
-- system_alerts is kept as it's actively used by admin dashboard
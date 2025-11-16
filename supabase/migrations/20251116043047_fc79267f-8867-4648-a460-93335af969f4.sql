-- Remove API key rotation function (not needed, manual management preferred)
DROP FUNCTION IF EXISTS rotate_server_api_key(uuid, text);

-- Keep encryption, audit logging, rate limiting, and IP whitelisting
-- These are the core security features against hackers
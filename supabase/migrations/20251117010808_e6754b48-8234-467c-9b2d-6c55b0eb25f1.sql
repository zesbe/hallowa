-- Security fix: Remove plaintext API key storage
-- The api_key column previously stored plaintext keys, which is a security risk.
-- Now we only store hashed keys (api_key_hash) and the prefix for display (api_key_prefix).

-- Make api_key column nullable and set default to NULL
ALTER TABLE api_keys 
  ALTER COLUMN api_key DROP NOT NULL,
  ALTER COLUMN api_key SET DEFAULT NULL;

-- Update existing rows to remove plaintext keys (set to NULL for security)
UPDATE api_keys 
SET api_key = NULL 
WHERE api_key IS NOT NULL AND api_key != '';

-- Make api_key_hash NOT NULL since it's now the primary security field
ALTER TABLE api_keys 
  ALTER COLUMN api_key_hash SET NOT NULL,
  ALTER COLUMN api_key_prefix SET NOT NULL;

-- Create index on api_key_hash for faster authentication lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(api_key_hash);

-- Add comment explaining the security model
COMMENT ON COLUMN api_keys.api_key IS 'DEPRECATED: Plaintext key storage. Use api_key_hash instead. Will be removed in future migration.';
COMMENT ON COLUMN api_keys.api_key_hash IS 'SHA-256 hash of the API key. Used for authentication.';
COMMENT ON COLUMN api_keys.api_key_prefix IS 'First 8 characters of the key for display purposes only.';
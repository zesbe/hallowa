-- ============================================
-- SECURITY ENHANCEMENT: Multi-Server Management
-- ============================================

-- 1. Create encryption functions (using pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    encrypt(
      data::bytea,
      key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data TEXT, key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN convert_from(
    decrypt(
      decode(encrypted_data, 'base64'),
      key::bytea,
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 2. Add IP whitelist and encryption tracking to backend_servers
ALTER TABLE public.backend_servers 
ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS api_key_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_key_last_rotated TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Create rate limiting table for admin operations
CREATE TABLE IF NOT EXISTS public.admin_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  operation_type TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(admin_id, operation_type, window_start)
);

-- RLS for admin_rate_limits
ALTER TABLE public.admin_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage rate limits"
ON public.admin_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Create function to check rate limit
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit(
  p_admin_id UUID,
  p_operation_type TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_request_count INTEGER;
BEGIN
  -- Calculate window start (round down to window_minutes)
  v_window_start := DATE_TRUNC('minute', NOW()) - 
    (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes || ' minutes')::INTERVAL;

  -- Get or create rate limit record
  INSERT INTO public.admin_rate_limits (
    admin_id,
    operation_type,
    window_start,
    request_count,
    last_request_at
  )
  VALUES (
    p_admin_id,
    p_operation_type,
    v_window_start,
    1,
    NOW()
  )
  ON CONFLICT (admin_id, operation_type, window_start)
  DO UPDATE SET
    request_count = admin_rate_limits.request_count + 1,
    last_request_at = NOW()
  RETURNING request_count INTO v_request_count;

  -- Check if limit exceeded
  IF v_request_count > p_max_requests THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 5. Create function to log server management operations
CREATE OR REPLACE FUNCTION public.log_server_management_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'server_created';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'server_updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'server_deleted';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  END IF;

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address
  )
  VALUES (
    auth.uid(),
    v_action,
    'backend_server',
    COALESCE(NEW.id, OLD.id),
    v_old_values,
    v_new_values,
    NULL -- IP will be captured by edge function if needed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Create trigger for audit logging on backend_servers
DROP TRIGGER IF EXISTS audit_server_management ON public.backend_servers;
CREATE TRIGGER audit_server_management
AFTER INSERT OR UPDATE OR DELETE ON public.backend_servers
FOR EACH ROW
EXECUTE FUNCTION public.log_server_management_audit();

-- 7. Create function to rotate API key
CREATE OR REPLACE FUNCTION public.rotate_server_api_key(
  p_server_id UUID,
  p_encryption_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_api_key TEXT;
  v_encrypted_key TEXT;
BEGIN
  -- Verify admin access
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Generate new API key (64 characters random)
  v_new_api_key := encode(gen_random_bytes(32), 'hex');

  -- Encrypt the new API key
  v_encrypted_key := encrypt_sensitive_data(v_new_api_key, p_encryption_key);

  -- Update server with new encrypted key
  UPDATE public.backend_servers
  SET 
    api_key = v_encrypted_key,
    api_key_encrypted = true,
    api_key_last_rotated = NOW(),
    updated_at = NOW()
  WHERE id = p_server_id;

  -- Log the rotation
  INSERT INTO public.audit_logs (
    admin_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  VALUES (
    auth.uid(),
    'api_key_rotated',
    'backend_server',
    p_server_id,
    jsonb_build_object('rotated_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'api_key', v_new_api_key,
    'message', 'API key rotated successfully'
  );
END;
$$;

-- 8. Create cleanup function for old rate limits
CREATE OR REPLACE FUNCTION public.cleanup_old_admin_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.admin_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 9. Add comments
COMMENT ON FUNCTION public.encrypt_sensitive_data IS 'Encrypts sensitive data using AES encryption';
COMMENT ON FUNCTION public.decrypt_sensitive_data IS 'Decrypts sensitive data encrypted with AES';
COMMENT ON FUNCTION public.check_admin_rate_limit IS 'Checks if admin has exceeded rate limit for specific operation';
COMMENT ON FUNCTION public.rotate_server_api_key IS 'Rotates server API key with encryption';
COMMENT ON TABLE public.admin_rate_limits IS 'Rate limiting for admin operations to prevent abuse';
COMMENT ON COLUMN public.backend_servers.allowed_ips IS 'IP whitelist for server access (NULL = allow all)';
COMMENT ON COLUMN public.backend_servers.api_key_encrypted IS 'Flag indicating if API key is encrypted';
COMMENT ON COLUMN public.backend_servers.api_key_last_rotated IS 'Last time API key was rotated';
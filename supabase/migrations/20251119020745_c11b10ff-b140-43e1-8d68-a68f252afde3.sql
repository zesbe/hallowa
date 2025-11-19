-- Fix audit trigger to handle service role operations (when auth.uid() is NULL)
-- This prevents errors when automated health checks update backend_servers

DROP TRIGGER IF EXISTS log_server_management_audit_trigger ON public.backend_servers;

-- Recreate the trigger function to skip audit logging for service role operations
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
  v_admin_id UUID;
BEGIN
  -- Get the current user ID (might be NULL for service role operations)
  v_admin_id := auth.uid();
  
  -- Skip audit logging if no authenticated user (automated system operations)
  -- This includes health checks and other automated processes using service role
  IF v_admin_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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

  -- Log to audit_logs (only for authenticated admin operations)
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
    v_admin_id, -- Now guaranteed to be NOT NULL
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

-- Recreate the trigger
CREATE TRIGGER log_server_management_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.backend_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_server_management_audit();

-- Add comment explaining the behavior
COMMENT ON FUNCTION public.log_server_management_audit() IS 
'Audit trigger for backend_servers table. Skips logging for service role operations (health checks, automated tasks) and only logs admin-initiated changes.';
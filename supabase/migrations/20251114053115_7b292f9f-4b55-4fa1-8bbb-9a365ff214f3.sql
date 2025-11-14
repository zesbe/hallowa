-- ============================================
-- SECURITY FIX: Add Auth Audit Logging
-- ============================================

-- Create auth_audit_logs table untuk track semua login attempts
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout', 'signup_success', 'signup_failed', 'password_reset_requested', 'password_reset_completed')),
  login_method TEXT CHECK (login_method IN ('user_page', 'admin_page', 'api')),
  ip_address TEXT,
  user_agent TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_auth_audit_logs_user_id ON public.auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_email ON public.auth_audit_logs(email);
CREATE INDEX idx_auth_audit_logs_event_type ON public.auth_audit_logs(event_type);
CREATE INDEX idx_auth_audit_logs_created_at ON public.auth_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all auth logs
CREATE POLICY "Admins can view all auth audit logs"
  ON public.auth_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Service can insert auth logs
CREATE POLICY "Service can insert auth audit logs"
  ON public.auth_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own auth logs
CREATE POLICY "Users can view own auth audit logs"
  ON public.auth_audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- SECURITY FIX: Rate Limiting Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or email
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_locked BOOLEAN DEFAULT false,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk performa
CREATE UNIQUE INDEX idx_login_rate_limits_identifier ON public.login_rate_limits(identifier);
CREATE INDEX idx_login_rate_limits_locked_until ON public.login_rate_limits(locked_until);

-- Enable RLS (hanya service yang bisa akses)
ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage rate limits"
  ON public.login_rate_limits
  FOR ALL
  WITH CHECK (true);

-- Function untuk cleanup old rate limit records (auto cleanup setelah 24 jam)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.login_rate_limits
  WHERE last_attempt_at < NOW() - INTERVAL '24 hours'
    AND is_locked = false;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================
-- SECURITY FIX: Fix Database Functions
-- Add SET search_path to all functions
-- ============================================

-- Fix 1: update_device_health_timestamp
CREATE OR REPLACE FUNCTION public.update_device_health_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix 2: log_device_connection_event
CREATE OR REPLACE FUNCTION public.log_device_connection_event(
  p_device_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL::text,
  p_error_code text DEFAULT NULL::text,
  p_error_message text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_log_id UUID;
  v_connection_duration INTEGER;
BEGIN
  -- Calculate connection duration if disconnecting
  IF p_event_type IN ('disconnected', 'error', 'logout') THEN
    SELECT EXTRACT(EPOCH FROM (NOW() - last_connected_at))::INTEGER
    INTO v_connection_duration
    FROM devices
    WHERE id = p_device_id
      AND status = 'connected'
      AND last_connected_at IS NOT NULL;
  END IF;

  -- Insert log
  INSERT INTO device_connection_logs (
    device_id,
    user_id,
    event_type,
    details,
    ip_address,
    error_code,
    error_message,
    connection_duration_seconds
  )
  VALUES (
    p_device_id,
    p_user_id,
    p_event_type,
    p_details,
    p_ip_address,
    p_error_code,
    p_error_message,
    v_connection_duration
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- Fix 3: update_device_health
CREATE OR REPLACE FUNCTION public.update_device_health(
  p_device_id uuid,
  p_user_id uuid,
  p_messages_sent integer DEFAULT 0,
  p_messages_failed integer DEFAULT 0,
  p_error_occurred boolean DEFAULT false,
  p_error_message text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_health_status TEXT;
  v_error_rate DECIMAL(5,2);
  v_total_messages INTEGER;
BEGIN
  -- Insert or update today's health metrics
  INSERT INTO device_health_metrics (
    device_id,
    user_id,
    messages_sent_today,
    messages_failed_today,
    date
  )
  VALUES (
    p_device_id,
    p_user_id,
    p_messages_sent,
    p_messages_failed,
    CURRENT_DATE
  )
  ON CONFLICT (device_id, date)
  DO UPDATE SET
    messages_sent_today = device_health_metrics.messages_sent_today + EXCLUDED.messages_sent_today,
    messages_failed_today = device_health_metrics.messages_failed_today + EXCLUDED.messages_failed_today,
    error_count_today = CASE
      WHEN p_error_occurred THEN device_health_metrics.error_count_today + 1
      ELSE device_health_metrics.error_count_today
    END,
    last_error_at = CASE
      WHEN p_error_occurred THEN NOW()
      ELSE device_health_metrics.last_error_at
    END,
    last_error_message = CASE
      WHEN p_error_occurred THEN p_error_message
      ELSE device_health_metrics.last_error_message
    END,
    last_heartbeat = NOW(),
    updated_at = NOW();

  -- Calculate error rate and health status
  SELECT
    messages_sent_today + messages_failed_today,
    CASE
      WHEN (messages_sent_today + messages_failed_today) > 0
      THEN (messages_failed_today::DECIMAL / (messages_sent_today + messages_failed_today)) * 100
      ELSE 0
    END
  INTO v_total_messages, v_error_rate
  FROM device_health_metrics
  WHERE device_id = p_device_id AND date = CURRENT_DATE;

  -- Determine health status
  v_health_status := CASE
    WHEN v_error_rate > 20 THEN 'critical'
    WHEN v_error_rate > 10 THEN 'warning'
    ELSE 'healthy'
  END;

  -- Update health status and error rate
  UPDATE device_health_metrics
  SET
    error_rate_percent = v_error_rate,
    health_status = v_health_status
  WHERE device_id = p_device_id AND date = CURRENT_DATE;
END;
$function$;

-- Fix 4: calculate_device_uptime
CREATE OR REPLACE FUNCTION public.calculate_device_uptime(p_device_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uptime_minutes INTEGER;
BEGIN
  SELECT EXTRACT(EPOCH FROM (NOW() - last_connected_at))::INTEGER / 60
  INTO v_uptime_minutes
  FROM devices
  WHERE id = p_device_id
    AND status = 'connected'
    AND last_connected_at IS NOT NULL;

  RETURN COALESCE(v_uptime_minutes, 0);
END;
$function$;

-- Fix 5: get_device_health_summary
CREATE OR REPLACE FUNCTION public.get_device_health_summary(p_device_id uuid)
RETURNS TABLE(
  health_status text,
  uptime_minutes integer,
  messages_sent_today integer,
  error_rate_percent numeric,
  last_error_message text,
  reconnect_count_today integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    dhm.health_status,
    calculate_device_uptime(p_device_id) as uptime_minutes,
    dhm.messages_sent_today,
    dhm.error_rate_percent,
    dhm.last_error_message,
    dhm.reconnect_count_today
  FROM device_health_metrics dhm
  WHERE dhm.device_id = p_device_id
    AND dhm.date = CURRENT_DATE
  LIMIT 1;
END;
$function$;

-- Fix 6: cleanup_old_device_logs
CREATE OR REPLACE FUNCTION public.cleanup_old_device_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM device_connection_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$function$;

-- Fix 7: cleanup_old_health_metrics
CREATE OR REPLACE FUNCTION public.cleanup_old_health_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM device_health_metrics
  WHERE date < CURRENT_DATE - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$function$;

-- Fix 8: generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_year VARCHAR(4);
  v_month VARCHAR(2);
  v_sequence INTEGER;
  v_invoice_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');

  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 12) AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || v_year || v_month || '%';

  -- Format: INV-YYYYMM-XXXX (e.g., INV-202501-0001)
  v_invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_invoice_number;
END;
$function$;

-- Fix 9: auto_generate_invoice_number
CREATE OR REPLACE FUNCTION public.auto_generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix 10: increment_product_downloads
CREATE OR REPLACE FUNCTION public.increment_product_downloads(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE marketplace_products
  SET downloads = downloads + 1
  WHERE id = p_product_id;
END;
$function$;

-- Fix 11: calculate_next_send_time_v2
CREATE OR REPLACE FUNCTION public.calculate_next_send_time_v2(
  p_frequency character varying,
  p_schedule_time time without time zone,
  p_selected_days integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
  p_timezone character varying DEFAULT 'Asia/Jakarta'::character varying,
  p_last_sent_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW() AT TIME ZONE p_timezone;
  v_today_scheduled TIMESTAMP WITH TIME ZONE;
  v_next_send TIMESTAMP WITH TIME ZONE;
  v_day_of_week INTEGER;
  v_days_to_add INTEGER;
BEGIN
  -- Combine today's date with schedule time in user's timezone
  v_today_scheduled := (DATE_TRUNC('day', v_now) + p_schedule_time) AT TIME ZONE p_timezone;

  -- Get day of week (0 = Sunday, 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM v_now)::INTEGER;

  -- Handle weekly frequency with selected days
  IF p_frequency = 'weekly' THEN
    -- Find next valid day
    v_days_to_add := 0;
    FOR i IN 0..6 LOOP
      v_days_to_add := (v_day_of_week + i) % 7;
      IF v_days_to_add = ANY(p_selected_days) THEN
        IF i = 0 AND v_today_scheduled > v_now THEN
          -- Today is valid and time hasn't passed
          v_next_send := v_today_scheduled;
          EXIT;
        ELSIF i > 0 THEN
          -- Future day is valid
          v_next_send := v_today_scheduled + (i || ' days')::INTERVAL;
          EXIT;
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- Daily or monthly
    IF p_last_sent_at IS NOT NULL AND DATE(p_last_sent_at AT TIME ZONE p_timezone) = DATE(v_now) THEN
      -- Already sent today
      CASE p_frequency
        WHEN 'daily' THEN
          v_next_send := v_today_scheduled + INTERVAL '1 day';
        WHEN 'monthly' THEN
          v_next_send := v_today_scheduled + INTERVAL '1 month';
      END CASE;
    ELSIF v_today_scheduled > v_now THEN
      -- Today's time not reached
      v_next_send := v_today_scheduled;
    ELSE
      -- Today's time passed
      CASE p_frequency
        WHEN 'daily' THEN
          v_next_send := v_today_scheduled + INTERVAL '1 day';
        WHEN 'monthly' THEN
          v_next_send := v_today_scheduled + INTERVAL '1 month';
      END CASE;
    END IF;
  END IF;

  RETURN v_next_send;
END;
$function$;

-- Fix 12: auto_calculate_next_send_v2
CREATE OR REPLACE FUNCTION public.auto_calculate_next_send_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.next_send_at := calculate_next_send_time_v2(
    NEW.frequency,
    NEW.schedule_time,
    COALESCE(NEW.selected_days, ARRAY[0,1,2,3,4,5,6]),
    COALESCE(NEW.timezone, 'Asia/Jakarta'),
    NEW.last_sent_at
  );
  RETURN NEW;
END;
$function$;

-- Fix 13: update_conversation_last_message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE whatsapp_conversations
  SET
    last_message_id = NEW.id,
    last_message_preview = CASE
      WHEN NEW.message_type = 'text' THEN LEFT(NEW.message_content, 100)
      WHEN NEW.message_type = 'image' THEN '📷 Image'
      WHEN NEW.message_type = 'video' THEN '🎥 Video'
      WHEN NEW.message_type = 'audio' THEN '🎵 Audio'
      WHEN NEW.message_type = 'document' THEN '📄 Document'
      ELSE '💬 Message'
    END,
    last_message_time = NEW.timestamp,
    unread_count = CASE
      WHEN NEW.from_me THEN 0
      ELSE unread_count + 1
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;

-- Fix 14: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

COMMENT ON TABLE public.auth_audit_logs IS 'Track semua authentication attempts untuk security monitoring';
COMMENT ON TABLE public.login_rate_limits IS 'Rate limiting untuk prevent brute force attacks';
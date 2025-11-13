-- ============================================
-- DEVICE SECURITY ENHANCEMENTS & MONITORING
-- ============================================
-- Created: 2025-11-13
-- Purpose: Add connection logging, health monitoring, and security features
-- ============================================

-- ============================================
-- 1. DEVICE CONNECTION LOGS TABLE
-- ============================================
-- Track all device connection events for security audit and troubleshooting

CREATE TABLE IF NOT EXISTS device_connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'connected',
    'disconnected',
    'error',
    'qr_generated',
    'pairing_code_generated',
    'session_cleared',
    'logout',
    'reconnect_attempt',
    'connection_timeout'
  )),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Event details
  details JSONB DEFAULT '{}',

  -- Security tracking
  ip_address TEXT,
  user_agent TEXT,

  -- Performance metrics
  connection_duration_seconds INTEGER, -- How long was connected before disconnect

  -- Error information
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_device_logs_device_timestamp ON device_connection_logs(device_id, timestamp DESC);
CREATE INDEX idx_device_logs_user ON device_connection_logs(user_id, timestamp DESC);
CREATE INDEX idx_device_logs_event_type ON device_connection_logs(event_type, timestamp DESC);
CREATE INDEX idx_device_logs_timestamp ON device_connection_logs(timestamp DESC);

-- ============================================
-- 2. DEVICE HEALTH METRICS TABLE
-- ============================================
-- Store device health and performance metrics

CREATE TABLE IF NOT EXISTS device_health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Uptime & availability
  uptime_minutes INTEGER DEFAULT 0,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),

  -- Message metrics (daily)
  messages_sent_today INTEGER DEFAULT 0,
  messages_failed_today INTEGER DEFAULT 0,
  messages_delivered_today INTEGER DEFAULT 0,

  -- Error tracking
  error_count_today INTEGER DEFAULT 0,
  error_rate_percent DECIMAL(5,2) DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,

  -- Performance
  average_response_time_ms INTEGER DEFAULT 0,
  reconnect_count_today INTEGER DEFAULT 0,

  -- Health status
  health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'critical', 'offline')),
  health_issues JSONB DEFAULT '[]',

  -- Timestamps
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one health record per device per day
  UNIQUE(device_id, date)
);

-- Indexes
CREATE INDEX idx_device_health_device_date ON device_health_metrics(device_id, date DESC);
CREATE INDEX idx_device_health_status ON device_health_metrics(health_status, date DESC);
CREATE INDEX idx_device_health_user ON device_health_metrics(user_id, date DESC);

-- ============================================
-- 3. DEVICE RECONNECT SETTINGS TABLE
-- ============================================
-- Auto-reconnect configuration per device

CREATE TABLE IF NOT EXISTS device_reconnect_settings (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Auto-reconnect settings
  enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 5 CHECK (max_retries >= 0 AND max_retries <= 20),
  retry_interval_seconds INTEGER DEFAULT 30 CHECK (retry_interval_seconds >= 10),
  exponential_backoff BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,

  -- Current state
  current_retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reconnect_settings_user ON device_reconnect_settings(user_id);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE device_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_reconnect_settings ENABLE ROW LEVEL SECURITY;

-- Connection Logs Policies
CREATE POLICY "Users can view own device logs"
  ON device_connection_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert device logs"
  ON device_connection_logs
  FOR INSERT
  WITH CHECK (true); -- Service role only

CREATE POLICY "Users can delete old logs"
  ON device_connection_logs
  FOR DELETE
  USING (auth.uid() = user_id AND timestamp < NOW() - INTERVAL '90 days');

-- Health Metrics Policies
CREATE POLICY "Users can view own device health"
  ON device_health_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage device health"
  ON device_health_metrics
  FOR ALL
  USING (true); -- Service role only

-- Reconnect Settings Policies
CREATE POLICY "Users can view own reconnect settings"
  ON device_reconnect_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own reconnect settings"
  ON device_reconnect_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reconnect settings"
  ON device_reconnect_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reconnect settings"
  ON device_reconnect_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function: Log device connection event
CREATE OR REPLACE FUNCTION log_device_connection_event(
  p_device_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_details JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function: Update device health metrics
CREATE OR REPLACE FUNCTION update_device_health(
  p_device_id UUID,
  p_user_id UUID,
  p_messages_sent INTEGER DEFAULT 0,
  p_messages_failed INTEGER DEFAULT 0,
  p_error_occurred BOOLEAN DEFAULT false,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function: Calculate device uptime
CREATE OR REPLACE FUNCTION calculate_device_uptime(p_device_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function: Get device health summary
CREATE OR REPLACE FUNCTION get_device_health_summary(p_device_id UUID)
RETURNS TABLE (
  health_status TEXT,
  uptime_minutes INTEGER,
  messages_sent_today INTEGER,
  error_rate_percent DECIMAL,
  last_error_message TEXT,
  reconnect_count_today INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function: Clean old connection logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_device_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM device_connection_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- Function: Clean old health metrics (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM device_health_metrics
  WHERE date < CURRENT_DATE - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Trigger: Auto-update updated_at on device_health_metrics
CREATE OR REPLACE FUNCTION update_device_health_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_device_health_timestamp
  BEFORE UPDATE ON device_health_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_device_health_timestamp();

-- Trigger: Auto-update updated_at on device_reconnect_settings
CREATE TRIGGER trigger_update_reconnect_settings_timestamp
  BEFORE UPDATE ON device_reconnect_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_device_health_timestamp();

-- ============================================
-- 7. SCHEDULED CLEANUP (Requires pg_cron extension)
-- ============================================

-- Note: Run these manually if pg_cron is not available
-- SELECT cleanup_old_device_logs();
-- SELECT cleanup_old_health_metrics();

-- If pg_cron is available, uncomment:
-- SELECT cron.schedule('cleanup-device-logs', '0 2 * * *', 'SELECT cleanup_old_device_logs()');
-- SELECT cron.schedule('cleanup-health-metrics', '0 2 * * *', 'SELECT cleanup_old_health_metrics()');

-- ============================================
-- 8. INITIAL DATA MIGRATION
-- ============================================

-- Create default reconnect settings for existing devices
INSERT INTO device_reconnect_settings (device_id, user_id)
SELECT id, user_id
FROM devices
WHERE id NOT IN (SELECT device_id FROM device_reconnect_settings);

-- Create health metrics for existing connected devices
INSERT INTO device_health_metrics (device_id, user_id, date)
SELECT id, user_id, CURRENT_DATE
FROM devices
WHERE id NOT IN (
  SELECT device_id
  FROM device_health_metrics
  WHERE date = CURRENT_DATE
);

-- ============================================
-- 9. GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION log_device_connection_event TO service_role;
GRANT EXECUTE ON FUNCTION update_device_health TO service_role;
GRANT EXECUTE ON FUNCTION calculate_device_uptime TO authenticated;
GRANT EXECUTE ON FUNCTION get_device_health_summary TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_device_logs TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_health_metrics TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables created
SELECT
  'device_connection_logs' as table_name,
  COUNT(*) as row_count
FROM device_connection_logs
UNION ALL
SELECT
  'device_health_metrics',
  COUNT(*)
FROM device_health_metrics
UNION ALL
SELECT
  'device_reconnect_settings',
  COUNT(*)
FROM device_reconnect_settings;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Device security enhancements migration completed successfully!';
  RAISE NOTICE '📊 Tables created: device_connection_logs, device_health_metrics, device_reconnect_settings';
  RAISE NOTICE '🔒 RLS policies applied';
  RAISE NOTICE '⚡ Helper functions created';
  RAISE NOTICE '🧹 Cleanup functions scheduled';
END $$;

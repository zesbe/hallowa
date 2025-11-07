-- Create auto_post_schedules table
CREATE TABLE IF NOT EXISTS auto_post_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  target_groups TEXT[] NOT NULL DEFAULT '{}',
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  schedule_time TIME NOT NULL,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create auto_post_logs table for tracking sent messages
CREATE TABLE IF NOT EXISTS auto_post_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES auto_post_schedules(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_name VARCHAR(255),
  message_sent TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for auto_post_schedules
ALTER TABLE auto_post_schedules ENABLE ROW LEVEL SECURITY;

-- Users can only see their own schedules
CREATE POLICY "Users can view own schedules"
  ON auto_post_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create schedules
CREATE POLICY "Users can create schedules"
  ON auto_post_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own schedules
CREATE POLICY "Users can update own schedules"
  ON auto_post_schedules
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own schedules
CREATE POLICY "Users can delete own schedules"
  ON auto_post_schedules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add RLS policies for auto_post_logs
ALTER TABLE auto_post_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their schedules
CREATE POLICY "Users can view own logs"
  ON auto_post_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auto_post_schedules
      WHERE auto_post_schedules.id = auto_post_logs.schedule_id
      AND auto_post_schedules.user_id = auth.uid()
    )
  );

-- Service role can insert logs
CREATE POLICY "Service can insert logs"
  ON auto_post_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_auto_post_schedules_user_id ON auto_post_schedules(user_id);
CREATE INDEX idx_auto_post_schedules_device_id ON auto_post_schedules(device_id);
CREATE INDEX idx_auto_post_schedules_active ON auto_post_schedules(is_active, next_send_at);
CREATE INDEX idx_auto_post_logs_schedule_id ON auto_post_logs(schedule_id);
CREATE INDEX idx_auto_post_logs_sent_at ON auto_post_logs(sent_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_auto_post_schedules_updated_at
  BEFORE UPDATE ON auto_post_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next send time
CREATE OR REPLACE FUNCTION calculate_next_send_time(
  p_frequency VARCHAR,
  p_schedule_time TIME,
  p_last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_today_scheduled TIMESTAMP WITH TIME ZONE;
  v_next_send TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Combine today's date with schedule time
  v_today_scheduled := DATE_TRUNC('day', v_now) + p_schedule_time;

  -- If already sent today or time passed, calculate next send
  IF p_last_sent_at IS NOT NULL AND DATE(p_last_sent_at) = DATE(v_now) THEN
    -- Already sent today, calculate next
    CASE p_frequency
      WHEN 'daily' THEN
        v_next_send := v_today_scheduled + INTERVAL '1 day';
      WHEN 'weekly' THEN
        v_next_send := v_today_scheduled + INTERVAL '7 days';
      WHEN 'monthly' THEN
        v_next_send := v_today_scheduled + INTERVAL '1 month';
    END CASE;
  ELSIF v_today_scheduled > v_now THEN
    -- Today's schedule time not reached yet
    v_next_send := v_today_scheduled;
  ELSE
    -- Today's time passed, calculate next occurrence
    CASE p_frequency
      WHEN 'daily' THEN
        v_next_send := v_today_scheduled + INTERVAL '1 day';
      WHEN 'weekly' THEN
        v_next_send := v_today_scheduled + INTERVAL '7 days';
      WHEN 'monthly' THEN
        v_next_send := v_today_scheduled + INTERVAL '1 month';
    END CASE;
  END IF;

  RETURN v_next_send;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate next_send_at
CREATE OR REPLACE FUNCTION auto_calculate_next_send()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_send_at := calculate_next_send_time(
    NEW.frequency,
    NEW.schedule_time,
    NEW.last_sent_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_next_send
  BEFORE INSERT OR UPDATE OF frequency, schedule_time, last_sent_at ON auto_post_schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_next_send();

-- Add comments
COMMENT ON TABLE auto_post_schedules IS 'Store auto-post schedules for groups';
COMMENT ON TABLE auto_post_logs IS 'Track auto-post message delivery logs';
COMMENT ON FUNCTION calculate_next_send_time IS 'Calculate next scheduled send time based on frequency';

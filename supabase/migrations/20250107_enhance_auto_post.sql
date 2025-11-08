-- Migration: Enhance auto_post_schedules with timezone, day selection, and advanced features
-- Created: 2025-01-07
-- Purpose: Add timezone support, weekly day selection, random delay, and other improvements

-- Add new columns to auto_post_schedules
ALTER TABLE auto_post_schedules
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Jakarta',
  ADD COLUMN IF NOT EXISTS selected_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday, 6=Saturday
  ADD COLUMN IF NOT EXISTS random_delay BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 5 CHECK (delay_minutes >= 0 AND delay_minutes <= 60),
  ADD COLUMN IF NOT EXISTS send_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_post_schedules_timezone ON auto_post_schedules(timezone);
CREATE INDEX IF NOT EXISTS idx_auto_post_schedules_next_send ON auto_post_schedules(next_send_at) WHERE is_active = true;

-- Update the calculate_next_send_time function to support selected_days and timezone
CREATE OR REPLACE FUNCTION calculate_next_send_time_v2(
  p_frequency VARCHAR,
  p_schedule_time TIME,
  p_selected_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
  p_timezone VARCHAR DEFAULT 'Asia/Jakarta',
  p_last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
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
$$ LANGUAGE plpgsql;

-- Update trigger to use new function
CREATE OR REPLACE FUNCTION auto_calculate_next_send_v2()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Replace trigger
DROP TRIGGER IF EXISTS trigger_calculate_next_send ON auto_post_schedules;
CREATE TRIGGER trigger_calculate_next_send_v2
  BEFORE INSERT OR UPDATE OF frequency, schedule_time, last_sent_at, selected_days, timezone ON auto_post_schedules
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_next_send_v2();

-- Add comments
COMMENT ON COLUMN auto_post_schedules.timezone IS 'Timezone for scheduling (e.g., Asia/Jakarta, Asia/Singapore)';
COMMENT ON COLUMN auto_post_schedules.selected_days IS 'Array of days (0=Sunday, 6=Saturday) for weekly schedules';
COMMENT ON COLUMN auto_post_schedules.random_delay IS 'Randomize send time within delay_minutes';
COMMENT ON COLUMN auto_post_schedules.delay_minutes IS 'Minutes to randomize (0-60)';
COMMENT ON COLUMN auto_post_schedules.send_count IS 'Total messages sent by this schedule';
COMMENT ON COLUMN auto_post_schedules.failed_count IS 'Total failed messages';

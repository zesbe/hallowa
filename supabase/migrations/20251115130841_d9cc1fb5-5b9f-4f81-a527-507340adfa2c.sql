-- ✅ SECURITY: Enhanced device cleanup and auto-detection

-- Function to auto-detect and cleanup stuck devices
CREATE OR REPLACE FUNCTION public.auto_cleanup_stuck_devices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cleanup_count INTEGER := 0;
  v_device RECORD;
BEGIN
  -- Find devices stuck in "reconnecting" for more than 5 minutes
  FOR v_device IN
    SELECT id, user_id, device_name
    FROM devices
    WHERE status IN ('reconnecting', 'connecting')
      AND updated_at < NOW() - INTERVAL '5 minutes'
  LOOP
    -- Set status to disconnected
    UPDATE devices
    SET 
      status = 'disconnected',
      session_data = NULL,
      qr_code = NULL,
      pairing_code = NULL,
      updated_at = NOW()
    WHERE id = v_device.id;

    -- Log the cleanup event
    INSERT INTO device_connection_logs (
      device_id,
      user_id,
      event_type,
      details,
      error_message
    ) VALUES (
      v_device.id,
      v_device.user_id,
      'auto_cleanup',
      jsonb_build_object(
        'reason', 'stuck_in_connecting_state',
        'device_name', v_device.device_name,
        'cleanup_time', NOW()
      ),
      'Device was stuck in connecting/reconnecting state for more than 5 minutes'
    );

    v_cleanup_count := v_cleanup_count + 1;
  END LOOP;

  RETURN v_cleanup_count;
END;
$$;

-- Function to comprehensively delete device and all related data
CREATE OR REPLACE FUNCTION public.delete_device_completely(p_device_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_device_name TEXT;
  v_result JSONB;
BEGIN
  -- Get device info and verify ownership
  SELECT user_id, device_name INTO v_user_id, v_device_name
  FROM devices
  WHERE id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Device not found'
    );
  END IF;

  -- Verify current user owns this device
  IF v_user_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Delete related data in order (respecting foreign keys)
  
  -- 1. Delete chatbot rules
  DELETE FROM chatbot_rules
  WHERE device_id = p_device_id;

  -- 2. Delete message queue
  DELETE FROM message_queue
  WHERE device_id = p_device_id;

  -- 3. Delete message history
  DELETE FROM message_history
  WHERE device_id = p_device_id;

  -- 4. Delete broadcasts
  DELETE FROM broadcasts
  WHERE device_id = p_device_id;

  -- 5. Delete auto post schedules
  DELETE FROM auto_post_schedules
  WHERE device_id = p_device_id;

  -- 6. Delete reminder configs
  DELETE FROM reminder_configs
  WHERE device_id = p_device_id;

  -- 7. Delete webhooks
  DELETE FROM webhooks
  WHERE device_id = p_device_id;

  -- 8. Unlink contacts (don't delete, just remove device_id)
  UPDATE contacts
  SET device_id = NULL, updated_at = NOW()
  WHERE device_id = p_device_id;

  -- 9. Delete WhatsApp conversations
  DELETE FROM whatsapp_conversations
  WHERE device_id = p_device_id;

  -- 10. Delete WhatsApp messages
  DELETE FROM whatsapp_messages
  WHERE device_id = p_device_id;

  -- 11. Delete device connection logs (keep last 10 for audit)
  DELETE FROM device_connection_logs
  WHERE device_id = p_device_id
    AND id NOT IN (
      SELECT id FROM device_connection_logs
      WHERE device_id = p_device_id
      ORDER BY timestamp DESC
      LIMIT 10
    );

  -- 12. Delete device health metrics (keep last 7 days for audit)
  DELETE FROM device_health_metrics
  WHERE device_id = p_device_id
    AND date < CURRENT_DATE - INTERVAL '7 days';

  -- 13. Delete device reconnect settings
  DELETE FROM device_reconnect_settings
  WHERE device_id = p_device_id;

  -- 14. Finally, delete the device itself
  DELETE FROM devices
  WHERE id = p_device_id;

  -- Log the complete deletion
  INSERT INTO device_connection_logs (
    device_id,
    user_id,
    event_type,
    details
  ) VALUES (
    p_device_id,
    v_user_id,
    'device_deleted',
    jsonb_build_object(
      'device_name', v_device_name,
      'deleted_at', NOW(),
      'deleted_by', v_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'device_id', p_device_id,
    'device_name', v_device_name,
    'message', 'Device and all related data deleted successfully'
  );
END;
$$;

-- Trigger to auto-cleanup devices periodically
-- This will be called by edge function or cron job

COMMENT ON FUNCTION public.auto_cleanup_stuck_devices() IS 
'Automatically detects and cleans up devices stuck in connecting/reconnecting state for more than 5 minutes';

COMMENT ON FUNCTION public.delete_device_completely(UUID) IS 
'Comprehensively deletes a device and all its related data (broadcasts, messages, logs, etc.) with proper authorization check';
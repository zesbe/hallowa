-- Create message_queue table for queuing messages to be sent via Railway service
CREATE TABLE IF NOT EXISTS message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  to_phone VARCHAR(50) NOT NULL,
  message TEXT,
  media_url TEXT,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Users can insert own messages"
  ON message_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own queued messages
CREATE POLICY "Users can view own messages"
  ON message_queue
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = message_queue.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service can manage all messages"
  ON message_queue
  FOR ALL
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_message_queue_device_id ON message_queue(device_id);
CREATE INDEX idx_message_queue_status ON message_queue(status);
CREATE INDEX idx_message_queue_scheduled_at ON message_queue(scheduled_at);
CREATE INDEX idx_message_queue_user_id ON message_queue(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_message_queue_updated_at
  BEFORE UPDATE ON message_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE message_queue IS 'Queue for messages to be sent via Railway service';
COMMENT ON COLUMN message_queue.retry_count IS 'Number of times this message has been retried after failure';

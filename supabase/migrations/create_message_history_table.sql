-- Create message_history table for tracking all sent messages
CREATE TABLE IF NOT EXISTS message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio')),
  message_content TEXT,
  media_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  error_message TEXT,
  campaign_name VARCHAR(255), -- For broadcast/scheduled messages
  is_group BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for message_history
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own message history
CREATE POLICY "Users can view own message history"
  ON message_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert message history
CREATE POLICY "Service can insert message history"
  ON message_history
  FOR INSERT
  WITH CHECK (true);

-- Users can delete their own message history
CREATE POLICY "Users can delete own message history"
  ON message_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_message_history_user_id ON message_history(user_id);
CREATE INDEX idx_message_history_device_id ON message_history(device_id);
CREATE INDEX idx_message_history_sent_at ON message_history(sent_at DESC);
CREATE INDEX idx_message_history_status ON message_history(status);
CREATE INDEX idx_message_history_recipient ON message_history(recipient_phone);
CREATE INDEX idx_message_history_campaign ON message_history(campaign_name);

-- Add comments
COMMENT ON TABLE message_history IS 'Track all sent WhatsApp messages for history and analytics';
COMMENT ON COLUMN message_history.campaign_name IS 'Name of broadcast or scheduled campaign if applicable';

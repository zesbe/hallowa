-- Create reminder configurations table
CREATE TABLE IF NOT EXISTS public.reminder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  reminder_type VARCHAR(50) NOT NULL, -- 'subscription_renewal', 'payment_due', 'custom'
  
  -- Trigger conditions
  trigger_days_before INTEGER[], -- [7, 3, 1] days before event
  target_segment VARCHAR(100), -- 'all', 'expiring_soon', 'expired', 'custom'
  
  -- Message content
  message_template TEXT NOT NULL,
  message_variables JSONB DEFAULT '[]'::jsonb,
  
  -- Scheduling
  is_active BOOLEAN DEFAULT true,
  send_time TIME DEFAULT '10:00:00', -- time of day to send
  timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
  
  -- Statistics
  total_sent INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Configuration
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  auto_send BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create reminder logs table
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  reminder_config_id UUID REFERENCES public.reminder_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255),
  message_sent TEXT NOT NULL,
  
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'scheduled'
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.reminder_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_configs
CREATE POLICY "Admins can manage all reminder configs"
  ON public.reminder_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies for reminder_logs
CREATE POLICY "Admins can view all reminder logs"
  ON public.reminder_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Service can insert reminder logs"
  ON public.reminder_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update reminder logs"
  ON public.reminder_logs
  FOR UPDATE
  USING (true);

-- Create indexes
CREATE INDEX idx_reminder_configs_active ON public.reminder_configs(is_active);
CREATE INDEX idx_reminder_configs_type ON public.reminder_configs(reminder_type);
CREATE INDEX idx_reminder_logs_config ON public.reminder_logs(reminder_config_id);
CREATE INDEX idx_reminder_logs_status ON public.reminder_logs(status);
CREATE INDEX idx_reminder_logs_scheduled ON public.reminder_logs(scheduled_at) WHERE status = 'scheduled';

-- Create trigger for updated_at
CREATE TRIGGER update_reminder_configs_updated_at
  BEFORE UPDATE ON public.reminder_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================
-- ADD-ONS & INTEGRATIONS SYSTEM
-- ============================================

-- 1. Add-ons table (for marketplace products)
CREATE TABLE IF NOT EXISTS public.add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'chatbot', 'integration', 'automation', 'template'
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User add-ons purchases
CREATE TABLE IF NOT EXISTS public.user_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  payment_id UUID REFERENCES public.payments(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, add_on_id)
);

-- 3. Integrations configuration table
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_type VARCHAR(50) NOT NULL, -- 'shopify', 'woocommerce', 'google_sheets', 'payment_gateway'
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- encrypted credentials and settings
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_type)
);

-- 4. AI Chatbot rules (enhanced with AI)
CREATE TABLE IF NOT EXISTS public.chatbot_ai_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  rule_name VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'keyword', -- 'keyword', 'ai', 'pattern'
  trigger_value TEXT, -- keywords or patterns
  ai_enabled BOOLEAN DEFAULT false,
  ai_model VARCHAR(50) DEFAULT 'google/gemini-2.5-flash',
  ai_prompt TEXT, -- custom AI instructions
  response_type VARCHAR(20) DEFAULT 'text', -- 'text', 'template', 'ai'
  response_text TEXT,
  response_template_id UUID,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Chatbot conversation history (for AI context)
CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  contact_phone VARCHAR(20) NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb, -- array of {role, content, timestamp}
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, contact_phone)
);

-- 6. Integration sync logs
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'order_sync', 'customer_sync', 'stock_sync', 'payment_confirm'
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_add_ons_user_id ON public.user_add_ons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_add_ons_active ON public.user_add_ons(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON public.integrations(user_id, integration_type);
CREATE INDEX IF NOT EXISTS idx_chatbot_ai_rules_device ON public.chatbot_ai_rules(device_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_device_phone ON public.chatbot_conversations(device_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON public.integration_logs(created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Add-ons (public read, admin write)
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active add-ons"
  ON public.add_ons FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage add-ons"
  ON public.add_ons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- User add-ons (users can view their own)
ALTER TABLE public.user_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their add-ons"
  ON public.user_add_ons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert user add-ons"
  ON public.user_add_ons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Integrations (users manage their own)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their integrations"
  ON public.integrations FOR ALL
  USING (auth.uid() = user_id);

-- AI Chatbot rules (users manage their own)
ALTER TABLE public.chatbot_ai_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their AI chatbot rules"
  ON public.chatbot_ai_rules FOR ALL
  USING (auth.uid() = user_id);

-- Chatbot conversations (users view their own)
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their chatbot conversations"
  ON public.chatbot_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage chatbot conversations"
  ON public.chatbot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update chatbot conversations"
  ON public.chatbot_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Integration logs (users view their own)
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their integration logs"
  ON public.integration_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert integration logs"
  ON public.integration_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check if user has an active add-on
CREATE OR REPLACE FUNCTION public.user_has_add_on(p_user_id UUID, p_add_on_slug VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_add_ons ua
    JOIN public.add_ons ao ON ua.add_on_id = ao.id
    WHERE ua.user_id = p_user_id
      AND ao.slug = p_add_on_slug
      AND ua.is_active = true
      AND (ua.expires_at IS NULL OR ua.expires_at > NOW())
  );
END;
$$;

-- Function to update integration last sync
CREATE OR REPLACE FUNCTION public.update_integration_sync(
  p_integration_id UUID,
  p_status VARCHAR,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.integrations
  SET
    last_sync_at = NOW(),
    sync_status = p_status,
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_integration_id;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_add_ons_timestamp
  BEFORE UPDATE ON public.add_ons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_timestamp();

CREATE TRIGGER trigger_update_integrations_timestamp
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_timestamp();

CREATE TRIGGER trigger_update_chatbot_ai_rules_timestamp
  BEFORE UPDATE ON public.chatbot_ai_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_timestamp();

-- ============================================
-- INSERT DEFAULT ADD-ONS
-- ============================================

INSERT INTO public.add_ons (name, slug, description, category, price, features, metadata) VALUES
-- Chatbot AI
('AI Chatbot Basic', 'ai-chatbot-basic', 'AI-powered chatbot dengan natural language processing', 'chatbot', 150000, 
  '["Natural language understanding", "Auto-reply cerdas", "100 conversations/bulan", "Basic AI model"]'::jsonb,
  '{"model": "google/gemini-2.5-flash-lite", "max_conversations": 100}'::jsonb),

('AI Chatbot Pro', 'ai-chatbot-pro', 'AI Chatbot advanced dengan unlimited conversations', 'chatbot', 350000,
  '["Advanced AI model", "Unlimited conversations", "Custom AI training", "Multi-language support", "Context memory"]'::jsonb,
  '{"model": "google/gemini-2.5-flash", "max_conversations": -1}'::jsonb),

-- Integrations
('Shopify Integration', 'shopify-integration', 'Sinkronisasi otomatis orders, customers, dan stock dengan Shopify', 'integration', 200000,
  '["Auto order sync", "Customer sync", "Stock alerts", "Payment confirmation", "Shipping updates"]'::jsonb,
  '{"webhook_support": true, "sync_interval": 300}'::jsonb),

('WooCommerce Integration', 'woocommerce-integration', 'Integrasi lengkap dengan WooCommerce store', 'integration', 180000,
  '["Order notifications", "Customer sync", "Product updates", "Payment tracking", "Automated messages"]'::jsonb,
  '{"webhook_support": true, "sync_interval": 300}'::jsonb),

('Google Sheets Sync', 'google-sheets-sync', 'Import/export contacts otomatis ke Google Sheets', 'integration', 100000,
  '["Auto import contacts", "Export to Sheets", "Scheduled sync", "Bi-directional sync", "Custom mapping"]'::jsonb,
  '{"sync_interval": 3600, "max_rows": 10000}'::jsonb),

('Payment Gateway Pack', 'payment-gateway-pack', 'Konfirmasi pembayaran otomatis (Midtrans, Xendit, dll)', 'integration', 150000,
  '["Auto payment confirmation", "Multiple gateway support", "Custom messages", "Transaction tracking"]'::jsonb,
  '{"supported_gateways": ["midtrans", "xendit", "paypal"]}'::jsonb)

ON CONFLICT (slug) DO NOTHING;
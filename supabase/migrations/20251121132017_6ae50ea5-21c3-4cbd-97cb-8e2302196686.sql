-- Create plan_add_ons junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.plan_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, add_on_id)
);

-- Enable RLS
ALTER TABLE public.plan_add_ons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage plan_add_ons"
  ON public.plan_add_ons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can view plan_add_ons"
  ON public.plan_add_ons FOR SELECT
  USING (true);

-- Index for performance
CREATE INDEX idx_plan_add_ons_plan_id ON public.plan_add_ons(plan_id);
CREATE INDEX idx_plan_add_ons_add_on_id ON public.plan_add_ons(add_on_id);

-- Add payment columns to user_add_ons for standalone purchases
ALTER TABLE public.user_add_ons 
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;

-- Index for payment lookups
CREATE INDEX IF NOT EXISTS idx_user_add_ons_order_id ON public.user_add_ons(order_id);
CREATE INDEX IF NOT EXISTS idx_user_add_ons_payment_status ON public.user_add_ons(payment_status);
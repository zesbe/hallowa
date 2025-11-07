-- Create invoices table for payment tracking
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'IDR',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_method VARCHAR(100),
  payment_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can only view their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert and update invoices
CREATE POLICY "Service can manage invoices"
  ON invoices
  FOR ALL
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_payment_date ON invoices(payment_date DESC);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice_number();

-- Add comments
COMMENT ON TABLE invoices IS 'Store payment invoices and transaction history';
COMMENT ON FUNCTION generate_invoice_number IS 'Auto-generate unique invoice numbers in format INV-YYYYMM-XXXX';

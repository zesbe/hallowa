-- Create marketplace_products table for templates and premium features
CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL CHECK (category IN ('template', 'chatbot', 'broadcast', 'automation', 'integration')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('free', 'premium', 'subscription')),
  price DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'IDR',
  thumbnail_url TEXT,
  preview_images TEXT[] DEFAULT '{}',
  content JSONB NOT NULL, -- Store template content, bot config, etc.
  tags TEXT[] DEFAULT '{}',
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_purchases table to track purchased items
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  price_paid DECIMAL(10, 2) NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Add RLS policies for marketplace_products
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;

-- Anyone can view published products
CREATE POLICY "Anyone can view published products"
  ON marketplace_products
  FOR SELECT
  USING (is_published = true);

-- Admins can do everything with products
CREATE POLICY "Admins can manage products"
  ON marketplace_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add RLS policies for user_purchases
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;

-- Users can only view their own purchases
CREATE POLICY "Users can view own purchases"
  ON user_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert purchases
CREATE POLICY "Service can insert purchases"
  ON user_purchases
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_marketplace_products_category ON marketplace_products(category);
CREATE INDEX idx_marketplace_products_type ON marketplace_products(type);
CREATE INDEX idx_marketplace_products_published ON marketplace_products(is_published);
CREATE INDEX idx_marketplace_products_featured ON marketplace_products(is_featured);
CREATE INDEX idx_marketplace_products_downloads ON marketplace_products(downloads DESC);
CREATE INDEX idx_marketplace_products_rating ON marketplace_products(rating DESC);
CREATE INDEX idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_product_id ON user_purchases(product_id);

-- Add updated_at trigger
CREATE TRIGGER update_marketplace_products_updated_at
  BEFORE UPDATE ON marketplace_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_product_downloads(p_product_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE marketplace_products
  SET downloads = downloads + 1
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE marketplace_products IS 'Store marketplace templates and premium features';
COMMENT ON TABLE user_purchases IS 'Track user purchases from marketplace';
COMMENT ON COLUMN marketplace_products.content IS 'JSON content: templates, chatbot configs, automation rules';

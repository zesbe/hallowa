-- Fix security issue: Add search_path to update_updated_at_timestamp function
-- Using CREATE OR REPLACE instead of DROP to avoid cascade issues
CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
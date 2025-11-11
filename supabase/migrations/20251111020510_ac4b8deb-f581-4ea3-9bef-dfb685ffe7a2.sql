-- Add unique constraint on contacts table for (user_id, phone_number)
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_user_phone_unique UNIQUE (user_id, phone_number);

-- Create function to auto-sync customer phone numbers to admin contacts
CREATE OR REPLACE FUNCTION public.sync_customer_to_admin_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Only process if phone_number is not null
  IF NEW.phone_number IS NULL OR NEW.phone_number = '' THEN
    RETURN NEW;
  END IF;

  -- Get the first admin user
  SELECT user_id INTO v_admin_id
  FROM user_roles
  WHERE role = 'admin'
  LIMIT 1;

  -- If no admin found, skip
  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert or update contact for admin
  INSERT INTO public.contacts (
    user_id,
    phone_number,
    name,
    notes,
    tags
  )
  VALUES (
    v_admin_id,
    NEW.phone_number,
    COALESCE(NEW.full_name, 'Customer'),
    'Auto-synced from customer database',
    ARRAY['customer', 'auto-sync']
  )
  ON CONFLICT (user_id, phone_number)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    notes = COALESCE(EXCLUDED.notes, contacts.notes),
    tags = ARRAY(SELECT DISTINCT unnest(contacts.tags || EXCLUDED.tags)),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS sync_customer_on_profile_insert ON public.profiles;
CREATE TRIGGER sync_customer_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_to_admin_contacts();

-- Create trigger for profile updates
DROP TRIGGER IF EXISTS sync_customer_on_profile_update ON public.profiles;
CREATE TRIGGER sync_customer_on_profile_update
  AFTER UPDATE OF phone_number, full_name ON public.profiles
  FOR EACH ROW
  WHEN (NEW.phone_number IS DISTINCT FROM OLD.phone_number OR NEW.full_name IS DISTINCT FROM OLD.full_name)
  EXECUTE FUNCTION public.sync_customer_to_admin_contacts();

-- Sync existing profiles to admin contacts
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get the first admin user
  SELECT user_id INTO v_admin_id
  FROM user_roles
  WHERE role = 'admin'
  LIMIT 1;

  -- If admin exists, sync existing profiles
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.contacts (
      user_id,
      phone_number,
      name,
      notes,
      tags
    )
    SELECT
      v_admin_id,
      p.phone_number,
      COALESCE(p.full_name, 'Customer'),
      'Auto-synced from customer database',
      ARRAY['customer', 'auto-sync']
    FROM public.profiles p
    WHERE p.phone_number IS NOT NULL AND p.phone_number != ''
    ON CONFLICT (user_id, phone_number)
    DO UPDATE SET
      name = COALESCE(EXCLUDED.name, contacts.name),
      notes = COALESCE(EXCLUDED.notes, contacts.notes),
      tags = ARRAY(SELECT DISTINCT unnest(contacts.tags || EXCLUDED.tags)),
      updated_at = NOW();
  END IF;
END $$;
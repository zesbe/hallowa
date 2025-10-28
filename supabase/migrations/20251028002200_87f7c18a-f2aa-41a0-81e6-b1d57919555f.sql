-- Add enterprise features to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS contact_count integer DEFAULT 0;

-- Create index for tags search
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON public.contacts USING GIN(tags);

-- Create index for last contacted
CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON public.contacts(last_contacted_at DESC);

-- Add comment
COMMENT ON COLUMN public.contacts.tags IS 'Tags/labels for organizing contacts';
COMMENT ON COLUMN public.contacts.notes IS 'Private notes about this contact';
COMMENT ON COLUMN public.contacts.last_contacted_at IS 'Last time a message was sent to this contact';
COMMENT ON COLUMN public.contacts.contact_count IS 'Number of messages sent to this contact';
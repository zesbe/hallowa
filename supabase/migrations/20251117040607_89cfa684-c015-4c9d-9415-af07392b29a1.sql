-- Add professional delay settings to recurring_messages table
ALTER TABLE public.recurring_messages
ADD COLUMN IF NOT EXISTS delay_type VARCHAR(20) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS pause_between_batches INTEGER DEFAULT 60;

-- Update existing records to have default values
UPDATE public.recurring_messages
SET delay_type = 'auto'
WHERE delay_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.recurring_messages.delay_type IS 'Delay mode: auto (smart adaptive), manual (custom), adaptive (based on contact count)';
COMMENT ON COLUMN public.recurring_messages.batch_size IS 'Number of messages per batch before pause';
COMMENT ON COLUMN public.recurring_messages.pause_between_batches IS 'Pause duration in seconds between batches';
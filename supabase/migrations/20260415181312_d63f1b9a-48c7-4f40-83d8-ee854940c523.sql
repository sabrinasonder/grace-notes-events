-- Create event status enum
CREATE TYPE public.event_status AS ENUM ('active', 'cancelled', 'completed');

-- Add status column to events
ALTER TABLE public.events
  ADD COLUMN status public.event_status NOT NULL DEFAULT 'active';

-- Create function to auto-complete past events
CREATE OR REPLACE FUNCTION public.auto_complete_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.events
  SET status = 'completed', updated_at = now()
  WHERE status = 'active'
    AND starts_at < (now() - interval '4 hours');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
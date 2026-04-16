-- Add optional external payment link (Venmo, Zelle, Cash App, etc.) to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_payment_link TEXT;

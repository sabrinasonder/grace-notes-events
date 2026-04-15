-- Add stripe_environment to payments so cancel-event can refund via the correct Stripe key
ALTER TABLE public.payments
  ADD COLUMN stripe_environment text NOT NULL DEFAULT 'sandbox';

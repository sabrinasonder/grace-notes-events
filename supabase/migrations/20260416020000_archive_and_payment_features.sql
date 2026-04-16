-- 1. Add photo_save_notified_at to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS photo_save_notified_at timestamptz;

-- 2. Drop old host-delete policy; replace with admin-only after grace period
DROP POLICY IF EXISTS "Hosts can delete their own events" ON public.events;

CREATE POLICY "Admins can delete past events after grace period"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND starts_at < now()
    AND photo_save_notified_at IS NOT NULL
    AND photo_save_notified_at + interval '7 days' < now()
  );

-- Allow admins to update photo_save_notified_at
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Allow event host to update the `paid` field on RSVPs for their events
CREATE POLICY "Host can update payment status on own event RSVPs"
  ON public.rsvps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = rsvps.event_id
        AND events.host_id = auth.uid()
    )
  );

-- 4. Payment status log table (audit trail for paid/unpaid toggles)
CREATE TABLE IF NOT EXISTS public.rsvp_payment_logs (
  id          uuid primary key default gen_random_uuid(),
  rsvp_id     uuid not null references public.rsvps(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  guest_id    uuid not null references public.profiles(id) on delete cascade,
  changed_by  uuid not null references public.profiles(id) on delete cascade,
  paid        boolean not null,        -- the NEW value being set
  created_at  timestamptz not null default now()
);

ALTER TABLE public.rsvp_payment_logs ENABLE ROW LEVEL SECURITY;

-- Host and admin can read logs for their events
CREATE POLICY "Host can read payment logs for own events"
  ON public.rsvp_payment_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = rsvp_payment_logs.event_id
        AND events.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Host can insert logs
CREATE POLICY "Host can insert payment logs"
  ON public.rsvp_payment_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = rsvp_payment_logs.event_id
        AND events.host_id = auth.uid()
    )
  );

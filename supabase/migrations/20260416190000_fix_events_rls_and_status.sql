-- ══════════════════════════════════════════════════════════════
-- FIX: Replace broken events SELECT policies + backfill NULL status
-- Safe to run multiple times. Paste into Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════

-- Step 1: Drop ALL existing SELECT policies on events
DROP POLICY IF EXISTS "Events are viewable based on privacy" ON public.events;
DROP POLICY IF EXISTS "invited_users_see_events" ON public.events;
DROP POLICY IF EXISTS "Users can view events" ON public.events;

-- Step 2: Create ONE comprehensive policy
CREATE POLICY "Events are viewable"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    -- You're the host
    host_id = auth.uid()
    -- You're a co-host
    OR EXISTS (
      SELECT 1 FROM public.event_hosts
      WHERE event_id = events.id AND user_id = auth.uid()
    )
    -- You're an admin
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    -- Event is open to all authenticated members
    OR privacy IN ('open', 'request_to_join')
    -- You've been invited (and haven't declined)
    OR EXISTS (
      SELECT 1 FROM public.event_invites
      WHERE event_id = events.id
        AND invited_user_id = auth.uid()
        AND status::text != 'declined'
    )
    -- You have an active RSVP
    OR EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE event_id = events.id
        AND user_id = auth.uid()
        AND status IN ('going', 'maybe')
    )
  );

-- Step 3: Backfill any events with NULL status so the app query can find them
UPDATE public.events
SET status = 'active'
WHERE status IS NULL;

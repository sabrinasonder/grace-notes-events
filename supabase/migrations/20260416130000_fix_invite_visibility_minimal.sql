-- ══════════════════════════════════════════════════════════════
-- MINIMAL FIX: Allow invited users to see events they're invited to
-- Safe to run multiple times. Paste into Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════

-- Step 1: Rebuild can_view_event with the invite check (idempotent)
CREATE OR REPLACE FUNCTION public.can_view_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.event_hosts WHERE event_id = _event_id AND user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.events WHERE id = _event_id AND privacy IN ('open', 'request_to_join')
  )
  OR EXISTS (
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id
      AND invited_user_id = _user_id
      AND status::text != 'declined'
  )
  OR EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status IN ('going', 'maybe')
  )
$$;

-- Step 2: Add an explicit permissive policy as belt-and-suspenders
-- (safe to run even if policy already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'events'
      AND policyname = 'invited_users_see_events'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "invited_users_see_events"
        ON public.events FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.event_invites
            WHERE event_invites.event_id        = events.id
              AND event_invites.invited_user_id = auth.uid()
              AND event_invites.status::text   != 'declined'
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 1. Update can_view_event to allow RSVPd attendees to always see the event ──
-- Previously, removing an event_invite for a user who had already RSVPd
-- would make the event invisible to them. This adds a rsvps check so an
-- existing going/maybe RSVP always grants visibility on invite_only events.

CREATE OR REPLACE FUNCTION public.can_view_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Host can always see
    SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id
  )
  OR EXISTS (
    -- Co-host can always see
    SELECT 1 FROM public.event_hosts WHERE event_id = _event_id AND user_id = _user_id
  )
  OR EXISTS (
    -- Admin can always see
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    -- Open or request_to_join events visible to all authenticated members
    SELECT 1 FROM public.events WHERE id = _event_id AND privacy IN ('open', 'request_to_join')
  )
  OR EXISTS (
    -- Invite-only: user has a non-declined invite
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
  OR EXISTS (
    -- User already RSVPd (going or maybe) — keep access even if invite later removed
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status IN ('going', 'maybe')
  )
$$;

-- ── 2. Avatars storage bucket ─────────────────────────────────────────────────
-- Public bucket for profile photos. Each user owns their subfolder: avatars/{user_id}/
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if present (idempotent re-run safety)
DROP POLICY IF EXISTS "avatars_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"   ON storage.objects;

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

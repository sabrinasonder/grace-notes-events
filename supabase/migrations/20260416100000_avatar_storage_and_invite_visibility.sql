-- ── 1. Avatars storage bucket ─────────────────────────────────────────────────
-- Public bucket — URLs are safe to embed in <img> tags anywhere in the app.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read avatar images (they're already public objects)
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can only upload into their own folder: avatars/{user_id}/...
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

-- ── 2. Explicit event visibility for invited users ────────────────────────────
-- can_view_event() already covers this via the RLS function, but an explicit
-- permissive policy guarantees invited users never hit a "not found" wall
-- due to evaluation order or future policy changes.
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
              AND event_invites.status         != 'declined'
          )
        )
    $policy$;
  END IF;
END $$;

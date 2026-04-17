-- ═══════════════════════════════════════════════════════════════════════════════
-- CONSOLIDATED FIX — paste this entire file into Supabase SQL Editor and run it.
-- Safe to run multiple times (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. FIX: Invited users can see invite_only events ─────────────────────────
-- The existing can_view_event() function has this check, but an explicit
-- permissive policy guarantees it works for every new user path.
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

-- ── 2. UPDATE can_view_event — add co-host + rsvp checks ─────────────────────
-- Adds two missing cases:
--   a) co-hosts (event_hosts table) can always see events they co-host
--   b) users who already RSVPd keep access even if their invite is later removed
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
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
  OR EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status IN ('going', 'maybe')
  )
$$;

-- ── 3. Notifications table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type             text        NOT NULL,
  title            text        NOT NULL,
  body             text        NOT NULL DEFAULT '',
  related_event_id uuid        REFERENCES public.events(id)   ON DELETE CASCADE,
  related_user_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_url       text,
  is_read          boolean     NOT NULL DEFAULT false,
  is_dismissed     boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select_own') THEN
    CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert_authenticated') THEN
    CREATE POLICY "notifications_insert_authenticated" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update_own') THEN
    CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_feed
  ON public.notifications(user_id, is_dismissed, created_at DESC);

-- ── 4. Notification triggers ──────────────────────────────────────────────────

-- Trigger: new event invite → notify invitee
CREATE OR REPLACE FUNCTION notify_on_event_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_title  text;
  v_inviter_name text;
BEGIN
  SELECT title     INTO v_event_title  FROM events   WHERE id = NEW.event_id;
  SELECT full_name INTO v_inviter_name FROM profiles  WHERE id = NEW.invited_by;
  INSERT INTO notifications (user_id, type, title, body, related_event_id, related_user_id, action_url)
  VALUES (
    NEW.invited_user_id, 'event_invite', 'You''re invited!',
    COALESCE(v_inviter_name, 'Someone') || ' invited you to ' || COALESCE(v_event_title, 'an event'),
    NEW.event_id, NEW.invited_by, '/event/' || NEW.event_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_invite ON public.event_invites;
CREATE TRIGGER trg_notify_event_invite
  AFTER INSERT ON public.event_invites
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_invite();

-- Trigger: membership request → notify admins
CREATE OR REPLACE FUNCTION notify_on_membership_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name    text;
  v_admin   uuid;
BEGIN
  SELECT full_name INTO v_name FROM profiles WHERE id = NEW.user_id;
  FOR v_admin IN SELECT user_id FROM user_roles WHERE role = 'admin' LOOP
    INSERT INTO notifications (user_id, type, title, body, related_user_id, action_url)
    VALUES (v_admin, 'membership_request', 'New member request',
      COALESCE(v_name,'Someone') || ' wants to join Sonder Circle', NEW.user_id, '/admin/members');
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_membership_request ON public.membership_requests;
CREATE TRIGGER trg_notify_membership_request
  AFTER INSERT ON public.membership_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_membership_request();

-- Trigger: membership approved → notify member
CREATE OR REPLACE FUNCTION notify_on_membership_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO notifications (user_id, type, title, body, action_url)
    VALUES (NEW.user_id, 'membership_approved', 'Welcome to Sonder Circle!',
      'Your membership has been approved. You''re now part of the community.', '/');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_membership_approved ON public.membership_requests;
CREATE TRIGGER trg_notify_membership_approved
  AFTER UPDATE ON public.membership_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_membership_approved();

-- Trigger: event time/location change → notify attendees
CREATE OR REPLACE FUNCTION notify_on_event_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attendee uuid;
  v_change   text := '';
BEGIN
  IF NEW.status != 'active' THEN RETURN NEW; END IF;
  IF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN v_change := 'Time changed'; END IF;
  IF OLD.location  IS DISTINCT FROM NEW.location  THEN
    v_change := CASE WHEN v_change != '' THEN 'Time & location changed' ELSE 'Location changed' END;
  END IF;
  IF v_change = '' THEN RETURN NEW; END IF;
  FOR v_attendee IN
    SELECT user_id FROM rsvps WHERE event_id=NEW.id AND status IN ('going','maybe') AND user_id != NEW.host_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, related_event_id, action_url)
    VALUES (v_attendee, 'event_update', v_change || ': ' || NEW.title,
      v_change || ' for ' || NEW.title || '. Tap to see updated details.',
      NEW.id, '/event/' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_update ON public.events;
CREATE TRIGGER trg_notify_event_update
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_update();

-- ── 5. Avatars storage bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;

CREATE POLICY "avatars_public_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_owner_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id='avatars' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_update"  ON storage.objects FOR UPDATE USING    (bucket_id='avatars' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_delete"  ON storage.objects FOR DELETE USING    (bucket_id='avatars' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ── 6. external_payment_link column (if not yet applied) ─────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_payment_link TEXT;

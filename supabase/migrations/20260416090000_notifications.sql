-- ── Notifications ────────────────────────────────────────────────────────────
-- In-app notification system for Sonder Circle.
-- Notifications are created by database triggers (event invites, membership
-- requests, event updates) and read/dismissed by the owning user.
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Users see only their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Triggers run as SECURITY DEFINER, but the frontend also creates some
CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can mark their own notifications as read/dismissed
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_feed
  ON public.notifications(user_id, is_dismissed, created_at DESC);

-- ── Trigger: new event invite → notify invitee ────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_event_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_title  text;
  v_inviter_name text;
BEGIN
  SELECT title       INTO v_event_title  FROM events   WHERE id = NEW.event_id;
  SELECT full_name   INTO v_inviter_name FROM profiles  WHERE id = NEW.invited_by;

  INSERT INTO notifications (user_id, type, title, body, related_event_id, related_user_id, action_url)
  VALUES (
    NEW.invited_user_id,
    'event_invite',
    'You''re invited!',
    COALESCE(v_inviter_name, 'Someone') || ' invited you to ' || COALESCE(v_event_title, 'an event'),
    NEW.event_id,
    NEW.invited_by,
    '/event/' || NEW.event_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_invite ON public.event_invites;
CREATE TRIGGER trg_notify_event_invite
  AFTER INSERT ON public.event_invites
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_invite();

-- ── Trigger: new membership request → notify all admins ───────────────────────

CREATE OR REPLACE FUNCTION notify_on_membership_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_requester_name text;
  v_admin_id       uuid;
BEGIN
  SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.user_id;

  FOR v_admin_id IN
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, title, body, related_user_id, action_url)
    VALUES (
      v_admin_id,
      'membership_request',
      'New member request',
      COALESCE(v_requester_name, 'Someone') || ' wants to join Sonder Circle',
      NEW.user_id,
      '/admin/members'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_membership_request ON public.membership_requests;
CREATE TRIGGER trg_notify_membership_request
  AFTER INSERT ON public.membership_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_membership_request();

-- ── Trigger: membership approved → notify the member ─────────────────────────

CREATE OR REPLACE FUNCTION notify_on_membership_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO notifications (user_id, type, title, body, action_url)
    VALUES (
      NEW.user_id,
      'membership_approved',
      'Welcome to Sonder Circle!',
      'Your membership has been approved. You''re now part of the community.',
      '/'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_membership_approved ON public.membership_requests;
CREATE TRIGGER trg_notify_membership_approved
  AFTER UPDATE ON public.membership_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_membership_approved();

-- ── Trigger: event time/location change → notify all attendees ───────────────

CREATE OR REPLACE FUNCTION notify_on_event_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attendee_id uuid;
  v_change_desc text := '';
BEGIN
  -- Only fire for active events with real schedule/location changes
  IF NEW.status != 'active' THEN RETURN NEW; END IF;

  IF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN
    v_change_desc := 'Time changed';
  END IF;
  IF OLD.location IS DISTINCT FROM NEW.location THEN
    v_change_desc := CASE
      WHEN v_change_desc != '' THEN 'Time & location changed'
      ELSE 'Location changed'
    END;
  END IF;

  IF v_change_desc = '' THEN RETURN NEW; END IF;

  FOR v_attendee_id IN
    SELECT user_id FROM rsvps
    WHERE  event_id = NEW.id
      AND  status IN ('going', 'maybe')
      AND  user_id != NEW.host_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, related_event_id, action_url)
    VALUES (
      v_attendee_id,
      'event_update',
      v_change_desc || ': ' || NEW.title,
      v_change_desc || ' for ' || NEW.title || '. Tap to see the updated details.',
      NEW.id,
      '/event/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_update ON public.events;
CREATE TRIGGER trg_notify_event_update
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION notify_on_event_update();

-- =============================================================
-- Sonder Circle — Complete Schema Export
-- Generated from all migrations. Run once in a fresh Supabase
-- project's SQL Editor to recreate the full database schema.
-- =============================================================


-- -------------------------------------------------------------
-- EXTENSIONS
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net   SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;


-- -------------------------------------------------------------
-- ENUMS
-- -------------------------------------------------------------
CREATE TYPE public.rsvp_status          AS ENUM ('going', 'maybe', 'declined');
CREATE TYPE public.event_status         AS ENUM ('active', 'cancelled', 'completed');
CREATE TYPE public.event_privacy        AS ENUM ('invite_only', 'request_to_join', 'open');
CREATE TYPE public.app_role             AS ENUM ('member', 'admin');
CREATE TYPE public.invite_status        AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE public.event_invite_status  AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE public.rsvp_request_status  AS ENUM ('pending', 'approved', 'declined');


-- -------------------------------------------------------------
-- SHARED UTILITY FUNCTIONS
-- (defined early so triggers can reference them)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- -------------------------------------------------------------
-- PROFILES
-- -------------------------------------------------------------
CREATE TABLE public.profiles (
  id              UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  full_name       TEXT,
  avatar_url      TEXT,
  city            TEXT,
  phone           TEXT,
  phone_verified  BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -------------------------------------------------------------
-- USER ROLES
-- -------------------------------------------------------------
CREATE TABLE public.user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       app_role    NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'member' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Seed: make sabrina@sonderdigitalagency.com an admin
-- (safe no-op if that account doesn't exist yet in this project)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email = 'sabrina@sonderdigitalagency.com'
ON CONFLICT (user_id, role) DO NOTHING;


-- -------------------------------------------------------------
-- EVENTS
-- -------------------------------------------------------------
CREATE TABLE public.events (
  id                      UUID              NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id                 UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                   TEXT              NOT NULL,
  description             TEXT,
  cover_image_url         TEXT,
  starts_at               TIMESTAMPTZ       NOT NULL,
  location                TEXT,
  capacity                INTEGER,
  price_cents             INTEGER           NOT NULL DEFAULT 0,
  auto_reminders_enabled  BOOLEAN           NOT NULL DEFAULT true,
  status                  public.event_status    NOT NULL DEFAULT 'active',
  privacy                 public.event_privacy   NOT NULL DEFAULT 'invite_only',
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- NOTE: the SELECT policy and the two helper functions that reference
-- event_invites are added below, after that table is created.

CREATE POLICY "Users can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own events"
  ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own events"
  ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = host_id);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-complete past events (called by pg_cron or manually)
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
  WHERE status = 'active' AND starts_at < (now() - interval '4 hours');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


-- -------------------------------------------------------------
-- RSVPs
-- -------------------------------------------------------------
CREATE TABLE public.rsvps (
  id                UUID              NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id          UUID              NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id           UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            public.rsvp_status NOT NULL DEFAULT 'going',
  paid              BOOLEAN           NOT NULL DEFAULT false,
  stripe_payment_id TEXT,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

-- NOTE: the SELECT policy references event_invites and is added
-- below in the EVENT VISIBILITY HELPERS section, after that table exists.

CREATE POLICY "Users can create their own RSVP"
  ON public.rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSVP"
  ON public.rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own RSVP"
  ON public.rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- PAYMENTS
-- -------------------------------------------------------------
CREATE TABLE public.payments (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id            UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id   TEXT        UNIQUE,
  amount_cents        INTEGER     NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'pending',
  stripe_environment  TEXT        NOT NULL DEFAULT 'sandbox',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts can view payments for their events"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE events.id = payments.event_id AND events.host_id = auth.uid())
  );

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- MESSAGES (chat)
-- -------------------------------------------------------------
CREATE TABLE public.messages (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        TEXT        NOT NULL DEFAULT '',
  image_url   TEXT,
  reply_to_id UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_messages_event_created ON public.messages (event_id, created_at);
CREATE INDEX idx_messages_reply_to      ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_event_chat(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id)
  OR EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status IN ('going', 'maybe')
  )
$$;

CREATE POLICY "Chat participants can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_event_chat(auth.uid(), event_id));

CREATE POLICY "Chat participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_event_chat(auth.uid(), event_id));

CREATE POLICY "Users can soft-delete own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Hosts can soft-delete any message in their event"
  ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid()));


-- -------------------------------------------------------------
-- MESSAGE READS
-- -------------------------------------------------------------
CREATE TABLE public.message_reads (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_message_reads_user ON public.message_reads (user_id, message_id);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read receipts"
  ON public.message_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can mark messages as read"
  ON public.message_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());


-- -------------------------------------------------------------
-- TYPING INDICATORS
-- -------------------------------------------------------------
CREATE TABLE public.typing_indicators (
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_typed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can see typing"
  ON public.typing_indicators FOR SELECT TO authenticated
  USING (public.can_access_event_chat(auth.uid(), event_id));

CREATE POLICY "Users can update own typing status"
  ON public.typing_indicators FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_event_chat(auth.uid(), event_id));

CREATE POLICY "Users can refresh own typing"
  ON public.typing_indicators FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove own typing"
  ON public.typing_indicators FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- -------------------------------------------------------------
-- UPDATES (host announcements)
-- -------------------------------------------------------------
CREATE TABLE public.updates (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view updates"
  ON public.updates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authors can create updates"
  ON public.updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);


-- -------------------------------------------------------------
-- EVENT PHOTOS
-- -------------------------------------------------------------
CREATE TABLE public.event_photos (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url   TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'upload',
  message_id  UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event photos"
  ON public.event_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload event photos"
  ON public.event_photos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);


-- -------------------------------------------------------------
-- NOTIFICATION PREFERENCES
-- -------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  email_reminders          BOOLEAN     NOT NULL DEFAULT true,
  sms_reminders            BOOLEAN     NOT NULL DEFAULT true,
  host_announcements_email BOOLEAN     NOT NULL DEFAULT true,
  host_announcements_sms   BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- -------------------------------------------------------------
-- INVITES (circle membership)
-- -------------------------------------------------------------
CREATE TABLE public.invites (
  id             UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id     UUID                 NOT NULL,
  invitee_email  TEXT                 NOT NULL,
  invitee_name   TEXT                 NOT NULL,
  personal_note  TEXT,
  token          TEXT                 NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status         public.invite_status NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ          NOT NULL DEFAULT now(),
  accepted_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ          NOT NULL DEFAULT (now() + interval '14 days')
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can create invites"
  ON public.invites FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Members can view own invites"
  ON public.invites FOR SELECT TO authenticated USING (inviter_id = auth.uid());

CREATE POLICY "Members can revoke own pending invites"
  ON public.invites FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can view all invites"
  ON public.invites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all invites"
  ON public.invites FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage invites"
  ON public.invites FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- -------------------------------------------------------------
-- EVENT INVITES
-- -------------------------------------------------------------
CREATE TABLE public.event_invites (
  id              UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID                        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_user_id UUID                        NOT NULL,
  invited_by      UUID                        NOT NULL,
  status          public.event_invite_status  NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  UNIQUE (event_id, invited_user_id)
);

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can manage event invites"
  ON public.event_invites FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid()));

CREATE POLICY "Invited users can view own invites"
  ON public.event_invites FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid());

CREATE POLICY "Invited users can update own invite status"
  ON public.event_invites FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid());


-- -------------------------------------------------------------
-- EVENT VISIBILITY HELPERS
-- Defined here because both functions reference event_invites,
-- which must exist before these are created.
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND privacy IN ('open', 'request_to_join'))
  OR EXISTS (
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_event_location(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id)
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
  OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND privacy = 'open')
  OR EXISTS (
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
  OR EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status = 'going'
  )
$$;

-- Now safe to add the events SELECT policy
CREATE POLICY "Events are viewable based on privacy"
  ON public.events FOR SELECT TO authenticated
  USING (public.can_view_event(auth.uid(), id));

-- Now safe to add the rsvps SELECT policy
CREATE POLICY "RSVPs viewable based on event privacy"
  ON public.rsvps FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND privacy != 'invite_only')
    OR EXISTS (
      SELECT 1 FROM public.event_invites
      WHERE event_invites.event_id = rsvps.event_id
        AND event_invites.invited_user_id = auth.uid()
        AND event_invites.status != 'declined'
    )
  );


-- -------------------------------------------------------------
-- RSVP REQUESTS
-- -------------------------------------------------------------
CREATE TABLE public.rsvp_requests (
  id          UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID                        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID                        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message     TEXT,
  status      public.rsvp_request_status  NOT NULL DEFAULT 'pending',
  decided_at  TIMESTAMPTZ,
  decided_by  UUID,
  created_at  TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.rsvp_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create join requests"
  ON public.rsvp_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own requests"
  ON public.rsvp_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Hosts can view requests for their events"
  ON public.rsvp_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid()));

CREATE POLICY "Hosts can approve/decline requests"
  ON public.rsvp_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.approve_rsvp_request(_request_id UUID, _host_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id UUID;
  _user_id  UUID;
BEGIN
  SELECT rr.event_id, rr.user_id INTO _event_id, _user_id
  FROM public.rsvp_requests rr
  JOIN public.events e ON e.id = rr.event_id
  WHERE rr.id = _request_id AND rr.status = 'pending' AND e.host_id = _host_id;

  IF _event_id IS NULL THEN RETURN false; END IF;

  UPDATE public.rsvp_requests
  SET status = 'approved', decided_by = _host_id, decided_at = now()
  WHERE id = _request_id;

  INSERT INTO public.rsvps (event_id, user_id, status, paid)
  VALUES (_event_id, _user_id, 'going', false)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  RETURN true;
END;
$$;


-- -------------------------------------------------------------
-- EVENT FAVORITES
-- -------------------------------------------------------------
CREATE TABLE public.event_favorites (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE public.event_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.event_favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_view_event(auth.uid(), event_id));

CREATE POLICY "Users can create own favorites"
  ON public.event_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_event(auth.uid(), event_id));

CREATE POLICY "Users can delete own favorites"
  ON public.event_favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- -------------------------------------------------------------
-- EMAIL INFRASTRUCTURE
-- -------------------------------------------------------------

-- Queues
DO $$ BEGIN PERFORM pgmq.create('auth_emails');          EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq');      EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Send log
CREATE TABLE public.email_send_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT,
  template_name   TEXT        NOT NULL,
  recipient_email TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('pending','sent','suppressed','failed','bounced','complained','dlq','rate_limited')),
  error_message   TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read send log"
  ON public.email_send_log FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role can insert send log"
  ON public.email_send_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can update send log"
  ON public.email_send_log FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_email_send_log_created   ON public.email_send_log (created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log (recipient_email);
CREATE INDEX idx_email_send_log_message   ON public.email_send_log (message_id);

-- Only one 'sent' row per message_id (race condition guard)
CREATE UNIQUE INDEX idx_email_send_log_message_sent_unique
  ON public.email_send_log (message_id) WHERE status = 'sent';

-- Rate-limit state / queue config (single row)
CREATE TABLE public.email_send_state (
  id                              INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until               TIMESTAMPTZ,
  batch_size                      INTEGER     NOT NULL DEFAULT 10,
  send_delay_ms                   INTEGER     NOT NULL DEFAULT 200,
  auth_email_ttl_minutes          INTEGER     NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER     NOT NULL DEFAULT 60,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage send state"
  ON public.email_send_state FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Suppressed emails (unsubscribes, bounces, complaints)
CREATE TABLE public.suppressed_emails (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL UNIQUE,
  reason     TEXT        NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint')),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read suppressed emails"
  ON public.suppressed_emails FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role can insert suppressed emails"
  ON public.suppressed_emails FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails (email);

-- Unsubscribe tokens
CREATE TABLE public.email_unsubscribe_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        NOT NULL UNIQUE,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at    TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read tokens"
  ON public.email_unsubscribe_tokens FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "Service role can insert tokens"
  ON public.email_unsubscribe_tokens FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role can mark tokens as used"
  ON public.email_unsubscribe_tokens FOR UPDATE
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens (token);

-- Queue RPC wrappers (PostgREST only exposes public schema functions)
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPCs to service_role only
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)        TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)  TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)        TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;


-- -------------------------------------------------------------
-- EMAIL QUEUE CRON JOB
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.setup_email_queue_cron()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url' LIMIT 1;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN 'skipped: vault secrets (supabase_project_url, email_queue_service_role_key) not set';
  END IF;

  BEGIN PERFORM cron.unschedule('process-email-queue'); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'process-email-queue',
    '5 seconds',
    $cron$
    SELECT net.http_post(
      url     => (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_project_url' LIMIT 1) || '/functions/v1/process-email-queue',
      body    => '{}'::jsonb,
      headers => jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
      )
    )
    $cron$
  );

  RETURN 'scheduled: process-email-queue (every 5 seconds)';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_email_queue_cron() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.setup_email_queue_cron() TO service_role;

SELECT public.setup_email_queue_cron();


-- -------------------------------------------------------------
-- STORAGE
-- -------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view event images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-images');


-- -------------------------------------------------------------
-- REALTIME
-- -------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

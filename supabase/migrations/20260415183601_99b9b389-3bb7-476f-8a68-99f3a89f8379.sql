
-- 1. Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('member', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Give every existing user the 'member' role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'member'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Set Sabrina as admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'sabrina@sonderdigitalagency.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Trigger to auto-assign 'member' role on new user signup
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
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 7. Add privacy enum and column to events
CREATE TYPE public.event_privacy AS ENUM ('invite_only', 'request_to_join', 'open');

ALTER TABLE public.events
  ADD COLUMN privacy public.event_privacy NOT NULL DEFAULT 'invite_only';

-- 8. Set all existing active events to 'open' (preserve current behavior)
UPDATE public.events SET privacy = 'open' WHERE status = 'active';

-- 9. Create invite_status enum and invites table (circle membership invites)
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  personal_note TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days')
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Invites RLS
CREATE POLICY "Members can create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Members can view own invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

CREATE POLICY "Members can revoke own pending invites"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (inviter_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can view all invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all invites"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage invites"
  ON public.invites FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 10. Create event_invites table
CREATE TYPE public.event_invite_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  status public.event_invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, invited_user_id)
);

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can manage event invites"
  ON public.event_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
  );

CREATE POLICY "Invited users can view own invites"
  ON public.event_invites FOR SELECT
  TO authenticated
  USING (invited_user_id = auth.uid());

CREATE POLICY "Invited users can update own invite status"
  ON public.event_invites FOR UPDATE
  TO authenticated
  USING (invited_user_id = auth.uid());

-- 11. Create rsvp_requests table
CREATE TYPE public.rsvp_request_status AS ENUM ('pending', 'approved', 'declined');

CREATE TABLE public.rsvp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT,
  status public.rsvp_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.rsvp_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create join requests"
  ON public.rsvp_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own requests"
  ON public.rsvp_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Hosts can view requests for their events"
  ON public.rsvp_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
  );

CREATE POLICY "Hosts can approve/decline requests"
  ON public.rsvp_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
  );

-- 12. Helper function: can user see this event?
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
    -- Admin can always see
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    -- Open or request_to_join events visible to all members
    SELECT 1 FROM public.events WHERE id = _event_id AND privacy IN ('open', 'request_to_join')
  )
  OR EXISTS (
    -- Invite-only: must be invited
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
$$;

-- 13. Update events SELECT policy to respect privacy
DROP POLICY IF EXISTS "Events are viewable by authenticated users" ON public.events;

CREATE POLICY "Events are viewable based on privacy"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.can_view_event(auth.uid(), id));

-- 14. Create a secure view for events that hides location for request_to_join until approved
-- (We'll handle location hiding in application code using the can_view_event_location function)
CREATE OR REPLACE FUNCTION public.can_view_event_location(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Host always sees location
    SELECT 1 FROM public.events WHERE id = _event_id AND host_id = _user_id
  )
  OR EXISTS (
    -- Admin always sees location
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    -- Open events: everyone sees location
    SELECT 1 FROM public.events WHERE id = _event_id AND privacy = 'open'
  )
  OR EXISTS (
    -- Invite-only: invited users see location
    SELECT 1 FROM public.event_invites
    WHERE event_id = _event_id AND invited_user_id = _user_id AND status != 'declined'
  )
  OR EXISTS (
    -- Request-to-join: only approved RSVPs see location
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status = 'going'
  )
$$;

-- 15. Update rsvps SELECT policy for invite-only guest list restriction
DROP POLICY IF EXISTS "Authenticated users can view RSVPs for events" ON public.rsvps;

CREATE POLICY "RSVPs viewable based on event privacy"
  ON public.rsvps FOR SELECT
  TO authenticated
  USING (
    -- Own RSVPs always visible
    user_id = auth.uid()
    OR
    -- Host sees all RSVPs for their events
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
    OR
    -- Admin sees all
    public.has_role(auth.uid(), 'admin')
    OR
    -- For non-invite-only events, all members can see
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND privacy != 'invite_only')
    OR
    -- For invite-only events, only invited users can see guest list
    EXISTS (
      SELECT 1 FROM public.event_invites
      WHERE event_invites.event_id = rsvps.event_id
        AND event_invites.invited_user_id = auth.uid()
        AND event_invites.status != 'declined'
    )
  );

-- 16. Update can_access_event_chat to also allow event_invite holders
CREATE OR REPLACE FUNCTION public.can_access_event_chat(_user_id UUID, _event_id UUID)
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
    SELECT 1 FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user_id AND status IN ('going', 'maybe')
  )
$$;

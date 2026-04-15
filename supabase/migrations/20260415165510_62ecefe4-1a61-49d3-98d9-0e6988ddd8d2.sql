
-- 1. Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_event_created ON public.messages (event_id, created_at);
CREATE INDEX idx_messages_reply_to ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: check if user can access event chat
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

CREATE POLICY "Chat participants can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.can_access_event_chat(auth.uid(), event_id));

CREATE POLICY "Chat participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_event_chat(auth.uid(), event_id)
  );

CREATE POLICY "Users can soft-delete own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Hosts can soft-delete any message in their event"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND host_id = auth.uid())
  );

-- 2. Message reads table
CREATE TABLE public.message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_message_reads_user ON public.message_reads (user_id, message_id);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read receipts"
  ON public.message_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark messages as read"
  ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Typing indicators (ephemeral)
CREATE TABLE public.typing_indicators (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- 4. Update event_photos with source + message_id
ALTER TABLE public.event_photos
  ADD COLUMN source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- 5. Notification preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  email_reminders BOOLEAN NOT NULL DEFAULT true,
  sms_reminders BOOLEAN NOT NULL DEFAULT true,
  host_announcements_email BOOLEAN NOT NULL DEFAULT true,
  host_announcements_sms BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Add phone fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN phone TEXT,
  ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false;

-- 7. Enable realtime on messages and typing_indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

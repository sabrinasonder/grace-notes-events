
-- Create event_favorites table
CREATE TABLE public.event_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- Enable RLS
ALTER TABLE public.event_favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites (and only for events they can view)
CREATE POLICY "Users can view own favorites"
ON public.event_favorites
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND public.can_view_event(auth.uid(), event_id));

-- Users can create favorites for themselves
CREATE POLICY "Users can create own favorites"
ON public.event_favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_view_event(auth.uid(), event_id));

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
ON public.event_favorites
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

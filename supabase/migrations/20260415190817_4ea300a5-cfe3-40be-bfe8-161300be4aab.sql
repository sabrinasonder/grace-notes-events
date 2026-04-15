
CREATE OR REPLACE FUNCTION public.approve_rsvp_request(
  _request_id uuid,
  _host_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _user_id uuid;
BEGIN
  -- Verify the request exists and belongs to an event hosted by this user
  SELECT rr.event_id, rr.user_id INTO _event_id, _user_id
  FROM public.rsvp_requests rr
  JOIN public.events e ON e.id = rr.event_id
  WHERE rr.id = _request_id
    AND rr.status = 'pending'
    AND e.host_id = _host_id;

  IF _event_id IS NULL THEN
    RETURN false;
  END IF;

  -- Update the request
  UPDATE public.rsvp_requests
  SET status = 'approved', decided_by = _host_id, decided_at = now()
  WHERE id = _request_id;

  -- Create the RSVP (upsert in case one exists)
  INSERT INTO public.rsvps (event_id, user_id, status, paid)
  VALUES (_event_id, _user_id, 'going', false)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'going';

  RETURN true;
END;
$$;

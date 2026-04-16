-- Add missing FK from rsvp_requests.user_id to profiles(id).
-- Without this, PostgREST cannot embed the profiles join in rsvp_requests queries.
ALTER TABLE public.rsvp_requests
  ADD CONSTRAINT rsvp_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

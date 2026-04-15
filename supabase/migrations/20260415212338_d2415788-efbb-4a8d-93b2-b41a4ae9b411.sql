
-- Backfill: create missing profiles for any existing users
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data ->> 'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill: create missing member roles for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'member'
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'member'
WHERE ur.id IS NULL;

-- membership_requests: tracks signups waiting for admin approval
-- An invite_code links a request back to the invitations row that generated it.
create table if not exists public.membership_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  invite_code text,                           -- nullable: direct signups have no code
  invited_by  uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'denied')),
  notes       text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique (user_id)
);

alter table public.membership_requests enable row level security;

-- User can read their own request
create policy "user can read own membership request"
  on public.membership_requests for select
  to authenticated
  using (user_id = auth.uid());

-- User can insert their own request (once — unique constraint enforces it)
create policy "user can insert own membership request"
  on public.membership_requests for insert
  to authenticated
  with check (user_id = auth.uid());

-- Admins can read all
create policy "admins can read all membership requests"
  on public.membership_requests for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Admins can update (approve / deny)
create policy "admins can update membership requests"
  on public.membership_requests for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

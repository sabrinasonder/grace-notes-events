create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_email text,
  invited_phone text,
  invited_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint at_least_one_contact check (invited_email is not null or invited_phone is not null)
);

alter table public.invitations enable row level security;

-- Members can insert their own invitations
create policy "members can insert own invitations"
  on public.invitations for insert
  to authenticated
  with check (invited_by = auth.uid());

-- Members can read their own invitations
create policy "members can read own invitations"
  on public.invitations for select
  to authenticated
  using (invited_by = auth.uid());

-- Admins can read all
create policy "admins can read all invitations"
  on public.invitations for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Calendar events created directly from the notifications calendar

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  color text,
  completed boolean not null default false,
  -- Audience: who should see / receive this event
  -- 'me'    -> only creator
  -- 'user'  -> specific target user
  -- 'role'  -> all users with a given role key in this tenant
  -- 'tenant'-> all members of the tenant
  audience_type text not null default 'me',
  target_user_id uuid references auth.users(id) on delete set null,
  target_role_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

-- Any member of the tenant can read calendar events for that tenant.
-- Audience filtering is handled in application logic when querying.
drop policy if exists "read calendar_events in tenant" on public.calendar_events;
create policy "read calendar_events in tenant" on public.calendar_events
  for select using (public.is_member_of(tenant_id));

-- Only members of the tenant can insert events for that tenant
drop policy if exists "insert calendar_events in tenant" on public.calendar_events;
create policy "insert calendar_events in tenant" on public.calendar_events
  for insert with check (public.is_member_of(tenant_id));



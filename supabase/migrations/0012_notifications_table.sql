-- Notifications table to store per-user notifications
-- Includes optional tenant scoping, flexible payload, and RLS

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    tenant_id uuid references public.tenants(id) on delete cascade,
    title text not null,
    body text,
    type text not null default 'info',
    action_url text,
    data jsonb not null default '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
    on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_id_unread_idx
    on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

-- Policies: users can only access their own notifications
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
    for select using (user_id = auth.uid());

drop policy if exists "insert own notifications" on public.notifications;
create policy "insert own notifications" on public.notifications
    for insert with check (user_id = auth.uid());

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
    for update using (user_id = auth.uid());

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
    for delete using (user_id = auth.uid());



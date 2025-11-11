-- Migration: Generalize notifications to scheduled_events
-- This creates a flexible event/appointment scheduler that can handle
-- various event types beyond just notifications

-- Create the scheduled_events table
create table if not exists public.scheduled_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null,                    -- e.g., 'NOTIFICATION', 'APPOINTMENT', 'REMINDER', 'MEETING'
    title text not null,
    description text,
    metadata jsonb not null default '{}'::jsonb, -- flexible storage for event-specific data
    scheduled_at timestamptz not null,           -- when the event should be delivered/triggered
    delivered_at timestamptz,                    -- when it was actually delivered (null = pending)
    status text not null default 'pending',      -- 'pending' | 'delivered' | 'cancelled'

    -- Notification-specific fields (for backward compatibility)
    notification_type text,                      -- 'info' | 'success' | 'warning' | 'reminder'
    action_url text,
    read_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create indexes for efficient querying
create index if not exists scheduled_events_user_id_idx
    on public.scheduled_events(user_id, scheduled_at desc);

create index if not exists scheduled_events_tenant_id_idx
    on public.scheduled_events(tenant_id, scheduled_at desc);

create index if not exists scheduled_events_status_scheduled_idx
    on public.scheduled_events(status, scheduled_at)
    where status = 'pending';

create index if not exists scheduled_events_event_type_idx
    on public.scheduled_events(event_type, scheduled_at desc);

create index if not exists scheduled_events_delivered_at_idx
    on public.scheduled_events(delivered_at desc)
    where delivered_at is not null;

-- Enable RLS
alter table public.scheduled_events enable row level security;

-- RLS Policies
-- Users can view their own events
create policy "Users can view their own scheduled events"
    on public.scheduled_events
    for select
    using (auth.uid() = user_id);

-- Users can insert their own events
create policy "Users can insert their own scheduled events"
    on public.scheduled_events
    for insert
    with check (auth.uid() = user_id);

-- Users can update their own events (e.g., mark as read, cancel)
create policy "Users can update their own scheduled events"
    on public.scheduled_events
    for update
    using (auth.uid() = user_id);

-- Users can delete their own events
create policy "Users can delete their own scheduled events"
    on public.scheduled_events
    for delete
    using (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
create policy "Service role has full access to scheduled events"
    on public.scheduled_events
    for all
    using (auth.jwt()->>'role' = 'service_role');

-- Create updated_at trigger
create or replace function public.handle_scheduled_events_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger scheduled_events_updated_at
    before update on public.scheduled_events
    for each row
    execute function public.handle_scheduled_events_updated_at();

-- Migrate existing notifications to scheduled_events
-- Map old notifications to new event model
insert into public.scheduled_events (
    id,
    user_id,
    tenant_id,
    event_type,
    title,
    description,
    metadata,
    scheduled_at,
    delivered_at,
    status,
    notification_type,
    action_url,
    read_at,
    created_at
)
select
    id,
    user_id,
    tenant_id,
    'NOTIFICATION' as event_type,  -- all existing notifications become type 'NOTIFICATION'
    title,
    body as description,
    data as metadata,
    created_at as scheduled_at,    -- old notifications were delivered immediately
    created_at as delivered_at,    -- they were delivered when created
    'delivered' as status,         -- all existing notifications are delivered
    type as notification_type,
    action_url,
    read_at,
    created_at
from public.notifications
on conflict (id) do nothing;

-- Add comment explaining the table
comment on table public.scheduled_events is
    'Generic event scheduler for notifications, appointments, reminders, and custom events. Replaces the notifications table with a more flexible design.';

comment on column public.scheduled_events.event_type is
    'Type of event: NOTIFICATION, APPOINTMENT, REMINDER, MEETING, CUSTOM, etc.';

comment on column public.scheduled_events.metadata is
    'Flexible JSON storage for event-specific data like obra_id, document_id, location, attendees, etc.';

comment on column public.scheduled_events.status is
    'Event status: pending (not yet delivered), delivered (successfully delivered), cancelled (user cancelled)';

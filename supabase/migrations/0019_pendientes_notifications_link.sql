-- Link notifications to pendientes and add pending tasks scheduling primitives

-- Extend notifications with pendiente_id
alter table public.notifications
  add column if not exists pendiente_id uuid references public.obra_pendientes(id) on delete cascade;

-- Dedupe notifications per (user, pendiente, type, stage)
create index if not exists notifications_pendiente_stage_idx
  on public.notifications (user_id, pendiente_id, type);

-- Unique per stage (uses jsonb field 'stage' inside data)
do $$ begin
  perform 1 from pg_indexes where schemaname='public' and indexname='notifications_unique_task_stage';
  if not found then
    execute 'create unique index notifications_unique_task_stage on public.notifications (user_id, pendiente_id, type, (coalesce((data->>''stage'')::text, ''''))) where pendiente_id is not null';
  end if;
end $$;

-- Pendiente state enum
do $$ begin
  create type public.pendiente_state as enum ('pending','due_soon','due_today','overdue','done');
exception when duplicate_object then null; end $$;

-- Add richer fields to obra_pendientes
alter table public.obra_pendientes
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists state public.pendiente_state not null default 'pending';

-- Schedules table for task reminders
create table if not exists public.pendiente_schedules (
  id uuid primary key default gen_random_uuid(),
  pendiente_id uuid not null references public.obra_pendientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  run_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pendiente_id, stage)
);











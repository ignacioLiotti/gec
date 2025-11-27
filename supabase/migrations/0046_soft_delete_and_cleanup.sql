-- Soft delete columns on critical tables

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'obras' and column_name = 'deleted_at'
  ) then
    alter table public.obras
      add column deleted_at timestamptz,
      add column deleted_by uuid references auth.users(id);
    create index if not exists obras_active_idx
      on public.obras(tenant_id, deleted_at);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'certificates' and column_name = 'deleted_at'
  ) then
    alter table public.certificates
      add column deleted_at timestamptz,
      add column deleted_by uuid references auth.users(id);
    create index if not exists certificates_active_idx
      on public.certificates(tenant_id, deleted_at);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'obra_pendientes' and column_name = 'deleted_at'
  ) then
    alter table public.obra_pendientes
      add column deleted_at timestamptz,
      add column deleted_by uuid references auth.users(id);
    create index if not exists obra_pendientes_active_idx
      on public.obra_pendientes(tenant_id, deleted_at);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'calendar_events' and column_name = 'deleted_at'
  ) then
    alter table public.calendar_events
      add column deleted_at timestamptz,
      add column deleted_by uuid references auth.users(id);
    create index if not exists calendar_events_active_idx
      on public.calendar_events(tenant_id, deleted_at);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'pendiente_schedules' and column_name = 'deleted_at'
  ) then
    alter table public.pendiente_schedules
      add column deleted_at timestamptz,
      add column deleted_by uuid references auth.users(id);
    create index if not exists pendiente_schedules_active_idx
      on public.pendiente_schedules(pendiente_id, deleted_at);
  end if;
end $$;

-- Shared trigger to convert deletes into soft deletes
create or replace function public.soft_delete_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'DELETE' then
    execute format(
      'update %I.%I set deleted_at = now(), deleted_by = $2 where ctid = $1',
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME
    )
    using old.ctid, auth.uid();
    return null;
  end if;
  return null;
end;
$$;

-- Attach triggers
drop trigger if exists obras_soft_delete on public.obras;
create trigger obras_soft_delete
  before delete on public.obras
  for each row
  execute function public.soft_delete_row();

drop trigger if exists certificates_soft_delete on public.certificates;
create trigger certificates_soft_delete
  before delete on public.certificates
  for each row
  execute function public.soft_delete_row();

drop trigger if exists obra_pendientes_soft_delete on public.obra_pendientes;
create trigger obra_pendientes_soft_delete
  before delete on public.obra_pendientes
  for each row
  execute function public.soft_delete_row();

drop trigger if exists calendar_events_soft_delete on public.calendar_events;
create trigger calendar_events_soft_delete
  before delete on public.calendar_events
  for each row
  execute function public.soft_delete_row();

drop trigger if exists pendiente_schedules_soft_delete on public.pendiente_schedules;
create trigger pendiente_schedules_soft_delete
  before delete on public.pendiente_schedules
  for each row
  execute function public.soft_delete_row();

-- Cleanup function to retire orphan records
drop function if exists public.cleanup_orphan_records();
create or replace function public.cleanup_orphan_records()
returns table(entity text, affected integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  now_ts timestamptz := now();
begin
  return query
    with updated as (
      update public.certificates c
      set deleted_at = now_ts
      where c.deleted_at is null
        and not exists (
          select 1 from public.obras o
          where o.id = c.obra_id and o.deleted_at is null
        )
      returning 1
    )
    select 'certificates_missing_obras'::text, count(*) from updated;

  return query
    with updated as (
      update public.obra_pendientes op
      set deleted_at = now_ts
      where op.deleted_at is null
        and not exists (
          select 1 from public.obras o
          where o.id = op.obra_id and o.deleted_at is null
        )
      returning 1
    )
    select 'pendientes_missing_obras'::text, count(*) from updated;

  return query
    with updated as (
      update public.pendiente_schedules ps
      set deleted_at = now_ts
      where ps.deleted_at is null
        and not exists (
          select 1 from public.obra_pendientes op
          where op.id = ps.pendiente_id and op.deleted_at is null
        )
      returning 1
    )
    select 'schedules_missing_pendientes'::text, count(*) from updated;

  return query
    with updated as (
      update public.calendar_events ce
      set deleted_at = now_ts
      where ce.deleted_at is null
        and ce.obra_id is not null
        and not exists (
          select 1 from public.obras o
          where o.id = ce.obra_id and o.deleted_at is null
        )
      returning 1
    )
    select 'calendar_events_missing_obras'::text, count(*) from updated;
end;
$$;

revoke all on function public.cleanup_orphan_records() from public;
grant execute on function public.cleanup_orphan_records() to service_role;

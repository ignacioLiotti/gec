-- Table to store pendientes (pending documents/tasks) per obra
create table if not exists public.obra_pendientes (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    obra_id uuid not null references public.obras(id) on delete cascade,
    name text not null,
    poliza text,
    due_mode text not null default 'fixed' check (due_mode in ('fixed','after_completion')),
    due_date date,
    offset_days integer,
    done boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists obra_pendientes_tenant_idx on public.obra_pendientes(tenant_id);
create index if not exists obra_pendientes_obra_idx on public.obra_pendientes(obra_id);

create or replace function public.set_obra_pendientes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists obra_pendientes_set_updated_at on public.obra_pendientes;
create trigger obra_pendientes_set_updated_at
before update on public.obra_pendientes
for each row
execute function public.set_obra_pendientes_updated_at();

alter table public.obra_pendientes enable row level security;

drop policy if exists "obra_pendientes read in tenant" on public.obra_pendientes;
create policy "obra_pendientes read in tenant" on public.obra_pendientes
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_pendientes insert in tenant" on public.obra_pendientes;
create policy "obra_pendientes insert in tenant" on public.obra_pendientes
  for insert with check (public.is_member_of(tenant_id));

drop policy if exists "obra_pendientes update in tenant" on public.obra_pendientes;
create policy "obra_pendientes update in tenant" on public.obra_pendientes
  for update using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

drop policy if exists "obra_pendientes delete in tenant" on public.obra_pendientes;
create policy "obra_pendientes delete in tenant" on public.obra_pendientes
  for delete using (public.is_member_of(tenant_id));












-- Configuración de columnas de la tabla principal de Excel por tenant

create table if not exists public.tenant_main_table_configs (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  columns jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_main_table_configs_updated_at_idx
  on public.tenant_main_table_configs(updated_at desc);

create or replace function public.set_tenant_main_table_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_main_table_configs_set_updated_at on public.tenant_main_table_configs;
create trigger tenant_main_table_configs_set_updated_at
before update on public.tenant_main_table_configs
for each row
execute function public.set_tenant_main_table_configs_updated_at();

alter table public.tenant_main_table_configs enable row level security;

drop policy if exists "read main table configs in tenant" on public.tenant_main_table_configs;
create policy "read main table configs in tenant"
  on public.tenant_main_table_configs
  for select
  using (public.is_member_of(tenant_id));

drop policy if exists "insert main table configs in tenant as admin" on public.tenant_main_table_configs;
create policy "insert main table configs in tenant as admin"
  on public.tenant_main_table_configs
  for insert
  with check (public.is_admin_of(tenant_id));

drop policy if exists "update main table configs in tenant as admin" on public.tenant_main_table_configs;
create policy "update main table configs in tenant as admin"
  on public.tenant_main_table_configs
  for update
  using (public.is_admin_of(tenant_id))
  with check (public.is_admin_of(tenant_id));

drop policy if exists "delete main table configs in tenant as admin" on public.tenant_main_table_configs;
create policy "delete main table configs in tenant as admin"
  on public.tenant_main_table_configs
  for delete
  using (public.is_admin_of(tenant_id));

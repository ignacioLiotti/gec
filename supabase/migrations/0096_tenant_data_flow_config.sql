-- Tenant-level data-flow config applied to every obra in the tenant.

create table if not exists public.tenant_data_flow_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.tenant_data_flow_config enable row level security;

drop policy if exists "tenant_data_flow_config read in tenant" on public.tenant_data_flow_config;
create policy "tenant_data_flow_config read in tenant" on public.tenant_data_flow_config
  for select using (public.is_member_of(tenant_id));

drop policy if exists "tenant_data_flow_config insert by tenant admins" on public.tenant_data_flow_config;
create policy "tenant_data_flow_config insert by tenant admins" on public.tenant_data_flow_config
  for insert with check (public.is_admin_of(tenant_id));

drop policy if exists "tenant_data_flow_config update by tenant admins" on public.tenant_data_flow_config;
create policy "tenant_data_flow_config update by tenant admins" on public.tenant_data_flow_config
  for update using (public.is_admin_of(tenant_id)) with check (public.is_admin_of(tenant_id));

drop policy if exists "tenant_data_flow_config delete by tenant admins" on public.tenant_data_flow_config;
create policy "tenant_data_flow_config delete by tenant admins" on public.tenant_data_flow_config
  for delete using (public.is_admin_of(tenant_id));

drop trigger if exists tenant_data_flow_config_set_updated_at on public.tenant_data_flow_config;
create trigger tenant_data_flow_config_set_updated_at
  before update on public.tenant_data_flow_config
  for each row
  execute function update_timestamp();

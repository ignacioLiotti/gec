-- Tenant-level default reporting config (used as fallback for obras without override)

create table if not exists public.tenant_reporting_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.tenant_reporting_config enable row level security;

drop policy if exists "tenant_reporting_config read in tenant" on public.tenant_reporting_config;
create policy "tenant_reporting_config read in tenant" on public.tenant_reporting_config
  for select using (public.is_member_of(tenant_id));

drop policy if exists "tenant_reporting_config write in tenant" on public.tenant_reporting_config;
create policy "tenant_reporting_config write in tenant" on public.tenant_reporting_config
  for all using (public.is_admin_of(tenant_id)) with check (public.is_admin_of(tenant_id));

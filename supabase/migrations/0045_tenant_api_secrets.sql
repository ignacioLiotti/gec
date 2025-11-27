-- Tenant-scoped API secrets for request signing

create table if not exists public.tenant_api_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version int not null,
  secret text not null,
  status text not null default 'active' check (status in ('pending','active','grace','revoked')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create unique index if not exists tenant_api_secrets_tenant_version_idx
  on public.tenant_api_secrets(tenant_id, version);

create index if not exists tenant_api_secrets_status_idx
  on public.tenant_api_secrets(tenant_id, status);

alter table public.tenant_api_secrets enable row level security;

drop policy if exists "tenant api secrets select" on public.tenant_api_secrets;
create policy "tenant api secrets select"
  on public.tenant_api_secrets
  for select
  using (public.is_admin_of(tenant_id));

drop policy if exists "tenant api secrets insert" on public.tenant_api_secrets;
create policy "tenant api secrets insert"
  on public.tenant_api_secrets
  for insert
  with check (public.is_admin_of(tenant_id));

drop policy if exists "tenant api secrets update" on public.tenant_api_secrets;
create policy "tenant api secrets update"
  on public.tenant_api_secrets
  for update
  using (public.is_admin_of(tenant_id));

drop policy if exists "tenant api secrets delete" on public.tenant_api_secrets;
create policy "tenant api secrets delete"
  on public.tenant_api_secrets
  for delete
  using (public.is_admin_of(tenant_id));

-- Helper to fetch the active (or grace) secret for signature verification
drop function if exists public.get_active_tenant_secret(uuid, int);
create or replace function public.get_active_tenant_secret(p_tenant_id uuid, p_version int default null)
returns table(version int, secret text, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select tas.version, tas.secret, tas.status
    from public.tenant_api_secrets tas
    where tas.tenant_id = p_tenant_id
      and (p_version is null or tas.version = p_version)
      and tas.status in ('active', 'grace')
    order by tas.version desc
    limit 1;
end;
$$;

revoke all on function public.get_active_tenant_secret(uuid, int) from public;
grant execute on function public.get_active_tenant_secret(uuid, int) to service_role;

-- Rotation helper inserts the next version and transitions the current secret into grace period
drop function if exists public.rotate_tenant_api_secret(uuid, text, interval);
create or replace function public.rotate_tenant_api_secret(
  p_tenant_id uuid,
  p_new_secret text default encode(gen_random_bytes(32), 'hex'),
  p_grace_period interval default interval '7 days'
)
returns public.tenant_api_secrets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_version int;
  rotated public.tenant_api_secrets;
begin
  select coalesce(max(version), 0) + 1 into next_version
  from public.tenant_api_secrets
  where tenant_id = p_tenant_id;

  update public.tenant_api_secrets
  set status = 'grace',
      rotated_at = now(),
      valid_to = now() + p_grace_period
  where tenant_id = p_tenant_id
    and status = 'active';

  insert into public.tenant_api_secrets (tenant_id, version, secret, status, valid_from)
  values (p_tenant_id, next_version, p_new_secret, 'active', now())
  returning * into rotated;

  return rotated;
end;
$$;

revoke all on function public.rotate_tenant_api_secret(uuid, text, interval) from public;
grant execute on function public.rotate_tenant_api_secret(uuid, text, interval) to service_role;

-- Roles & Permissions schema with helper functions and RLS

-- Tables
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint unique_role_per_tenant unique (tenant_id, key)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  is_granted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

-- Helper: is_admin_of(tenant)
create or replace function public.is_admin_of(tenant uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = tenant and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

-- Helper: has_permission(tenant, perm_key)
create or replace function public.has_permission(tenant uuid, perm_key text)
returns boolean language sql stable as $$
  -- Owner/Admin of tenant have all permissions
  select
    coalesce(
      (
        select true where public.is_admin_of(tenant)
      )
      or (
        -- Direct user permission grant
        exists (
          select 1
          from public.user_permission_overrides upo
          join public.permissions p on p.id = upo.permission_id
          where upo.user_id = auth.uid() and upo.is_granted = true and p.key = perm_key
        )
      )
      or (
        -- Through any role assigned to user, scoped to this tenant
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions p on p.id = rp.permission_id
          where ur.user_id = auth.uid()
            and (r.tenant_id = tenant)
            and p.key = perm_key
        )
      )
    , false);
$$;

-- Enable RLS
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;

-- Policies
-- permissions: readable by authenticated users; mutable only by server/DBA (no public mutations)
drop policy if exists "read permissions" on public.permissions;
create policy "read permissions" on public.permissions for select using (true);

-- roles: visible if role is for a tenant the user is member of; admins can manage
drop policy if exists "read roles in tenant" on public.roles;
create policy "read roles in tenant" on public.roles for select using (
  tenant_id is not null and public.is_member_of(tenant_id)
);

drop policy if exists "manage roles in tenant" on public.roles;
create policy "manage roles in tenant" on public.roles
  for all using (public.is_admin_of(tenant_id)) with check (public.is_admin_of(tenant_id));

-- role_permissions: admins manage
drop policy if exists "read role_permissions in tenant" on public.role_permissions;
create policy "read role_permissions in tenant" on public.role_permissions for select using (
  exists (select 1 from public.roles r where r.id = role_permissions.role_id and public.is_member_of(r.tenant_id))
);

drop policy if exists "manage role_permissions in tenant" on public.role_permissions;
create policy "manage role_permissions in tenant" on public.role_permissions
  for all using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and public.is_admin_of(r.tenant_id))
  ) with check (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and public.is_admin_of(r.tenant_id))
  );

-- user_roles: admins manage assignments within their tenant
drop policy if exists "read user_roles in tenant" on public.user_roles;
create policy "read user_roles in tenant" on public.user_roles for select using (
  exists (
    select 1 from public.roles r
    join public.memberships m on m.user_id = auth.uid() and m.tenant_id = r.tenant_id
    where r.id = user_roles.role_id
  )
);

drop policy if exists "manage user_roles in tenant" on public.user_roles;
create policy "manage user_roles in tenant" on public.user_roles
  for all using (
    exists (select 1 from public.roles r where r.id = user_roles.role_id and public.is_admin_of(r.tenant_id))
  ) with check (
    exists (select 1 from public.roles r where r.id = user_roles.role_id and public.is_admin_of(r.tenant_id))
  );

-- user_permission_overrides: admins manage overrides for users in their tenant
drop policy if exists "read overrides" on public.user_permission_overrides;
create policy "read overrides" on public.user_permission_overrides for select using (
  true
);

drop policy if exists "manage overrides in tenant" on public.user_permission_overrides;
create policy "manage overrides in tenant" on public.user_permission_overrides
  for all using (
    exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid() and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid() and m.role in ('owner','admin')
    )
  );

-- Example permissions (optional defaults)
insert into public.permissions (key, description)
  values
    ('instruments:read', 'Read instruments'),
    ('instruments:write', 'Create/update/delete instruments'),
    ('admin:roles', 'Manage roles and permissions')
on conflict (key) do nothing;



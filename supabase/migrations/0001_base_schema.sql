-- Base schema: tenants, profiles, memberships, instruments with RLS

-- Extensions (enabled by default on Supabase, guarded here)
create extension if not exists pgcrypto;

-- Tenants
create table if not exists public.tenants (
	id uuid primary key default gen_random_uuid(),
	name text not null unique,
	created_at timestamptz not null default now()
);

-- Profiles (1-1 with auth.users)
create table if not exists public.profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	full_name text,
	created_at timestamptz not null default now()
);

-- Memberships (user belongs to tenant with a role)
do $$ begin
	create type public.membership_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.memberships (
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	role public.membership_role not null default 'member',
	created_at timestamptz not null default now(),
	primary key (tenant_id, user_id)
);

-- Instruments (scoped to tenant)
create table if not exists public.instruments (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	name text not null,
	created_at timestamptz not null default now()
);

create index if not exists instruments_tenant_id_idx on public.instruments(tenant_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.tenants enable row level security;
alter table public.instruments enable row level security;

-- Helper: simple “is member of tenant” check
create or replace function public.is_member_of(tenant uuid)
returns boolean language sql stable as $$
	select exists (
		select 1
		from public.memberships m
		where m.tenant_id = tenant and m.user_id = auth.uid()
	);
$$;

-- Policies
-- Profiles: a user can read/update only their own profile
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
	for select using (user_id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
	for update using (user_id = auth.uid());

-- Tenants: visible to members only
drop policy if exists "read member tenants" on public.tenants;
create policy "read member tenants" on public.tenants
	for select using (public.is_member_of(id));

-- Memberships: users can read their memberships
drop policy if exists "read own memberships" on public.memberships;
create policy "read own memberships" on public.memberships
	for select using (user_id = auth.uid());

-- Instruments: members can read; insert/update only within their tenant
drop policy if exists "read instruments in tenant" on public.instruments;
create policy "read instruments in tenant" on public.instruments
	for select using (public.is_member_of(tenant_id));

drop policy if exists "insert instruments in tenant" on public.instruments;
create policy "insert instruments in tenant" on public.instruments
	for insert with check (public.is_member_of(tenant_id));

drop policy if exists "update instruments in tenant" on public.instruments;
create policy "update instruments in tenant" on public.instruments
	for update using (public.is_member_of(tenant_id));

drop policy if exists "delete instruments in tenant" on public.instruments;
create policy "delete instruments in tenant" on public.instruments
	for delete using (public.is_member_of(tenant_id));




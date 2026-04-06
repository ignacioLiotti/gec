alter table public.tenants
	add column if not exists demo_slug text;

alter table public.tenants
	add column if not exists demo_settings jsonb not null default '{}'::jsonb;

create unique index if not exists tenants_demo_slug_idx
	on public.tenants (demo_slug)
	where demo_slug is not null;

create table if not exists public.tenant_demo_links (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	slug text not null unique,
	label text,
	token_hash text not null,
	allowed_capabilities jsonb not null default '[]'::jsonb,
	expires_at timestamptz,
	last_seen_at timestamptz,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	revoked_at timestamptz
);

create index if not exists tenant_demo_links_tenant_id_idx
	on public.tenant_demo_links (tenant_id);

create index if not exists tenant_demo_links_active_idx
	on public.tenant_demo_links (slug, expires_at, revoked_at);

alter table public.tenant_demo_links enable row level security;

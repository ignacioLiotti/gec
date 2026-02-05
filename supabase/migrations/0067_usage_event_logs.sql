-- Track every usage adjustment (AI tokens, storage bytes, WhatsApp messages)

create table if not exists public.tenant_usage_events (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	kind text not null check (kind in ('storage_bytes', 'ai_tokens', 'whatsapp_messages')),
	amount bigint not null,
	context text,
	metadata jsonb default '{}'::jsonb,
	created_at timestamptz not null default now()
);

create index if not exists tenant_usage_events_tenant_idx
	on public.tenant_usage_events (tenant_id, created_at desc);

alter table public.tenant_usage_events enable row level security;

drop policy if exists "Members read usage events" on public.tenant_usage_events;
create policy "Members read usage events" on public.tenant_usage_events
	for select using (public.is_member_of(tenant_id));

drop policy if exists "Members insert usage events" on public.tenant_usage_events;
create policy "Members insert usage events" on public.tenant_usage_events
	for insert with check (public.is_member_of(tenant_id));

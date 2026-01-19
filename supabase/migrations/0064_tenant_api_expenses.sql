-- Track API-related expenses/usage per tenant so admins can monitor consumption

create table if not exists public.tenant_api_expenses (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants(id) on delete cascade,
	billing_period_start date not null,
	billing_period_end date not null,
	supabase_storage_bytes bigint not null default 0,
	supabase_storage_limit_bytes bigint not null default 0,
	ai_tokens_used bigint not null default 0,
	ai_token_budget bigint not null default 0,
	whatsapp_api_messages bigint not null default 0,
	whatsapp_api_budget bigint not null default 0,
	currency text not null default 'USD',
	notes text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint tenant_api_expenses_period_check
		check (billing_period_end >= billing_period_start)
);

comment on table public.tenant_api_expenses is
	'Monthly/periodic usage snapshot for Supabase storage, AI tokens, and WhatsApp API calls per tenant.';

create unique index if not exists tenant_api_expenses_period_idx
	on public.tenant_api_expenses (tenant_id, billing_period_start, billing_period_end);

create index if not exists tenant_api_expenses_tenant_idx
	on public.tenant_api_expenses (tenant_id);

alter table public.tenant_api_expenses enable row level security;

drop policy if exists "Admins read tenant api expenses" on public.tenant_api_expenses;
create policy "Admins read tenant api expenses" on public.tenant_api_expenses
	for select using (public.is_admin_of(tenant_id));

drop policy if exists "Admins insert tenant api expenses" on public.tenant_api_expenses;
create policy "Admins insert tenant api expenses" on public.tenant_api_expenses
	for insert with check (public.is_admin_of(tenant_id));

drop policy if exists "Admins update tenant api expenses" on public.tenant_api_expenses;
create policy "Admins update tenant api expenses" on public.tenant_api_expenses
	for update using (public.is_admin_of(tenant_id))
	with check (public.is_admin_of(tenant_id));

drop policy if exists "Admins delete tenant api expenses" on public.tenant_api_expenses;
create policy "Admins delete tenant api expenses" on public.tenant_api_expenses
	for delete using (public.is_admin_of(tenant_id));

drop trigger if exists tenant_api_expenses_set_updated_at on public.tenant_api_expenses;
create trigger tenant_api_expenses_set_updated_at
	before update on public.tenant_api_expenses
	for each row
	execute function update_timestamp();

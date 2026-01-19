-- Subscription plan scaffolding so each tenant can have defined usage limits.

create table if not exists public.subscription_plans (
	plan_key text primary key,
	name text not null,
	description text,
	storage_limit_bytes bigint,
	ai_token_budget bigint,
	whatsapp_message_budget bigint,
	metadata jsonb default '{}'::jsonb,
	created_at timestamptz not null default now()
);

insert into public.subscription_plans (
	plan_key,
	name,
	description,
	storage_limit_bytes,
	ai_token_budget,
	whatsapp_message_budget
)
values
	(
		'starter',
		'Starter',
		'Plan base para equipos en pilotos.',
		null,
		null,
		null
	),
	(
		'growth',
		'Growth',
		'Plan recomendado para organizaciones activas.',
		null,
		null,
		null
	)
on conflict (plan_key) do nothing;

create table if not exists public.tenant_subscriptions (
	tenant_id uuid primary key references public.tenants(id) on delete cascade,
	plan_key text not null references public.subscription_plans(plan_key),
	status text not null default 'active',
	current_period_start timestamptz default timezone('utc', now()),
	current_period_end timestamptz,
	external_customer_id text,
	external_subscription_id text,
	metadata jsonb default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger tenant_subscriptions_updated_at
	before update on public.tenant_subscriptions
	for each row
	execute function update_timestamp();

insert into public.tenant_subscriptions (tenant_id, plan_key)
select id, 'starter' from public.tenants
on conflict (tenant_id) do nothing;

alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;

drop policy if exists "Public read subscription plans" on public.subscription_plans;
create policy "Public read subscription plans" on public.subscription_plans
	for select using (true);

drop policy if exists "Members read tenant subscriptions" on public.tenant_subscriptions;
create policy "Members read tenant subscriptions" on public.tenant_subscriptions
	for select using (public.is_member_of(tenant_id));

drop policy if exists "Superadmin manage tenant subscriptions" on public.tenant_subscriptions;
create policy "Superadmin manage tenant subscriptions" on public.tenant_subscriptions
	for all
	using (public.is_superadmin())
	with check (public.is_superadmin());

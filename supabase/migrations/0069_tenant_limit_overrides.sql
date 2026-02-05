-- Allow per-tenant usage limit overrides

alter table if exists public.tenant_subscriptions
	add column if not exists storage_limit_bytes_override bigint,
	add column if not exists ai_token_budget_override bigint,
	add column if not exists whatsapp_message_budget_override bigint,
	add column if not exists plan_key text default 'starter'::text;

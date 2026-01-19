-- Temporarily remove plan limits until billing tiers are wired

alter table if exists public.subscription_plans
	alter column storage_limit_bytes drop not null,
	alter column ai_token_budget drop not null,
	alter column whatsapp_message_budget drop not null;

update public.subscription_plans
set storage_limit_bytes = null,
	ai_token_budget = null,
	whatsapp_message_budget = null;

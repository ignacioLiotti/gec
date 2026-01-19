-- Helper to atomically increment API/storage usage per tenant with limit enforcement.

create or replace function public.increment_tenant_api_usage(
	p_tenant uuid,
	p_storage_delta bigint default 0,
	p_ai_tokens_delta bigint default 0,
	p_whatsapp_delta bigint default 0,
	p_storage_limit bigint default null,
	p_ai_token_limit bigint default null,
	p_whatsapp_limit bigint default null
)
returns public.tenant_api_expenses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
	v_period_start date := date_trunc('month', timezone('utc', now()))::date;
	v_period_end date := (v_period_start + interval '1 month')::date - 1;
	v_storage_delta bigint := coalesce(p_storage_delta, 0);
	v_ai_delta bigint := coalesce(p_ai_tokens_delta, 0);
	v_whatsapp_delta bigint := coalesce(p_whatsapp_delta, 0);
	v_result tenant_api_expenses%rowtype;
begin
	if not public.is_member_of(p_tenant) then
		raise exception 'insufficient_privilege' using hint = 'Solo miembros de la organización pueden actualizar sus gastos.';
	end if;

	insert into public.tenant_api_expenses (
		tenant_id,
		billing_period_start,
		billing_period_end,
		supabase_storage_bytes,
		supabase_storage_limit_bytes,
		ai_tokens_used,
		ai_token_budget,
		whatsapp_api_messages,
		whatsapp_api_budget
	)
	values (
		p_tenant,
		v_period_start,
		v_period_end,
		greatest(0, v_storage_delta),
		coalesce(p_storage_limit, 0),
		greatest(0, v_ai_delta),
		coalesce(p_ai_token_limit, 0),
		greatest(0, v_whatsapp_delta),
		coalesce(p_whatsapp_limit, 0)
	)
	on conflict (tenant_id, billing_period_start, billing_period_end)
	do update set
		supabase_storage_bytes = greatest(
			0,
			public.tenant_api_expenses.supabase_storage_bytes + v_storage_delta
		),
		supabase_storage_limit_bytes = coalesce(
			p_storage_limit,
			public.tenant_api_expenses.supabase_storage_limit_bytes,
			0
		),
		ai_tokens_used = greatest(
			0,
			public.tenant_api_expenses.ai_tokens_used + v_ai_delta
		),
		ai_token_budget = coalesce(
			p_ai_token_limit,
			public.tenant_api_expenses.ai_token_budget,
			0
		),
		whatsapp_api_messages = greatest(
			0,
			public.tenant_api_expenses.whatsapp_api_messages + v_whatsapp_delta
		),
		whatsapp_api_budget = coalesce(
			p_whatsapp_limit,
			public.tenant_api_expenses.whatsapp_api_budget,
			0
		)
	returning * into v_result;

	if p_storage_limit is not null and v_result.supabase_storage_bytes > p_storage_limit then
		raise exception 'storage_limit_exceeded'
			using hint = 'Superaste el límite de almacenamiento del plan.';
	end if;

	if p_ai_token_limit is not null and v_result.ai_tokens_used > p_ai_token_limit then
		raise exception 'ai_limit_exceeded'
			using hint = 'Superaste el límite de tokens de IA del plan.';
	end if;

	if p_whatsapp_limit is not null and v_result.whatsapp_api_messages > p_whatsapp_limit then
		raise exception 'whatsapp_limit_exceeded'
			using hint = 'Superaste el límite de WhatsApp API del plan.';
	end if;

	return v_result;
end;
$$;

grant execute on function public.increment_tenant_api_usage(uuid, bigint, bigint, bigint, bigint, bigint, bigint)
	to authenticated, service_role;

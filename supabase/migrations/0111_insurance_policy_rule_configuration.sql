alter table public.insurance_policies
  add column if not exists cancellation_rule_configured boolean not null default false;

update public.insurance_policies
set calculated_cancellation_date = null
where cancellation_rule_configured = false;

notify pgrst, 'reload schema';

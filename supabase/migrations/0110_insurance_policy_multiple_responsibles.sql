-- Allow multiple tenant users to be responsible for insurance policy follow-up.

alter table public.insurance_policy_settings
  add column if not exists responsible_user_ids uuid[] not null default '{}';

update public.insurance_policy_settings
set responsible_user_ids = array[responsible_user_id]
where responsible_user_id is not null
  and responsible_user_ids = '{}';

drop policy if exists "manage insurance policy settings in tenant" on public.insurance_policy_settings;
create policy "manage insurance policy settings in tenant"
  on public.insurance_policy_settings
  for all
  using (public.is_admin_of(tenant_id))
  with check (
    public.is_admin_of(tenant_id)
    and (
      responsible_user_id is null
      or exists (
        select 1
        from public.memberships m
        where m.tenant_id = insurance_policy_settings.tenant_id
          and m.user_id = insurance_policy_settings.responsible_user_id
      )
    )
    and not exists (
      select 1
      from unnest(responsible_user_ids) as responsible_user_id_item
      where not exists (
        select 1
        from public.memberships m
        where m.tenant_id = insurance_policy_settings.tenant_id
          and m.user_id = responsible_user_id_item
      )
    )
  );

notify pgrst, 'reload schema';

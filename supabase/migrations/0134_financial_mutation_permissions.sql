-- Approved by the user on 2026-10-20 for a new disposable local verification stack.
-- Source proposal: plans/2026-10-20-workflow-qa/financial-rls-proposal.sql

begin;

drop policy if exists "certificates insert in tenant" on public.certificates;
drop policy if exists "certificates update in tenant" on public.certificates;
drop policy if exists "certificates delete in tenant" on public.certificates;

create policy "certificates insert in tenant"
  on public.certificates
  for insert
  with check (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'certificados:edit')
  );

create policy "certificates update in tenant"
  on public.certificates
  for update
  using (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'certificados:edit')
  )
  with check (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'certificados:edit')
  );

create policy "certificates delete in tenant"
  on public.certificates
  for delete
  using (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'certificados:admin')
  );

-- Leave "certificates select in tenant" unchanged.

drop policy if exists "manage insurance policies in tenant"
  on public.insurance_policies;
drop policy if exists "insert insurance policies with manage permission"
  on public.insurance_policies;
drop policy if exists "update insurance policies with manage permission"
  on public.insurance_policies;
drop policy if exists "delete insurance policies with manage permission"
  on public.insurance_policies;

create policy "insert insurance policies with manage permission"
  on public.insurance_policies
  for insert
  with check (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'insurance-policies:manage')
    and (
      obra_id is null
      or exists (
        select 1 from public.obras o
        where o.id = insurance_policies.obra_id
          and o.tenant_id = insurance_policies.tenant_id
          and o.deleted_at is null
      )
    )
  );

create policy "update insurance policies with manage permission"
  on public.insurance_policies
  for update
  using (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'insurance-policies:manage')
  )
  with check (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'insurance-policies:manage')
    and (
      obra_id is null
      or exists (
        select 1 from public.obras o
        where o.id = insurance_policies.obra_id
          and o.tenant_id = insurance_policies.tenant_id
          and o.deleted_at is null
      )
    )
  );

create policy "delete insurance policies with manage permission"
  on public.insurance_policies
  for delete
  using (
    public.is_member_of(tenant_id)
    and public.has_permission(tenant_id, 'insurance-policies:manage')
  );

-- Leave "read insurance policies in tenant" unchanged.

commit;

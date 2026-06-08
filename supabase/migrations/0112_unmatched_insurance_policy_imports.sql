-- Allow insurance policy imports to keep rows that could not be matched to an obra.

alter table public.insurance_policies
  alter column obra_id drop not null,
  add column if not exists import_obra_label text,
  add column if not exists import_match_status text not null default 'matched';

update public.insurance_policies
set import_match_status = 'matched'
where import_match_status is null;

do $$
begin
  alter table public.insurance_policies
    add constraint insurance_policies_import_match_status_check
    check (import_match_status in ('matched', 'unmatched'));
exception
  when duplicate_object then null;
end $$;

create index if not exists insurance_policies_unmatched_import_idx
  on public.insurance_policies (tenant_id, policy_number)
  where obra_id is null;

drop policy if exists "manage insurance policies in tenant" on public.insurance_policies;
create policy "manage insurance policies in tenant"
  on public.insurance_policies
  for all
  using (public.is_member_of(tenant_id))
  with check (
    public.is_member_of(tenant_id)
    and (
      obra_id is null
      or exists (
        select 1
        from public.obras o
        where o.id = insurance_policies.obra_id
          and o.tenant_id = insurance_policies.tenant_id
          and o.deleted_at is null
      )
    )
  );

comment on column public.insurance_policies.import_obra_label is
  'Obra label produced by the Excel import matcher, including the unmatched placeholder.';

comment on column public.insurance_policies.import_match_status is
  'Whether the Excel import row matched an existing obra or remains unmatched.';

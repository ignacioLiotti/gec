-- Store producer current-account / exigible rows separately from the
-- canonical insurance policy record. Negative balances are credit notes.

create table if not exists public.insurance_policy_financial_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  insurance_policy_id uuid references public.insurance_policies(id) on delete cascade,
  policy_number text not null,
  endorsement_number text,
  installment_number text,
  item_number text,
  invoice_position text,
  invoice_number text,
  invoice_letter text,
  issue_date date,
  producer_due_date date,
  insured_due_date date,
  coverage_start date,
  coverage_end date,
  section text,
  currency text,
  premium_amount numeric,
  paid_amount numeric,
  future_paid_amount numeric,
  due_amount numeric,
  upcoming_amount numeric,
  balance_amount numeric,
  status text,
  movement_type text not null default 'debit'
    check (movement_type in ('debit', 'credit_note')),
  source_file_name text,
  source_cutoff_date date,
  raw_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_policy_financial_movements_tenant_idx
  on public.insurance_policy_financial_movements (tenant_id);

create index if not exists insurance_policy_financial_movements_policy_idx
  on public.insurance_policy_financial_movements (tenant_id, policy_number);

create index if not exists insurance_policy_financial_movements_policy_fk_idx
  on public.insurance_policy_financial_movements (insurance_policy_id);

create index if not exists insurance_policy_financial_movements_source_idx
  on public.insurance_policy_financial_movements (tenant_id, source_file_name, source_cutoff_date);

create index if not exists insurance_policy_financial_movements_credit_idx
  on public.insurance_policy_financial_movements (tenant_id, movement_type)
  where movement_type = 'credit_note';

alter table public.insurance_policy_financial_movements enable row level security;

drop policy if exists "read insurance policy financial movements in tenant"
  on public.insurance_policy_financial_movements;
create policy "read insurance policy financial movements in tenant"
  on public.insurance_policy_financial_movements
  for select
  using (public.is_member_of(tenant_id));

drop policy if exists "manage insurance policy financial movements in tenant"
  on public.insurance_policy_financial_movements;
create policy "manage insurance policy financial movements in tenant"
  on public.insurance_policy_financial_movements
  for all
  using (public.is_member_of(tenant_id))
  with check (
    public.is_member_of(tenant_id)
    and (
      insurance_policy_id is null
      or exists (
        select 1
        from public.insurance_policies p
        where p.id = insurance_policy_financial_movements.insurance_policy_id
          and p.tenant_id = insurance_policy_financial_movements.tenant_id
      )
    )
  );

comment on table public.insurance_policy_financial_movements is
  'Producer current-account rows imported from exigible/debt spreadsheets. Positive balances are observed debt signals; negative balances are credit notes for compensation review.';

comment on column public.insurance_policy_financial_movements.movement_type is
  'debit for positive/zero balance rows, credit_note for negative balances reported by the producer.';

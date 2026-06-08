-- Repair insurance policy schema in environments where migration history says
-- 0104 ran but Postgres/PostgREST cannot see the backing tables.

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  policy_number text not null,
  section text,
  coverage_period text,
  end_date date,
  insured_amount numeric,
  currency text,
  premium numeric,
  prize numeric,
  balance numeric,
  status text,
  risk text,
  insured_object text,
  notes text,
  cancellation_rule_type text not null default 'on_finish'
    check (cancellation_rule_type in ('on_finish', 'days_after', 'months_after')),
  cancellation_rule_offset integer not null default 0 check (cancellation_rule_offset >= 0),
  obra_finished_at date,
  calculated_cancellation_date date,
  is_cancelled boolean not null default false,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_policies_unique_policy_per_obra
    unique (tenant_id, obra_id, policy_number)
);

alter table public.insurance_policies
  add column if not exists section text,
  add column if not exists coverage_period text,
  add column if not exists end_date date,
  add column if not exists insured_amount numeric,
  add column if not exists currency text,
  add column if not exists premium numeric,
  add column if not exists prize numeric,
  add column if not exists balance numeric,
  add column if not exists status text,
  add column if not exists risk text,
  add column if not exists insured_object text,
  add column if not exists notes text,
  add column if not exists obra_finished_at date,
  add column if not exists calculated_cancellation_date date,
  add column if not exists cancelled_at timestamptz,
  add column if not exists last_notified_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists insurance_policies_tenant_idx
  on public.insurance_policies (tenant_id);

create index if not exists insurance_policies_obra_idx
  on public.insurance_policies (obra_id);

create index if not exists insurance_policies_due_idx
  on public.insurance_policies (tenant_id, calculated_cancellation_date)
  where is_cancelled = false;

create table if not exists public.insurance_policy_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  responsible_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insurance_policies enable row level security;
alter table public.insurance_policy_settings enable row level security;

drop policy if exists "read insurance policies in tenant" on public.insurance_policies;
create policy "read insurance policies in tenant"
  on public.insurance_policies
  for select
  using (public.is_member_of(tenant_id));

drop policy if exists "manage insurance policies in tenant" on public.insurance_policies;
create policy "manage insurance policies in tenant"
  on public.insurance_policies
  for all
  using (public.is_member_of(tenant_id))
  with check (
    public.is_member_of(tenant_id)
    and exists (
      select 1
      from public.obras o
      where o.id = insurance_policies.obra_id
        and o.tenant_id = insurance_policies.tenant_id
        and o.deleted_at is null
    )
  );

drop policy if exists "read insurance policy settings in tenant" on public.insurance_policy_settings;
create policy "read insurance policy settings in tenant"
  on public.insurance_policy_settings
  for select
  using (public.is_member_of(tenant_id));

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
  );

insert into public.permissions (key, description, category, display_name, sort_order)
values
  (
    'insurance-policies:manage',
    'Manage insurance policies attached to obras',
    'obras',
    'Gestionar polizas de seguro',
    50
  )
on conflict (key) do update set
  description = excluded.description,
  category = excluded.category,
  display_name = excluded.display_name,
  sort_order = excluded.sort_order;

comment on table public.insurance_policies is
  'Canonical insurance policies imported from the general insurance spreadsheet and mirrored into obra_tablas for the macro table product surface.';

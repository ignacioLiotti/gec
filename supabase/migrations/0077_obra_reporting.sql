-- Reporting signals and findings for obras

create table if not exists public.obra_rule_config (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  config_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, obra_id)
);

create table if not exists public.obra_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  period_key text,
  signal_key text not null,
  value_num numeric,
  value_bool boolean,
  value_json jsonb,
  computed_at timestamptz not null default now(),
  source_hash text,
  unique (tenant_id, obra_id, period_key, signal_key)
);

create index if not exists obra_signals_lookup_idx
  on public.obra_signals(tenant_id, obra_id, period_key, signal_key);

create table if not exists public.obra_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  period_key text,
  rule_key text not null,
  severity text not null check (severity in ('info','warn','critical')),
  title text not null,
  message text,
  evidence_json jsonb,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists obra_findings_lookup_idx
  on public.obra_findings(tenant_id, obra_id, status, severity, created_at desc);

alter table public.obra_rule_config enable row level security;
alter table public.obra_signals enable row level security;
alter table public.obra_findings enable row level security;

-- RLS policies
-- Members can read/write within their tenant scope

drop policy if exists "obra_rule_config read in tenant" on public.obra_rule_config;
create policy "obra_rule_config read in tenant" on public.obra_rule_config
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_rule_config write in tenant" on public.obra_rule_config;
create policy "obra_rule_config write in tenant" on public.obra_rule_config
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

drop policy if exists "obra_signals read in tenant" on public.obra_signals;
create policy "obra_signals read in tenant" on public.obra_signals
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_signals write in tenant" on public.obra_signals;
create policy "obra_signals write in tenant" on public.obra_signals
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

drop policy if exists "obra_findings read in tenant" on public.obra_findings;
create policy "obra_findings read in tenant" on public.obra_findings
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_findings write in tenant" on public.obra_findings;
create policy "obra_findings write in tenant" on public.obra_findings
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

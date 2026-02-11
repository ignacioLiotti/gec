-- Log each signal computation

create table if not exists public.obra_signal_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  period_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.obra_signal_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.obra_signal_runs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  period_key text,
  signal_key text not null,
  inputs_json jsonb,
  outputs_json jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists obra_signal_logs_lookup_idx
  on public.obra_signal_logs(tenant_id, obra_id, period_key, signal_key);

alter table public.obra_signal_runs enable row level security;
alter table public.obra_signal_logs enable row level security;

-- RLS policies

drop policy if exists "obra_signal_runs read in tenant" on public.obra_signal_runs;
create policy "obra_signal_runs read in tenant" on public.obra_signal_runs
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_signal_runs write in tenant" on public.obra_signal_runs;
create policy "obra_signal_runs write in tenant" on public.obra_signal_runs
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

drop policy if exists "obra_signal_logs read in tenant" on public.obra_signal_logs;
create policy "obra_signal_logs read in tenant" on public.obra_signal_logs
  for select using (public.is_member_of(tenant_id));

drop policy if exists "obra_signal_logs write in tenant" on public.obra_signal_logs;
create policy "obra_signal_logs write in tenant" on public.obra_signal_logs
  for all using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

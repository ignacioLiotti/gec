-- Data-flow recompute runs, field suggestions, writeback audit, and writeback permissions.

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  ('data-flow:apply-suggestion', 'Accept or reject data-flow field suggestions', 'data-flow', 'Aplicar sugerencias de data-flow', 3),
  ('data-flow:auto-write', 'Allow data-flow results to automatically write obra fields', 'data-flow', 'Auto-escritura de data-flow', 4)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

create table if not exists public.obra_data_flow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  trigger text not null,
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists obra_data_flow_runs_tenant_obra_created_idx
  on public.obra_data_flow_runs(tenant_id, obra_id, created_at desc);

alter table public.obra_data_flow_runs enable row level security;

drop policy if exists "data_flow_runs read" on public.obra_data_flow_runs;
create policy "data_flow_runs read" on public.obra_data_flow_runs
  for select using (public.has_permission(tenant_id, 'data-flow:read'));

drop policy if exists "data_flow_runs insert" on public.obra_data_flow_runs;
create policy "data_flow_runs insert" on public.obra_data_flow_runs
  for insert with check (public.has_permission(tenant_id, 'data-flow:edit'));

create table if not exists public.obra_data_flow_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  run_id uuid references public.obra_data_flow_runs(id) on delete set null,
  result_id text not null,
  result_label text not null,
  calculation_id text,
  field_id text not null,
  old_value jsonb,
  suggested_value jsonb,
  formatted_value text,
  formula_summary jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  applied_by uuid references auth.users(id),
  applied_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists obra_data_flow_suggestions_tenant_obra_status_idx
  on public.obra_data_flow_suggestions(tenant_id, obra_id, status, created_at desc);

alter table public.obra_data_flow_suggestions enable row level security;

drop policy if exists "data_flow_suggestions read" on public.obra_data_flow_suggestions;
create policy "data_flow_suggestions read" on public.obra_data_flow_suggestions
  for select using (public.has_permission(tenant_id, 'data-flow:read'));

drop policy if exists "data_flow_suggestions insert" on public.obra_data_flow_suggestions;
create policy "data_flow_suggestions insert" on public.obra_data_flow_suggestions
  for insert with check (public.has_permission(tenant_id, 'data-flow:edit'));

drop policy if exists "data_flow_suggestions update" on public.obra_data_flow_suggestions;
create policy "data_flow_suggestions update" on public.obra_data_flow_suggestions
  for update using (public.has_permission(tenant_id, 'data-flow:apply-suggestion'))
  with check (public.has_permission(tenant_id, 'data-flow:apply-suggestion'));

create table if not exists public.obra_data_flow_writeback_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  run_id uuid references public.obra_data_flow_runs(id) on delete set null,
  result_id text not null,
  result_label text not null,
  field_id text not null,
  old_value jsonb,
  new_value jsonb,
  mode text not null,
  status text not null,
  reason text,
  formula_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists obra_data_flow_writeback_audit_tenant_obra_created_idx
  on public.obra_data_flow_writeback_audit(tenant_id, obra_id, created_at desc);

alter table public.obra_data_flow_writeback_audit enable row level security;

drop policy if exists "data_flow_writeback_audit read" on public.obra_data_flow_writeback_audit;
create policy "data_flow_writeback_audit read" on public.obra_data_flow_writeback_audit
  for select using (public.has_permission(tenant_id, 'data-flow:read'));

drop policy if exists "data_flow_writeback_audit insert" on public.obra_data_flow_writeback_audit;
create policy "data_flow_writeback_audit insert" on public.obra_data_flow_writeback_audit
  for insert with check (
    public.has_permission(tenant_id, 'data-flow:edit')
    or public.has_permission(tenant_id, 'data-flow:auto-write')
  );

UPDATE public.role_templates
SET permissions = (
  SELECT jsonb_agg(DISTINCT permission_key)
  FROM jsonb_array_elements_text(role_templates.permissions || '["data-flow:apply-suggestion"]'::jsonb) AS elem(permission_key)
)
WHERE key IN ('data_flow_editor', 'data_flow_admin');

UPDATE public.role_templates
SET permissions = (
  SELECT jsonb_agg(DISTINCT permission_key)
  FROM jsonb_array_elements_text(role_templates.permissions || '["data-flow:auto-write"]'::jsonb) AS elem(permission_key)
)
WHERE key = 'data_flow_admin';

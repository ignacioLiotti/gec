-- Tenant-scoped WhatsApp Flow editor and test runs.

create table if not exists public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  flow_type text not null default 'data_entry' check (flow_type in ('data_entry', 'boolean_checklist', 'review', 'selection', 'upload_request')),
  meta_flow_id text,
  version integer not null default 1,
  definition jsonb not null default '{"fields":[]}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_flows_tenant_slug_unique unique (tenant_id, slug)
);

create index if not exists whatsapp_flows_tenant_status_idx
  on public.whatsapp_flows(tenant_id, status, flow_type);

create table if not exists public.whatsapp_flow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  flow_id uuid not null references public.whatsapp_flows(id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  chat_action_id uuid references public.whatsapp_chat_actions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'completed', 'expired', 'failed', 'cancelled')),
  context jsonb not null default '{}'::jsonb,
  response_values jsonb not null default '{}'::jsonb,
  manual_submission_id uuid references public.whatsapp_manual_submissions(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_flow_runs_contact_status_idx
  on public.whatsapp_flow_runs(contact_id, status, created_at desc);

alter table public.whatsapp_flows enable row level security;
alter table public.whatsapp_flow_runs enable row level security;

drop policy if exists "whatsapp flows admin read" on public.whatsapp_flows;
create policy "whatsapp flows admin read"
  on public.whatsapp_flows for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp flows admin manage" on public.whatsapp_flows;
create policy "whatsapp flows admin manage"
  on public.whatsapp_flows for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp flow runs admin read" on public.whatsapp_flow_runs;
create policy "whatsapp flow runs admin read"
  on public.whatsapp_flow_runs for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp flow runs admin manage" on public.whatsapp_flow_runs;
create policy "whatsapp flow runs admin manage"
  on public.whatsapp_flow_runs for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop trigger if exists whatsapp_flows_updated_at on public.whatsapp_flows;
create trigger whatsapp_flows_updated_at
  before update on public.whatsapp_flows
  for each row execute function update_timestamp();

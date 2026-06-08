-- WhatsApp usage policies and template registry.

create table if not exists public.whatsapp_usage_policies (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  monthly_budget_cents integer not null default 2000 check (monthly_budget_cents >= 0),
  service_messages_limit integer check (service_messages_limit is null or service_messages_limit >= 0),
  utility_templates_limit integer not null default 400 check (utility_templates_limit >= 0),
  marketing_templates_limit integer not null default 0 check (marketing_templates_limit >= 0),
  authentication_templates_limit integer not null default 0 check (authentication_templates_limit >= 0),
  file_uploads_limit integer not null default 300 check (file_uploads_limit >= 0),
  storage_bytes_limit bigint not null default 2147483648 check (storage_bytes_limit >= 0),
  data_queries_limit integer not null default 300 check (data_queries_limit >= 0),
  manual_submissions_limit integer not null default 300 check (manual_submissions_limit >= 0),
  recurring_contacts_limit integer not null default 25 check (recurring_contacts_limit >= 0),
  recurring_reminders_per_contact_per_week integer not null default 1 check (recurring_reminders_per_contact_per_week >= 0),
  alert_thresholds jsonb not null default '{"warning": 0.8, "critical": 0.95}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_usage_policies_budget_idx
  on public.whatsapp_usage_policies(monthly_budget_cents);

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  display_name text,
  category text not null default 'utility' check (category in ('utility', 'marketing', 'authentication', 'service')),
  language text not null default 'es_AR',
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled')),
  trigger_purpose text,
  body text,
  variables jsonb not null default '[]'::jsonb,
  meta_template_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_templates_tenant_name_unique unique (tenant_id, name)
);

create index if not exists whatsapp_templates_tenant_status_idx
  on public.whatsapp_templates(tenant_id, status, category);

alter table public.whatsapp_usage_policies enable row level security;
alter table public.whatsapp_templates enable row level security;

drop policy if exists "whatsapp usage policies admin read" on public.whatsapp_usage_policies;
create policy "whatsapp usage policies admin read"
  on public.whatsapp_usage_policies for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp usage policies admin manage" on public.whatsapp_usage_policies;
create policy "whatsapp usage policies admin manage"
  on public.whatsapp_usage_policies for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp templates admin read" on public.whatsapp_templates;
create policy "whatsapp templates admin read"
  on public.whatsapp_templates for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp templates admin manage" on public.whatsapp_templates;
create policy "whatsapp templates admin manage"
  on public.whatsapp_templates for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop trigger if exists whatsapp_usage_policies_updated_at on public.whatsapp_usage_policies;
create trigger whatsapp_usage_policies_updated_at
  before update on public.whatsapp_usage_policies
  for each row execute function update_timestamp();

drop trigger if exists whatsapp_templates_updated_at on public.whatsapp_templates;
create trigger whatsapp_templates_updated_at
  before update on public.whatsapp_templates
  for each row execute function update_timestamp();

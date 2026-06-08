-- WhatsApp operational history, document-template bindings, and recurring assignments.

alter table public.whatsapp_templates
  add column if not exists document_generation_template_id uuid references public.document_generation_templates(id) on delete set null,
  add column if not exists document_type text,
  add column if not exists target_folder_path text,
  add column if not exists result_mode text not null default 'manual_submission'
    check (result_mode in ('manual_submission', 'generate_document', 'upload_request', 'review_only')),
  add column if not exists field_mapping jsonb not null default '{}'::jsonb,
  add column if not exists settings jsonb not null default '{}'::jsonb;

create index if not exists whatsapp_templates_document_template_idx
  on public.whatsapp_templates(document_generation_template_id);

create table if not exists public.whatsapp_chat_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  action_type text not null check (
    action_type in (
      'upload_file',
      'manual_submission',
      'generate_document',
      'data_query',
      'template_response',
      'permission_check',
      'unknown'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed', 'needs_review', 'failed', 'cancelled')
  ),
  obra_id uuid references public.obras(id) on delete set null,
  folder_path text,
  whatsapp_template_id uuid references public.whatsapp_templates(id) on delete set null,
  document_generation_template_id uuid references public.document_generation_templates(id) on delete set null,
  upload_id uuid references public.whatsapp_document_uploads(id) on delete set null,
  manual_submission_id uuid references public.whatsapp_manual_submissions(id) on delete set null,
  generated_document_id uuid references public.generated_documents(id) on delete set null,
  user_prompt text,
  parsed_params jsonb not null default '{}'::jsonb,
  result_summary text,
  error_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists whatsapp_chat_actions_tenant_created_idx
  on public.whatsapp_chat_actions(tenant_id, created_at desc);

create index if not exists whatsapp_chat_actions_contact_status_idx
  on public.whatsapp_chat_actions(contact_id, status, created_at desc);

create table if not exists public.whatsapp_recurring_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  whatsapp_template_id uuid not null references public.whatsapp_templates(id) on delete restrict,
  document_generation_template_id uuid references public.document_generation_templates(id) on delete set null,
  obra_id uuid not null references public.obras(id) on delete cascade,
  folder_path text,
  result_mode text not null default 'manual_submission'
    check (result_mode in ('manual_submission', 'generate_document', 'upload_request', 'review_only')),
  frequency text not null default 'weekly' check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  weekday text,
  day_of_month integer check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 31)),
  time_of_day time without time zone,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_recurring_assignments_tenant_status_idx
  on public.whatsapp_recurring_assignments(tenant_id, status, next_run_at);

create table if not exists public.whatsapp_recurring_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assignment_id uuid not null references public.whatsapp_recurring_assignments(id) on delete cascade,
  outbound_message_id uuid references public.whatsapp_messages(id) on delete set null,
  inbound_message_id uuid references public.whatsapp_messages(id) on delete set null,
  chat_action_id uuid references public.whatsapp_chat_actions(id) on delete set null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'sent', 'responded', 'completed', 'failed', 'cancelled')
  ),
  due_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_recurring_runs_assignment_created_idx
  on public.whatsapp_recurring_runs(assignment_id, created_at desc);

alter table public.whatsapp_chat_actions enable row level security;
alter table public.whatsapp_recurring_assignments enable row level security;
alter table public.whatsapp_recurring_runs enable row level security;

drop policy if exists "whatsapp chat actions admin read" on public.whatsapp_chat_actions;
create policy "whatsapp chat actions admin read"
  on public.whatsapp_chat_actions for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp chat actions admin manage" on public.whatsapp_chat_actions;
create policy "whatsapp chat actions admin manage"
  on public.whatsapp_chat_actions for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp recurring assignments admin read" on public.whatsapp_recurring_assignments;
create policy "whatsapp recurring assignments admin read"
  on public.whatsapp_recurring_assignments for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp recurring assignments admin manage" on public.whatsapp_recurring_assignments;
create policy "whatsapp recurring assignments admin manage"
  on public.whatsapp_recurring_assignments for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp recurring runs admin read" on public.whatsapp_recurring_runs;
create policy "whatsapp recurring runs admin read"
  on public.whatsapp_recurring_runs for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp recurring runs admin manage" on public.whatsapp_recurring_runs;
create policy "whatsapp recurring runs admin manage"
  on public.whatsapp_recurring_runs for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop trigger if exists whatsapp_recurring_assignments_updated_at on public.whatsapp_recurring_assignments;
create trigger whatsapp_recurring_assignments_updated_at
  before update on public.whatsapp_recurring_assignments
  for each row execute function update_timestamp();

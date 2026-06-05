-- WhatsApp operations: tenant-scoped channel config, contacts, messages,
-- document uploads, manual submissions, and recurring form schedules.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_business_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'meta_cloud' check (provider in ('meta_cloud', 'twilio', '360dialog')),
  phone_number_id text not null,
  display_phone_number text,
  business_account_id text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'disabled')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_business_accounts_phone_unique unique (phone_number_id)
);

create index if not exists whatsapp_business_accounts_tenant_idx
  on public.whatsapp_business_accounts(tenant_id, status);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone_e164 text not null,
  display_name text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  can_upload_documents boolean not null default false,
  can_submit_forms boolean not null default false,
  can_query_data boolean not null default false,
  allowed_obra_ids uuid[] not null default '{}'::uuid[],
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_contacts_tenant_phone_unique unique (tenant_id, phone_e164)
);

create index if not exists whatsapp_contacts_tenant_status_idx
  on public.whatsapp_contacts(tenant_id, status);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_account_id uuid references public.whatsapp_business_accounts(id) on delete set null,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  wamid text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_phone text,
  to_phone text,
  message_type text not null default 'unknown',
  text_body text,
  media_id text,
  media_mime_type text,
  media_sha256 text,
  media_filename text,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed', 'sent', 'delivered', 'read')),
  error_message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint whatsapp_messages_wamid_unique unique (wamid)
);

create index if not exists whatsapp_messages_tenant_created_idx
  on public.whatsapp_messages(tenant_id, created_at desc);

create index if not exists whatsapp_messages_contact_created_idx
  on public.whatsapp_messages(contact_id, created_at desc);

create table if not exists public.whatsapp_pending_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts(id) on delete cascade,
  source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  action_type text not null check (action_type in ('select_obra', 'select_folder', 'confirm_upload', 'confirm_manual_submission')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'expired', 'cancelled')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_pending_actions_contact_idx
  on public.whatsapp_pending_actions(contact_id, status, expires_at);

create table if not exists public.whatsapp_document_uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  obra_id uuid not null references public.obras(id) on delete cascade,
  folder_path text not null,
  storage_bucket text not null default 'obra-documents',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  uploaded_bytes bigint not null default 0,
  status text not null default 'uploaded' check (status in ('uploaded', 'failed', 'removed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_document_uploads_tenant_created_idx
  on public.whatsapp_document_uploads(tenant_id, created_at desc);

create index if not exists whatsapp_document_uploads_obra_idx
  on public.whatsapp_document_uploads(obra_id, created_at desc);

create table if not exists public.whatsapp_manual_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  obra_id uuid references public.obras(id) on delete cascade,
  folder_path text,
  tabla_id uuid references public.obra_tablas(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_mode text not null default 'on_demand' check (trigger_mode in ('on_demand', 'scheduled', 'both')),
  schedule jsonb not null default '{}'::jsonb,
  whatsapp_flow_id text,
  template_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_manual_forms_tenant_status_idx
  on public.whatsapp_manual_forms(tenant_id, status);

create table if not exists public.whatsapp_manual_form_contacts (
  form_id uuid not null references public.whatsapp_manual_forms(id) on delete cascade,
  contact_id uuid not null references public.whatsapp_contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (form_id, contact_id)
);

create table if not exists public.whatsapp_manual_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  form_id uuid references public.whatsapp_manual_forms(id) on delete set null,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  obra_id uuid references public.obras(id) on delete cascade,
  folder_path text,
  tabla_id uuid references public.obra_tablas(id) on delete set null,
  raw_values jsonb not null default '{}'::jsonb,
  parsed_values jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  status text not null default 'received' check (status in ('received', 'needs_review', 'ready_to_apply', 'applied', 'rejected', 'failed')),
  applied_row_id uuid references public.obra_tabla_rows(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_manual_submissions_tenant_status_idx
  on public.whatsapp_manual_submissions(tenant_id, status, created_at desc);

create index if not exists whatsapp_manual_submissions_tabla_idx
  on public.whatsapp_manual_submissions(tabla_id, created_at desc);

alter table public.whatsapp_business_accounts enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_pending_actions enable row level security;
alter table public.whatsapp_document_uploads enable row level security;
alter table public.whatsapp_manual_forms enable row level security;
alter table public.whatsapp_manual_form_contacts enable row level security;
alter table public.whatsapp_manual_submissions enable row level security;

drop policy if exists "whatsapp business accounts admin read" on public.whatsapp_business_accounts;
create policy "whatsapp business accounts admin read"
  on public.whatsapp_business_accounts for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp business accounts admin manage" on public.whatsapp_business_accounts;
create policy "whatsapp business accounts admin manage"
  on public.whatsapp_business_accounts for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp contacts admin read" on public.whatsapp_contacts;
create policy "whatsapp contacts admin read"
  on public.whatsapp_contacts for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp contacts admin manage" on public.whatsapp_contacts;
create policy "whatsapp contacts admin manage"
  on public.whatsapp_contacts for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp messages admin read" on public.whatsapp_messages;
create policy "whatsapp messages admin read"
  on public.whatsapp_messages for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp pending actions admin read" on public.whatsapp_pending_actions;
create policy "whatsapp pending actions admin read"
  on public.whatsapp_pending_actions for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp document uploads admin read" on public.whatsapp_document_uploads;
create policy "whatsapp document uploads admin read"
  on public.whatsapp_document_uploads for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp manual forms admin read" on public.whatsapp_manual_forms;
create policy "whatsapp manual forms admin read"
  on public.whatsapp_manual_forms for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp manual forms admin manage" on public.whatsapp_manual_forms;
create policy "whatsapp manual forms admin manage"
  on public.whatsapp_manual_forms for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp form contacts admin read" on public.whatsapp_manual_form_contacts;
create policy "whatsapp form contacts admin read"
  on public.whatsapp_manual_form_contacts for select
  using (
    exists (
      select 1 from public.whatsapp_manual_forms f
      where f.id = whatsapp_manual_form_contacts.form_id
        and (public.is_admin_of(f.tenant_id) or public.has_permission(f.tenant_id, 'admin:whatsapp'))
    )
  );

drop policy if exists "whatsapp form contacts admin manage" on public.whatsapp_manual_form_contacts;
create policy "whatsapp form contacts admin manage"
  on public.whatsapp_manual_form_contacts for all
  using (
    exists (
      select 1 from public.whatsapp_manual_forms f
      where f.id = whatsapp_manual_form_contacts.form_id
        and (public.is_admin_of(f.tenant_id) or public.has_permission(f.tenant_id, 'admin:whatsapp'))
    )
  )
  with check (
    exists (
      select 1 from public.whatsapp_manual_forms f
      where f.id = whatsapp_manual_form_contacts.form_id
        and (public.is_admin_of(f.tenant_id) or public.has_permission(f.tenant_id, 'admin:whatsapp'))
    )
  );

drop policy if exists "whatsapp submissions admin read" on public.whatsapp_manual_submissions;
create policy "whatsapp submissions admin read"
  on public.whatsapp_manual_submissions for select
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

drop policy if exists "whatsapp submissions admin manage" on public.whatsapp_manual_submissions;
create policy "whatsapp submissions admin manage"
  on public.whatsapp_manual_submissions for all
  using (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'))
  with check (public.is_admin_of(tenant_id) or public.has_permission(tenant_id, 'admin:whatsapp'));

insert into public.permissions (key, description, category, display_name, sort_order)
values (
  'admin:whatsapp',
  'Manage WhatsApp contacts, inbox, document uploads, and manual form submissions',
  'admin',
  'WhatsApp',
  6
)
on conflict (key) do update set
  description = excluded.description,
  category = excluded.category,
  display_name = excluded.display_name,
  sort_order = excluded.sort_order;

drop trigger if exists whatsapp_business_accounts_updated_at on public.whatsapp_business_accounts;
create trigger whatsapp_business_accounts_updated_at
  before update on public.whatsapp_business_accounts
  for each row execute function update_timestamp();

drop trigger if exists whatsapp_contacts_updated_at on public.whatsapp_contacts;
create trigger whatsapp_contacts_updated_at
  before update on public.whatsapp_contacts
  for each row execute function update_timestamp();

drop trigger if exists whatsapp_manual_forms_updated_at on public.whatsapp_manual_forms;
create trigger whatsapp_manual_forms_updated_at
  before update on public.whatsapp_manual_forms
  for each row execute function update_timestamp();

drop trigger if exists whatsapp_manual_submissions_updated_at on public.whatsapp_manual_submissions;
create trigger whatsapp_manual_submissions_updated_at
  before update on public.whatsapp_manual_submissions
  for each row execute function update_timestamp();

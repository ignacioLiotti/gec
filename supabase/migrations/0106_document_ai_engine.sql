-- Document AI enterprise engine: runs, indexed sources, outputs and permissions.

create extension if not exists vector;

insert into storage.buckets (id, name, public)
values ('document-ai-outputs', 'document-ai-outputs', false)
on conflict (id) do nothing;

insert into public.permissions (key, description, category, display_name, sort_order)
values
  ('nav:document-ai', 'Access Document AI workspace navigation', 'navigation', 'Document AI', 55),
  ('document-ai:run', 'Create and inspect Document AI runs', 'documents', 'Ejecutar Document AI', 10),
  ('document-ai:admin', 'Rebuild Document AI index and manage generated outputs', 'documents', 'Administrar Document AI', 11)
on conflict (key) do update set
  category = excluded.category,
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  description = excluded.description;

insert into public.role_templates (key, name, description, permissions, is_system)
values
  (
    'document_ai_operator',
    'Document AI Operator',
    'Can query obra documents and generate auditable reports from extracted data.',
    '["nav:document-ai", "document-ai:run"]'::jsonb,
    true
  ),
  (
    'document_ai_manager',
    'Document AI Manager',
    'Can run Document AI and rebuild indexes.',
    '["nav:document-ai", "document-ai:run", "document-ai:admin"]'::jsonb,
    true
  )
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions;

create table if not exists public.document_ai_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  prompt text not null,
  output_type text not null check (output_type in ('summary', 'dashboard', 'chart', 'pdf', 'pptx', 'docx', 'xlsx')),
  status text not null default 'pending' check (status in ('pending', 'retrieving', 'composing', 'rendering', 'completed', 'failed')),
  intent jsonb not null default '{}'::jsonb,
  retrieved_context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_ai_runs_tenant_idx
  on public.document_ai_runs(tenant_id, created_at desc);

create index if not exists document_ai_runs_obra_idx
  on public.document_ai_runs(obra_id, created_at desc)
  where obra_id is not null;

create table if not exists public.document_ai_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.document_ai_runs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete set null,
  document_id uuid,
  table_id uuid,
  row_id uuid,
  field_key text,
  source_value jsonb,
  normalized_value jsonb,
  confidence numeric not null default 0,
  lineage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_ai_sources_run_idx
  on public.document_ai_sources(run_id);

create index if not exists document_ai_sources_tenant_idx
  on public.document_ai_sources(tenant_id, created_at desc);

create table if not exists public.document_ai_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.document_ai_runs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  output_type text not null check (output_type in ('summary', 'dashboard', 'chart', 'pdf', 'pptx', 'docx', 'xlsx', 'html')),
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  preview jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_ai_outputs_run_idx
  on public.document_ai_outputs(run_id, created_at desc);

create table if not exists public.document_ai_index (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  document_id uuid,
  source_kind text not null check (source_kind in ('chunk', 'row', 'field', 'table', 'metadata')),
  source_table text,
  source_id uuid,
  document_type text,
  content text not null,
  structured_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_ref jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  content_hash text,
  created_at timestamptz not null default now(),
  unique (tenant_id, source_kind, source_table, source_id, content_hash)
);

create table if not exists public.document_ai_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  document_id uuid,
  document_type text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  source_ref jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_ai_chunks_tenant_idx
  on public.document_ai_chunks(tenant_id, obra_id, document_type);

create table if not exists public.document_ai_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  document_id uuid,
  entity_type text not null,
  entity_key text not null,
  entity_value jsonb not null,
  confidence numeric not null default 0,
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_ai_entities_tenant_idx
  on public.document_ai_entities(tenant_id, obra_id, entity_type, entity_key);

create table if not exists public.document_ai_table_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  source_table text,
  source_row_id uuid,
  document_id uuid,
  document_type text,
  structured_data jsonb not null default '{}'::jsonb,
  source_ref jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (tenant_id, source_table, source_row_id)
);

create index if not exists document_ai_table_rows_tenant_idx
  on public.document_ai_table_rows(tenant_id, obra_id, document_type);

create index if not exists document_ai_index_tenant_idx
  on public.document_ai_index(tenant_id, obra_id, document_type);

create index if not exists document_ai_index_hash_idx
  on public.document_ai_index(content_hash);

create index if not exists document_ai_index_embedding_idx
  on public.document_ai_index
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists public.document_ai_index_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  rows_indexed integer not null default 0,
  chunks_indexed integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.match_document_ai_index(
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_obra_id uuid default null,
  match_document_type text default null,
  match_count int default 20
)
returns table (
  id uuid,
  tenant_id uuid,
  obra_id uuid,
  document_type text,
  content text,
  structured_data jsonb,
  metadata jsonb,
  source_ref jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    dai.id,
    dai.tenant_id,
    dai.obra_id,
    dai.document_type,
    dai.content,
    dai.structured_data,
    dai.metadata,
    dai.source_ref,
    1 - (dai.embedding <=> query_embedding) as similarity
  from public.document_ai_index dai
  where dai.tenant_id = match_tenant_id
    and dai.embedding is not null
    and (match_obra_id is null or dai.obra_id = match_obra_id)
    and (match_document_type is null or dai.document_type = match_document_type)
  order by dai.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

alter table public.document_ai_runs enable row level security;
alter table public.document_ai_sources enable row level security;
alter table public.document_ai_outputs enable row level security;
alter table public.document_ai_index enable row level security;
alter table public.document_ai_index_runs enable row level security;
alter table public.document_ai_chunks enable row level security;
alter table public.document_ai_entities enable row level security;
alter table public.document_ai_table_rows enable row level security;

drop policy if exists "document_ai_runs_select" on public.document_ai_runs;
create policy "document_ai_runs_select"
  on public.document_ai_runs
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_runs_insert" on public.document_ai_runs;
create policy "document_ai_runs_insert"
  on public.document_ai_runs
  for insert
  with check (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_runs_update" on public.document_ai_runs;
create policy "document_ai_runs_update"
  on public.document_ai_runs
  for update
  using (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'))
  with check (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_sources_select" on public.document_ai_sources;
create policy "document_ai_sources_select"
  on public.document_ai_sources
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_sources_insert" on public.document_ai_sources;
create policy "document_ai_sources_insert"
  on public.document_ai_sources
  for insert
  with check (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_outputs_select" on public.document_ai_outputs;
create policy "document_ai_outputs_select"
  on public.document_ai_outputs
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_outputs_insert" on public.document_ai_outputs;
create policy "document_ai_outputs_insert"
  on public.document_ai_outputs
  for insert
  with check (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_index_select" on public.document_ai_index;
create policy "document_ai_index_select"
  on public.document_ai_index
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_index_manage" on public.document_ai_index;
create policy "document_ai_index_manage"
  on public.document_ai_index
  for all
  using (public.has_permission(tenant_id, 'document-ai:admin'))
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_chunks_select" on public.document_ai_chunks;
create policy "document_ai_chunks_select"
  on public.document_ai_chunks
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chunks_manage" on public.document_ai_chunks;
create policy "document_ai_chunks_manage"
  on public.document_ai_chunks
  for all
  using (public.has_permission(tenant_id, 'document-ai:admin'))
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_entities_select" on public.document_ai_entities;
create policy "document_ai_entities_select"
  on public.document_ai_entities
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_entities_manage" on public.document_ai_entities;
create policy "document_ai_entities_manage"
  on public.document_ai_entities
  for all
  using (public.has_permission(tenant_id, 'document-ai:admin'))
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_table_rows_select" on public.document_ai_table_rows;
create policy "document_ai_table_rows_select"
  on public.document_ai_table_rows
  for select
  using (public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_table_rows_manage" on public.document_ai_table_rows;
create policy "document_ai_table_rows_manage"
  on public.document_ai_table_rows
  for all
  using (public.has_permission(tenant_id, 'document-ai:admin'))
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_index_runs_select" on public.document_ai_index_runs;
create policy "document_ai_index_runs_select"
  on public.document_ai_index_runs
  for select
  using (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_index_runs_insert" on public.document_ai_index_runs;
create policy "document_ai_index_runs_insert"
  on public.document_ai_index_runs
  for insert
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop policy if exists "document_ai_index_runs_update" on public.document_ai_index_runs;
create policy "document_ai_index_runs_update"
  on public.document_ai_index_runs
  for update
  using (public.has_permission(tenant_id, 'document-ai:admin'))
  with check (public.has_permission(tenant_id, 'document-ai:admin'));

drop trigger if exists document_ai_runs_updated_at on public.document_ai_runs;
create trigger document_ai_runs_updated_at
  before update on public.document_ai_runs
  for each row
  execute function update_timestamp();

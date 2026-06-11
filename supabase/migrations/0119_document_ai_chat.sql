-- Document AI conversational chat: sessions and messages, audit-friendly.

create table if not exists public.document_ai_chats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_ai_chats_tenant_idx
  on public.document_ai_chats(tenant_id, updated_at desc);

create index if not exists document_ai_chats_user_idx
  on public.document_ai_chats(user_id, updated_at desc);

create table if not exists public.document_ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.document_ai_chats(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  tool_invocations jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_ai_chat_messages_chat_idx
  on public.document_ai_chat_messages(chat_id, created_at asc);

create index if not exists document_ai_chat_messages_rate_idx
  on public.document_ai_chat_messages(tenant_id, role, created_at desc);

alter table public.document_ai_chats enable row level security;
alter table public.document_ai_chat_messages enable row level security;

drop policy if exists "document_ai_chats_select" on public.document_ai_chats;
create policy "document_ai_chats_select"
  on public.document_ai_chats
  for select
  using (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chats_insert" on public.document_ai_chats;
create policy "document_ai_chats_insert"
  on public.document_ai_chats
  for insert
  with check (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chats_update" on public.document_ai_chats;
create policy "document_ai_chats_update"
  on public.document_ai_chats
  for update
  using (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'))
  with check (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chats_delete" on public.document_ai_chats;
create policy "document_ai_chats_delete"
  on public.document_ai_chats
  for delete
  using (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chat_messages_select" on public.document_ai_chat_messages;
create policy "document_ai_chat_messages_select"
  on public.document_ai_chat_messages
  for select
  using (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop policy if exists "document_ai_chat_messages_insert" on public.document_ai_chat_messages;
create policy "document_ai_chat_messages_insert"
  on public.document_ai_chat_messages
  for insert
  with check (user_id = auth.uid() and public.has_permission(tenant_id, 'document-ai:run'));

drop trigger if exists document_ai_chats_updated_at on public.document_ai_chats;
create trigger document_ai_chats_updated_at
  before update on public.document_ai_chats
  for each row
  execute function update_timestamp();

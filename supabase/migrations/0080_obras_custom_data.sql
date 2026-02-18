-- Store tenant-specific dynamic fields for main obras table.

alter table public.obras
  add column if not exists custom_data jsonb not null default '{}'::jsonb;


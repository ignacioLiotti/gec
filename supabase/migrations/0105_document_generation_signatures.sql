-- User-level digital signature used when approving generated documents.

alter table public.profiles
  add column if not exists digital_signature_data_url text;

comment on column public.profiles.digital_signature_data_url is
  'Data URL for the user digital signature shown on approved generated documents.';

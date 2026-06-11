alter table public.insurance_policies
  add column if not exists cancellation_requested_at date,
  add column if not exists cancellation_confirmed_at date,
  add column if not exists cancellation_notes text;

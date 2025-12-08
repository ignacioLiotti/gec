-- Add obra and flujo references to calendar_events so we can clean them up
-- if an obra is reverted from completed back to incomplete.

alter table public.calendar_events
  add column if not exists obra_id uuid references public.obras(id) on delete cascade,
  add column if not exists flujo_action_id uuid;



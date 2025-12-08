-- Add due_time to obra_pendientes for time-of-day selection
alter table public.obra_pendientes
  add column if not exists due_time time without time zone;










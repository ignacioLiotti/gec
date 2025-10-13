-- DEV-ONLY: Open policies to simplify local testing
-- NOTE: Remove these in production.

-- Allow anyone to read instruments
drop policy if exists "dev open read instruments" on public.instruments;
create policy "dev open read instruments" on public.instruments
  for select using (true);

-- Allow anyone to insert instruments (e.g., from /test form)
drop policy if exists "dev open insert instruments" on public.instruments;
create policy "dev open insert instruments" on public.instruments
  for insert with check (true);




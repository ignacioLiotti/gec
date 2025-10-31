-- DEV-ONLY: Open policies to simplify local testing
-- NOTE: Wrapped in environment guard to avoid applying in production.

do $$
begin
  -- Only run when explicitly marked as development via custom setting
  if coalesce(current_setting('app.env', true), '') = 'development' then
    -- Allow anyone to read instruments
    drop policy if exists "dev open read instruments" on public.instruments;
    create policy "dev open read instruments" on public.instruments
      for select using (true);

    -- Allow anyone to insert instruments (e.g., from /test form)
    drop policy if exists "dev open insert instruments" on public.instruments;
    create policy "dev open insert instruments" on public.instruments
      for insert with check (true);
  end if;
end
$$;


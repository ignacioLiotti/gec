-- Reapply tenant creation policy & grant after manual edit

drop policy if exists "insert tenants" on public.tenants;
create policy "insert tenants" on public.tenants
  for insert
  with check (auth.uid() is not null);

grant insert on public.tenants to authenticated;

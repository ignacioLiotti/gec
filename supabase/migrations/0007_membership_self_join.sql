-- Allow authenticated users to self-join any tenant as member

drop policy if exists "self join tenant as member" on public.memberships;
create policy "self join tenant as member" on public.memberships
  for insert
  with check (
    user_id = auth.uid() and role = 'member'
  );



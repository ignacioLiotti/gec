-- Allow tenant admins to read all memberships for their tenant

drop policy if exists "admins read memberships in tenant" on public.memberships;
create policy "admins read memberships in tenant" on public.memberships
  for select using (public.is_admin_of(tenant_id));



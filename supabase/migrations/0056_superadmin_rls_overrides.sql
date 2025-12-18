-- Allow superadmins to bypass RLS when operating admin pages

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security invoker
as $$
  select coalesce(
    (select is_superadmin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

drop policy if exists "superadmin read tenants" on public.tenants;
create policy "superadmin read tenants" on public.tenants
  for select
  using (public.is_superadmin());

drop policy if exists "superadmin read memberships" on public.memberships;
create policy "superadmin read memberships" on public.memberships
  for select
  using (public.is_superadmin());

drop policy if exists "superadmin read invitations" on public.invitations;
create policy "superadmin read invitations" on public.invitations
  for select
  using (public.is_superadmin());

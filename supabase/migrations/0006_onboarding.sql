-- Auto-enroll new users into default tenant and allow creating a new tenant at signup

-- Default tenant id used across the app
do $$ begin
  perform 1 from public.tenants where id = '00000000-0000-0000-0000-000000000001';
  if not found then
    insert into public.tenants (id, name) values ('00000000-0000-0000-0000-000000000001', 'Default Tenant');
  end if;
end $$;

-- Trigger: after a profile is created, add membership to default tenant as member
create or replace function public.handle_new_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (tenant_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.user_id, 'member')
  on conflict (tenant_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_add_membership on public.profiles;
create trigger on_profile_created_add_membership
  after insert on public.profiles
  for each row execute function public.handle_new_profile_membership();

-- Allow authenticated users to create tenants
drop policy if exists "insert tenants" on public.tenants;
create policy "insert tenants" on public.tenants
  for insert
  with check (auth.uid() is not null);

-- Allow first member to claim ownership of a tenant (bootstrap ownership)
drop policy if exists "bootstrap owner membership" on public.memberships;
create policy "bootstrap owner membership" on public.memberships
  for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from public.memberships m2 where m2.tenant_id = memberships.tenant_id
    )
  );



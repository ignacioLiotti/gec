-- Auto-create profiles row when a new auth.users row is created

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing profiles (idempotent)
insert into public.profiles (user_id, full_name)
select u.id, null
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;



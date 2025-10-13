-- Seed data for local dev

-- Create a default tenant
insert into public.tenants (id, name)
values (
	'00000000-0000-0000-0000-000000000001',
	'Default Tenant'
)
on conflict (id) do nothing;

-- Optionally link the current auth user when running in SQL editor (comment out if not applicable)
-- insert into public.profiles (user_id, full_name)
-- values (auth.uid(), 'Local Dev User')
-- on conflict (user_id) do nothing;

-- Optional membership of current user in default tenant
-- insert into public.memberships (tenant_id, user_id, role)
-- values ('00000000-0000-0000-0000-000000000001', auth.uid(), 'owner')
-- on conflict (tenant_id, user_id) do nothing;

-- Seed a few instruments under default tenant
insert into public.instruments (tenant_id, name)
values
('00000000-0000-0000-0000-000000000001', 'Guitar'),
('00000000-0000-0000-0000-000000000001', 'Piano'),
('00000000-0000-0000-0000-000000000001', 'Drums')
on conflict do nothing;




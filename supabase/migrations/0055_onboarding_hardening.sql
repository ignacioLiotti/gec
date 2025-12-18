-- Strengthen onboarding: prevent duplicate self-joins and keep inserts scoped to the current user.

drop policy if exists "self join tenant as member" on public.memberships;
create policy "self join tenant as member" on public.memberships
	for insert
	with check (
		user_id = auth.uid()
		and role = 'member'
		and not exists (
			select 1
			from public.memberships m
			where m.tenant_id = memberships.tenant_id
				and m.user_id = auth.uid()
		)
	);

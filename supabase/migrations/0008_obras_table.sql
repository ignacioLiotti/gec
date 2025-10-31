-- Tabla de obras con soporte multi-tenant y RLS

create table if not exists public.obras (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references public.tenants (id) on delete cascade,
	n integer not null,
	designacion_y_ubicacion text not null,
	sup_de_obra_m2 numeric not null default 0,
	entidad_contratante text not null,
	mes_basico_de_contrato text not null,
	iniciacion text not null,
	contrato_mas_ampliaciones numeric not null default 0,
	certificado_a_la_fecha numeric not null default 0,
	saldo_a_certificar numeric not null default 0,
	segun_contrato numeric not null default 0,
	prorrogas_acordadas numeric not null default 0,
	plazo_total numeric not null default 0,
	plazo_transc numeric not null default 0,
	porcentaje numeric not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint unique_obra_per_tenant unique (tenant_id, n)
);

create index if not exists obras_tenant_id_idx on public.obras (tenant_id);

create or replace function public.set_obras_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists obras_set_updated_at on public.obras;
create trigger obras_set_updated_at
before update on public.obras
for each row
execute function public.set_obras_updated_at();

alter table public.obras enable row level security;

drop policy if exists "read obras in tenant" on public.obras;
create policy "read obras in tenant" on public.obras
	for select using (public.is_member_of(tenant_id));

drop policy if exists "insert obras in tenant" on public.obras;
create policy "insert obras in tenant" on public.obras
	for insert with check (public.is_member_of(tenant_id));

drop policy if exists "update obras in tenant" on public.obras;
create policy "update obras in tenant" on public.obras
	for update using (public.is_member_of(tenant_id)) with check (public.is_member_of(tenant_id));

drop policy if exists "delete obras in tenant" on public.obras;
create policy "delete obras in tenant" on public.obras
	for delete using (public.is_member_of(tenant_id));

-- Add tenant awareness to pendiente_schedules

alter table public.pendiente_schedules
  add column if not exists tenant_id uuid references public.tenants(id);

update public.pendiente_schedules ps
set tenant_id = op.tenant_id
from public.obra_pendientes op
where ps.pendiente_id = op.id
  and ps.tenant_id is null;

alter table public.pendiente_schedules
  alter column tenant_id set not null;

create index if not exists pendiente_schedules_tenant_run_at_idx
  on public.pendiente_schedules(tenant_id, run_at);

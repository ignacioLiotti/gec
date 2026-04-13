-- Obra soft delete lifecycle with trash/history support

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS restore_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purge_job_id TEXT;

CREATE INDEX IF NOT EXISTS obras_restore_deadline_idx
  ON public.obras(tenant_id, restore_deadline_at)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.obra_deletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL,
  obra_n INTEGER,
  obra_name TEXT,
  delete_reason TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_email TEXT,
  restore_deadline_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_by_email TEXT,
  purged_at TIMESTAMPTZ,
  purged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purged_by_email TEXT,
  purge_job_id TEXT,
  purge_reason TEXT,
  status TEXT NOT NULL DEFAULT 'deleted' CHECK (status IN ('deleted', 'restored', 'expired', 'purged')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_deletes_tenant_deleted_idx
  ON public.obra_deletes(tenant_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS obra_deletes_tenant_status_idx
  ON public.obra_deletes(tenant_id, status, deleted_at DESC);

CREATE INDEX IF NOT EXISTS obra_deletes_tenant_deadline_idx
  ON public.obra_deletes(tenant_id, restore_deadline_at)
  WHERE restored_at IS NULL AND purged_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obra_deletes_active_unique_idx
  ON public.obra_deletes(tenant_id, obra_id)
  WHERE restored_at IS NULL AND purged_at IS NULL;

INSERT INTO public.obra_deletes (
  tenant_id,
  obra_id,
  obra_n,
  obra_name,
  delete_reason,
  deleted_at,
  deleted_by,
  restore_deadline_at,
  status,
  metadata
)
SELECT
  o.tenant_id,
  o.id,
  o.n,
  o.designacion_y_ubicacion,
  COALESCE(o.delete_reason, 'legacy_soft_delete'),
  o.deleted_at,
  o.deleted_by,
  COALESCE(o.restore_deadline_at, o.deleted_at + interval '30 days'),
  CASE
    WHEN COALESCE(o.restore_deadline_at, o.deleted_at + interval '30 days') <= now()
      THEN 'expired'
    ELSE 'deleted'
  END,
  jsonb_build_object('operation', 'legacy_backfill')
FROM public.obras o
WHERE o.deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.obra_deletes od
    WHERE od.tenant_id = o.tenant_id
      AND od.obra_id = o.id
      AND od.restored_at IS NULL
      AND od.purged_at IS NULL
  );

ALTER TABLE public.obra_deletes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_deletes_select" ON public.obra_deletes;
CREATE POLICY "obra_deletes_select"
  ON public.obra_deletes
  FOR SELECT
  USING (public.is_member_of(tenant_id));

DROP POLICY IF EXISTS "obra_deletes_insert" ON public.obra_deletes;
CREATE POLICY "obra_deletes_insert"
  ON public.obra_deletes
  FOR INSERT
  WITH CHECK (public.is_member_of(tenant_id));

DROP POLICY IF EXISTS "obra_deletes_update" ON public.obra_deletes;
CREATE POLICY "obra_deletes_update"
  ON public.obra_deletes
  FOR UPDATE
  USING (public.is_member_of(tenant_id))
  WITH CHECK (public.is_member_of(tenant_id));

DROP TRIGGER IF EXISTS obra_deletes_updated_at ON public.obra_deletes;
CREATE TRIGGER obra_deletes_updated_at
  BEFORE UPDATE ON public.obra_deletes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS audit_log_obra_deletes ON public.obra_deletes;
CREATE TRIGGER audit_log_obra_deletes
AFTER INSERT OR UPDATE OR DELETE ON public.obra_deletes
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

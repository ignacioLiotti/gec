-- Soft delete lifecycle for obra documents (files + folders)

CREATE TABLE IF NOT EXISTS public.obra_document_deletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'obra-documents',
  storage_path TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('file', 'folder')),
  root_folder_path TEXT,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_email TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recover_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_by_email TEXT,
  purged_at TIMESTAMPTZ,
  purged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purged_by_email TEXT,
  purge_job_id TEXT,
  purge_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_document_deletes_path_not_empty CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT obra_document_deletes_root_folder_consistency CHECK (
    (item_type = 'folder' AND root_folder_path IS NULL)
    OR item_type = 'file'
  )
);

ALTER TABLE public.obra_document_deletes
  ADD COLUMN IF NOT EXISTS deleted_by_email TEXT,
  ADD COLUMN IF NOT EXISTS restored_by_email TEXT,
  ADD COLUMN IF NOT EXISTS purged_by_email TEXT,
  ADD COLUMN IF NOT EXISTS purge_job_id TEXT;

CREATE INDEX IF NOT EXISTS obra_document_deletes_obra_deleted_idx
  ON public.obra_document_deletes(obra_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS obra_document_deletes_active_recover_idx
  ON public.obra_document_deletes(obra_id, recover_until)
  WHERE restored_at IS NULL AND purged_at IS NULL;

CREATE INDEX IF NOT EXISTS obra_document_deletes_active_lookup_idx
  ON public.obra_document_deletes(obra_id, storage_path, item_type)
  WHERE restored_at IS NULL;

CREATE INDEX IF NOT EXISTS obra_document_deletes_folder_children_idx
  ON public.obra_document_deletes(obra_id, root_folder_path)
  WHERE item_type = 'file' AND restored_at IS NULL AND purged_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obra_document_deletes_active_unique_idx
  ON public.obra_document_deletes(obra_id, item_type, storage_path)
  WHERE restored_at IS NULL AND purged_at IS NULL;

ALTER TABLE public.obra_document_deletes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_document_deletes_select" ON public.obra_document_deletes;
CREATE POLICY "obra_document_deletes_select"
  ON public.obra_document_deletes
  FOR SELECT
  USING (public.is_member_of(tenant_id));

DROP POLICY IF EXISTS "obra_document_deletes_insert" ON public.obra_document_deletes;
CREATE POLICY "obra_document_deletes_insert"
  ON public.obra_document_deletes
  FOR INSERT
  WITH CHECK (public.is_member_of(tenant_id));

DROP POLICY IF EXISTS "obra_document_deletes_update" ON public.obra_document_deletes;
CREATE POLICY "obra_document_deletes_update"
  ON public.obra_document_deletes
  FOR UPDATE
  USING (public.is_member_of(tenant_id))
  WITH CHECK (public.is_member_of(tenant_id));

DROP TRIGGER IF EXISTS obra_document_deletes_updated_at ON public.obra_document_deletes;
CREATE TRIGGER obra_document_deletes_updated_at
  BEFORE UPDATE ON public.obra_document_deletes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS audit_log_obra_document_deletes ON public.obra_document_deletes;
CREATE TRIGGER audit_log_obra_document_deletes
AFTER INSERT OR UPDATE OR DELETE ON public.obra_document_deletes
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

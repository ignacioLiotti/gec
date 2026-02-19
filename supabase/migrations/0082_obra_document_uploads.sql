-- Track uploads in obra-documents with explicit uploader + timestamp

CREATE TABLE IF NOT EXISTS public.obra_document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'obra-documents',
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_document_uploads_obra_idx
  ON public.obra_document_uploads(obra_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS obra_document_uploads_path_idx
  ON public.obra_document_uploads(storage_path);

ALTER TABLE public.obra_document_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_document_uploads_select" ON public.obra_document_uploads;
CREATE POLICY "obra_document_uploads_select"
  ON public.obra_document_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = obra_document_uploads.obra_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "obra_document_uploads_insert" ON public.obra_document_uploads;
CREATE POLICY "obra_document_uploads_insert"
  ON public.obra_document_uploads
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.obras o
      JOIN public.memberships m ON m.tenant_id = o.tenant_id
      WHERE o.id = obra_document_uploads.obra_id
        AND m.user_id = auth.uid()
    )
  );


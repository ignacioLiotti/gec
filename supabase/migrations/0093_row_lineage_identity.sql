ALTER TABLE public.obra_tabla_rows
  ADD COLUMN IF NOT EXISTS lineage_row_key TEXT,
  ADD COLUMN IF NOT EXISTS extraction_id UUID,
  ADD COLUMN IF NOT EXISTS materialization_version INTEGER NOT NULL DEFAULT 1;

UPDATE public.obra_tabla_rows
SET lineage_row_key = COALESCE(lineage_row_key, 'legacy:' || id::text)
WHERE lineage_row_key IS NULL;

ALTER TABLE public.obra_tabla_rows
  ALTER COLUMN lineage_row_key SET DEFAULT ('row:' || gen_random_uuid()::text),
  ALTER COLUMN lineage_row_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS obra_tabla_rows_lineage_idx
  ON public.obra_tabla_rows(tabla_id, lineage_row_key);

CREATE UNIQUE INDEX IF NOT EXISTS obra_tabla_rows_tabla_lineage_unique
  ON public.obra_tabla_rows(tabla_id, lineage_row_key);

CREATE INDEX IF NOT EXISTS obra_tabla_rows_extraction_id_idx
  ON public.obra_tabla_rows(extraction_id);

ALTER TABLE public.ocr_document_processing
  ADD COLUMN IF NOT EXISTS extraction_id UUID,
  ADD COLUMN IF NOT EXISTS file_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS content_fingerprint_normalized TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fingerprint_error JSONB;

ALTER TABLE public.ocr_document_processing
  DROP CONSTRAINT IF EXISTS ocr_document_processing_fingerprint_status_check;

ALTER TABLE public.ocr_document_processing
  ADD CONSTRAINT ocr_document_processing_fingerprint_status_check
  CHECK (fingerprint_status IN ('pending', 'completed', 'degraded', 'failed'));

UPDATE public.ocr_document_processing
SET
  extraction_id = COALESCE(extraction_id, id),
  fingerprint_status = CASE
    WHEN status = 'failed' THEN 'failed'
    WHEN file_fingerprint IS NOT NULL AND content_fingerprint_normalized IS NOT NULL THEN 'completed'
    WHEN file_fingerprint IS NOT NULL OR content_fingerprint_normalized IS NOT NULL THEN 'degraded'
    ELSE 'degraded'
  END
WHERE extraction_id IS NULL
   OR fingerprint_status IS NULL
   OR fingerprint_status = 'pending';

CREATE INDEX IF NOT EXISTS ocr_document_processing_extraction_id_idx
  ON public.ocr_document_processing(extraction_id);

CREATE INDEX IF NOT EXISTS ocr_document_processing_file_fingerprint_idx
  ON public.ocr_document_processing(file_fingerprint);

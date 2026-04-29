ALTER TABLE public.ocr_document_processing
  ADD COLUMN IF NOT EXISTS error_code TEXT NULL;

CREATE INDEX IF NOT EXISTS ocr_document_processing_error_code_idx
  ON public.ocr_document_processing(error_code);

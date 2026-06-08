-- Non-destructive indexes for fast document folder listing and thumbnail access.
-- These support the current /documents/list prefix queries and the new parallel UI.

CREATE INDEX IF NOT EXISTS obra_document_uploads_obra_storage_path_prefix_idx
  ON public.obra_document_uploads (obra_id, storage_path text_pattern_ops);

CREATE INDEX IF NOT EXISTS ocr_document_processing_obra_source_path_prefix_idx
  ON public.ocr_document_processing (obra_id, source_path text_pattern_ops, created_at DESC);

CREATE INDEX IF NOT EXISTS generated_documents_obra_storage_path_prefix_idx
  ON public.generated_documents (obra_id, storage_path text_pattern_ops, updated_at DESC);

CREATE INDEX IF NOT EXISTS aps_models_obra_file_path_prefix_idx
  ON public.aps_models (obra_id, file_path text_pattern_ops);

CREATE INDEX IF NOT EXISTS obra_document_deletes_active_tenant_obra_path_idx
  ON public.obra_document_deletes (tenant_id, obra_id, storage_path, item_type)
  WHERE restored_at IS NULL AND purged_at IS NULL;

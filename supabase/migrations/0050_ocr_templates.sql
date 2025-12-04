-- OCR Templates: Store template documents and extraction regions for automatic processing
-- When files are uploaded to linked folders, they are processed using these templates

-- Store OCR template documents with their extraction regions
CREATE TABLE IF NOT EXISTS public.ocr_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Template document stored in Supabase Storage
  template_bucket TEXT,
  template_path TEXT,
  template_file_name TEXT,
  -- Rendered image dimensions (for coordinate scaling)
  template_width INTEGER,
  template_height INTEGER,
  -- Extraction regions as JSON array
  regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Column definitions derived from regions
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Active status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocr_templates_name_unique UNIQUE (tenant_id, name)
);

-- Track OCR processed documents with their status
CREATE TABLE IF NOT EXISTS public.ocr_document_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_id UUID NOT NULL REFERENCES public.obra_tablas(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  -- Source document info
  source_bucket TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  -- Number of rows extracted
  rows_extracted INTEGER DEFAULT 0,
  -- OCR template used (if any)
  template_id UUID REFERENCES public.ocr_templates(id) ON DELETE SET NULL,
  -- Processing metadata
  processed_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocr_document_processing_unique UNIQUE (tabla_id, source_path)
);

-- Add template_id reference to obra_default_tablas
ALTER TABLE public.obra_default_tablas 
  ADD COLUMN IF NOT EXISTS ocr_template_id UUID REFERENCES public.ocr_templates(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS ocr_templates_tenant_idx ON public.ocr_templates(tenant_id);
CREATE INDEX IF NOT EXISTS ocr_document_processing_tabla_idx ON public.ocr_document_processing(tabla_id);
CREATE INDEX IF NOT EXISTS ocr_document_processing_status_idx ON public.ocr_document_processing(status);

-- Enable RLS
ALTER TABLE public.ocr_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_document_processing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocr_templates
CREATE POLICY "Users can view OCR templates for their tenant"
  ON public.ocr_templates
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage OCR templates for their tenant"
  ON public.ocr_templates
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for ocr_document_processing
CREATE POLICY "Users can view OCR document processing for their tenant"
  ON public.ocr_document_processing
  FOR SELECT
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage OCR document processing for their tenant"
  ON public.ocr_document_processing
  FOR ALL
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at triggers
CREATE TRIGGER ocr_templates_updated_at
  BEFORE UPDATE ON public.ocr_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER ocr_document_processing_updated_at
  BEFORE UPDATE ON public.ocr_document_processing
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();




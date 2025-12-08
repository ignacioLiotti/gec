-- Default folder and tabla templates for new obras
-- These are tenant-scoped configurations applied when a new obra is created

CREATE TABLE IF NOT EXISTS public.obra_default_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL, -- normalized path like "ordenes-de-compra" or "documentos/contratos"
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_default_folders_unique UNIQUE (tenant_id, path)
);

CREATE TABLE IF NOT EXISTS public.obra_default_tablas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'csv', 'ocr')),
  -- For OCR tablas: link to a default folder by path
  linked_folder_path TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_default_tablas_name_unique UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.obra_default_tabla_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_tabla_id UUID NOT NULL REFERENCES public.obra_default_tablas(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_default_tabla_columns_key_unique UNIQUE (default_tabla_id, field_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS obra_default_folders_tenant_idx ON public.obra_default_folders(tenant_id);
CREATE INDEX IF NOT EXISTS obra_default_tablas_tenant_idx ON public.obra_default_tablas(tenant_id);
CREATE INDEX IF NOT EXISTS obra_default_tabla_columns_tabla_idx ON public.obra_default_tabla_columns(default_tabla_id);

-- Enable RLS
ALTER TABLE public.obra_default_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_default_tablas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_default_tabla_columns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for obra_default_folders
CREATE POLICY "Users can view default folders for their tenant"
  ON public.obra_default_folders
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage default folders for their tenant"
  ON public.obra_default_folders
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

-- RLS Policies for obra_default_tablas
CREATE POLICY "Users can view default tablas for their tenant"
  ON public.obra_default_tablas
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage default tablas for their tenant"
  ON public.obra_default_tablas
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

-- RLS Policies for obra_default_tabla_columns
CREATE POLICY "Users can view default tabla columns for their tenant"
  ON public.obra_default_tabla_columns
  FOR SELECT
  USING (
    default_tabla_id IN (
      SELECT id FROM public.obra_default_tablas
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage default tabla columns for their tenant"
  ON public.obra_default_tabla_columns
  FOR ALL
  USING (
    default_tabla_id IN (
      SELECT id FROM public.obra_default_tablas
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    default_tabla_id IN (
      SELECT id FROM public.obra_default_tablas
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at triggers
CREATE TRIGGER obra_default_folders_updated_at
  BEFORE UPDATE ON public.obra_default_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER obra_default_tablas_updated_at
  BEFORE UPDATE ON public.obra_default_tablas
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER obra_default_tabla_columns_updated_at
  BEFORE UPDATE ON public.obra_default_tabla_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();




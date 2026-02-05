-- Macro Tables: Aggregate data from multiple obra_tablas across different obras
-- with configurable column selection and editable custom columns

-- Main macro table definitions (tenant-scoped)
CREATE TABLE IF NOT EXISTS public.macro_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT macro_tables_name_unique UNIQUE (tenant_id, name)
);

-- Links macro tables to specific obra_tablas
CREATE TABLE IF NOT EXISTS public.macro_table_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_table_id UUID NOT NULL REFERENCES public.macro_tables(id) ON DELETE CASCADE,
  obra_tabla_id UUID NOT NULL REFERENCES public.obra_tablas(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT macro_table_sources_unique UNIQUE (macro_table_id, obra_tabla_id)
);

-- Column definitions - can be source references, custom, or computed
CREATE TABLE IF NOT EXISTS public.macro_table_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_table_id UUID NOT NULL REFERENCES public.macro_tables(id) ON DELETE CASCADE,
  column_type TEXT NOT NULL DEFAULT 'source' CHECK (column_type IN ('source', 'custom', 'computed')),
  source_field_key TEXT, -- for source columns: the field_key from obra_tabla_columns
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- aggregation settings, formatting, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores editable custom column data (keyed by source row)
CREATE TABLE IF NOT EXISTS public.macro_table_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_table_id UUID NOT NULL REFERENCES public.macro_tables(id) ON DELETE CASCADE,
  source_row_id UUID NOT NULL, -- references obra_tabla_rows.id (no FK to allow flexibility)
  column_id UUID NOT NULL REFERENCES public.macro_table_columns(id) ON DELETE CASCADE,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT macro_table_custom_values_unique UNIQUE (macro_table_id, source_row_id, column_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS macro_tables_tenant_idx ON public.macro_tables(tenant_id);
CREATE INDEX IF NOT EXISTS macro_table_sources_macro_idx ON public.macro_table_sources(macro_table_id);
CREATE INDEX IF NOT EXISTS macro_table_sources_obra_tabla_idx ON public.macro_table_sources(obra_tabla_id);
CREATE INDEX IF NOT EXISTS macro_table_columns_macro_idx ON public.macro_table_columns(macro_table_id);
CREATE INDEX IF NOT EXISTS macro_table_custom_values_macro_idx ON public.macro_table_custom_values(macro_table_id);
CREATE INDEX IF NOT EXISTS macro_table_custom_values_row_idx ON public.macro_table_custom_values(source_row_id);

-- Enable RLS
ALTER TABLE public.macro_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_table_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_table_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_table_custom_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies for macro_tables
CREATE POLICY "Users can view macro tables for their tenant"
  ON public.macro_tables
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage macro tables for their tenant"
  ON public.macro_tables
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

-- RLS Policies for macro_table_sources
CREATE POLICY "Users can view macro table sources for their tenant"
  ON public.macro_table_sources
  FOR SELECT
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage macro table sources for their tenant"
  ON public.macro_table_sources
  FOR ALL
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for macro_table_columns
CREATE POLICY "Users can view macro table columns for their tenant"
  ON public.macro_table_columns
  FOR SELECT
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage macro table columns for their tenant"
  ON public.macro_table_columns
  FOR ALL
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for macro_table_custom_values
CREATE POLICY "Users can view macro table custom values for their tenant"
  ON public.macro_table_custom_values
  FOR SELECT
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage macro table custom values for their tenant"
  ON public.macro_table_custom_values
  FOR ALL
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at triggers
CREATE TRIGGER macro_tables_updated_at
  BEFORE UPDATE ON public.macro_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER macro_table_columns_updated_at
  BEFORE UPDATE ON public.macro_table_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER macro_table_custom_values_updated_at
  BEFORE UPDATE ON public.macro_table_custom_values
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();








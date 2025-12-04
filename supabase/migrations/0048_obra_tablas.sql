-- Dynamic tablas per obra
CREATE TABLE IF NOT EXISTS public.obra_tablas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'csv', 'ocr')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_tablas_name_unique UNIQUE (obra_id, name)
);

CREATE TABLE IF NOT EXISTS public.obra_tabla_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_id UUID NOT NULL REFERENCES public.obra_tablas(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text',
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_tabla_columns_key_unique UNIQUE (tabla_id, field_key)
);

CREATE TABLE IF NOT EXISTS public.obra_tabla_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_id UUID NOT NULL REFERENCES public.obra_tablas(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_tablas_obra_id_idx ON public.obra_tablas(obra_id);
CREATE INDEX IF NOT EXISTS obra_tabla_columns_tabla_id_idx ON public.obra_tabla_columns(tabla_id);
CREATE INDEX IF NOT EXISTS obra_tabla_rows_tabla_id_idx ON public.obra_tabla_rows(tabla_id);

ALTER TABLE public.obra_tablas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_tabla_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_tabla_rows ENABLE ROW LEVEL SECURITY;

-- Policies for tablas
CREATE POLICY "Users can view tablas from their tenant's obras"
  ON public.obra_tablas
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

CREATE POLICY "Users can manage tablas from their tenant's obras"
  ON public.obra_tablas
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

-- Columns inherit permissions via tabla_id
CREATE POLICY "Users can view tabla columns within their tenant"
  ON public.obra_tabla_columns
  FOR SELECT
  USING (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage tabla columns within their tenant"
  ON public.obra_tabla_columns
  FOR ALL
  USING (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Rows inherit permissions as well
CREATE POLICY "Users can view tabla rows within their tenant"
  ON public.obra_tabla_rows
  FOR SELECT
  USING (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage tabla rows within their tenant"
  ON public.obra_tabla_rows
  FOR ALL
  USING (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    tabla_id IN (
      SELECT id FROM public.obra_tablas
      WHERE obra_id IN (
        SELECT id FROM public.obras
        WHERE tenant_id IN (
          SELECT tenant_id FROM public.memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Updated at triggers
CREATE TRIGGER obra_tablas_updated_at
  BEFORE UPDATE ON public.obra_tablas
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER obra_tabla_columns_updated_at
  BEFORE UPDATE ON public.obra_tabla_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER obra_tabla_rows_updated_at
  BEFORE UPDATE ON public.obra_tabla_rows
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Create obras table
CREATE TABLE IF NOT EXISTS public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  designacion_y_ubicacion TEXT NOT NULL,
  sup_de_obra_m2 NUMERIC NOT NULL DEFAULT 0,
  entidad_contratante TEXT NOT NULL,
  mes_basico_de_contrato TEXT NOT NULL,
  iniciacion TEXT NOT NULL,
  contrato_mas_ampliaciones NUMERIC NOT NULL DEFAULT 0,
  certificado_a_la_fecha NUMERIC NOT NULL DEFAULT 0,
  saldo_a_certificar NUMERIC NOT NULL DEFAULT 0,
  segun_contrato INTEGER NOT NULL DEFAULT 0,
  prorrogas_acordadas INTEGER NOT NULL DEFAULT 0,
  plazo_total INTEGER NOT NULL DEFAULT 0,
  plazo_transc INTEGER NOT NULL DEFAULT 0,
  porcentaje NUMERIC NOT NULL DEFAULT 0 CHECK (porcentaje >= 0 AND porcentaje <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on tenant_id for faster queries
CREATE INDEX IF NOT EXISTS obras_tenant_id_idx ON public.obras(tenant_id);

-- Create index on porcentaje to quickly find completed obras
CREATE INDEX IF NOT EXISTS obras_porcentaje_idx ON public.obras(porcentaje);

-- Enable RLS
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- RLS Policies for obras
CREATE POLICY "Users can view obras from their tenant"
  ON public.obras
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert obras in their tenant"
  ON public.obras
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update obras in their tenant"
  ON public.obras
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete obras in their tenant"
  ON public.obras
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_obras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_obras_updated_at_trigger
  BEFORE UPDATE ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION update_obras_updated_at();

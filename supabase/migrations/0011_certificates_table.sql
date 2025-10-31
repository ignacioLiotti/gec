-- Create certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  n_exp TEXT NOT NULL,
  n_certificado INTEGER NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  mes TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'CERTIFICADO',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on obra_id for faster queries
CREATE INDEX IF NOT EXISTS certificates_obra_id_idx ON public.certificates(obra_id);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for certificates
CREATE POLICY "Users can view certificates from their tenant's obras"
  ON public.certificates
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

CREATE POLICY "Users can insert certificates in their tenant's obras"
  ON public.certificates
  FOR INSERT
  WITH CHECK (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update certificates in their tenant's obras"
  ON public.certificates
  FOR UPDATE
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete certificates in their tenant's obras"
  ON public.certificates
  FOR DELETE
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_certificates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_certificates_updated_at_trigger
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_certificates_updated_at();

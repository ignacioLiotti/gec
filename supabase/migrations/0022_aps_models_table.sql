-- Create table to store APS URN mappings for 3D models
CREATE TABLE IF NOT EXISTS public.aps_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Path in storage: obraId/folder/filename
  file_name TEXT NOT NULL,
  aps_urn TEXT NOT NULL, -- Base64-encoded objectId from APS
  aps_object_id TEXT, -- Original objectId from APS
  status TEXT DEFAULT 'processing', -- processing, success, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(file_path)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS aps_models_obra_id_idx ON public.aps_models(obra_id);
CREATE INDEX IF NOT EXISTS aps_models_file_path_idx ON public.aps_models(file_path);
CREATE INDEX IF NOT EXISTS aps_models_urn_idx ON public.aps_models(aps_urn);

-- RLS policies
ALTER TABLE public.aps_models ENABLE ROW LEVEL SECURITY;

-- Users can view models from obras they belong to
CREATE POLICY "Users can view APS models from their obras"
  ON public.aps_models
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = aps_models.obra_id
      AND o.tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can insert models for obras they belong to
CREATE POLICY "Users can insert APS models for their obras"
  ON public.aps_models
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = aps_models.obra_id
      AND o.tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update models from their obras
CREATE POLICY "Users can update APS models from their obras"
  ON public.aps_models
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = aps_models.obra_id
      AND o.tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete models from their obras
CREATE POLICY "Users can delete APS models from their obras"
  ON public.aps_models
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      WHERE o.id = aps_models.obra_id
      AND o.tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add comment for documentation
COMMENT ON TABLE public.aps_models IS 'Stores Autodesk Platform Services URN mappings for 3D model files';

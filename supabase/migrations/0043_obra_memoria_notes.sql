-- Notes / "memoria" for each obra, stored per user
CREATE TABLE IF NOT EXISTS public.obra_memoria_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_memoria_notes_obra_id_idx ON public.obra_memoria_notes(obra_id);
CREATE INDEX IF NOT EXISTS obra_memoria_notes_user_id_idx ON public.obra_memoria_notes(user_id);

-- Enable RLS
ALTER TABLE public.obra_memoria_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes for obras in tenants where they are members
CREATE POLICY "Users can view obra memoria notes in their tenant's obras"
  ON public.obra_memoria_notes
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

-- Users can insert notes only for obras in tenants where they are members,
-- and notes are always attributed to the authenticated user.
CREATE POLICY "Users can insert obra memoria notes in their tenant's obras"
  ON public.obra_memoria_notes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update their own notes in their tenant's obras
CREATE POLICY "Users can update their own obra memoria notes"
  ON public.obra_memoria_notes
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete their own notes in their tenant's obras
CREATE POLICY "Users can delete their own obra memoria notes"
  ON public.obra_memoria_notes
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND obra_id IN (
      SELECT id FROM public.obras
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );








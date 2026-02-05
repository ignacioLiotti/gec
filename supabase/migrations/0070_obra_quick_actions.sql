-- Tenant-configured quick actions for obra dashboards

CREATE TABLE IF NOT EXISTS public.obra_default_quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  folder_paths TEXT[] NOT NULL DEFAULT '{}'::text[],
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_default_quick_actions_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS obra_default_quick_actions_tenant_idx
  ON public.obra_default_quick_actions(tenant_id);

ALTER TABLE public.obra_default_quick_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quick actions for their tenant"
  ON public.obra_default_quick_actions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage quick actions for their tenant"
  ON public.obra_default_quick_actions
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

CREATE TRIGGER obra_default_quick_actions_updated_at
  BEFORE UPDATE ON public.obra_default_quick_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

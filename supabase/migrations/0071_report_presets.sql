-- Report presets, templates, and share links

CREATE TABLE IF NOT EXISTS public.report_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_presets_name_unique UNIQUE (tenant_id, report_key, name)
);

CREATE INDEX IF NOT EXISTS report_presets_tenant_idx
  ON public.report_presets(tenant_id);

CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_templates_name_unique UNIQUE (tenant_id, report_key, name)
);

CREATE INDEX IF NOT EXISTS report_templates_tenant_idx
  ON public.report_templates(tenant_id);

CREATE TABLE IF NOT EXISTS public.report_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  preset_id UUID REFERENCES public.report_presets(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_share_links_tenant_idx
  ON public.report_share_links(tenant_id);

ALTER TABLE public.report_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view report presets for their tenant"
  ON public.report_presets
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage report presets for their tenant"
  ON public.report_presets
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

CREATE POLICY "Users can view report templates for their tenant"
  ON public.report_templates
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage report templates for their tenant"
  ON public.report_templates
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

CREATE POLICY "Users can view report share links for their tenant"
  ON public.report_share_links
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage report share links for their tenant"
  ON public.report_share_links
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

CREATE TRIGGER report_presets_updated_at
  BEFORE UPDATE ON public.report_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

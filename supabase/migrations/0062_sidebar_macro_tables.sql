-- Sidebar visibility for macro tables per role
-- This allows admins to configure which macro tables appear in the sidebar for each role

-- Junction table between roles and macro_tables for sidebar visibility
CREATE TABLE IF NOT EXISTS public.sidebar_macro_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  macro_table_id UUID NOT NULL REFERENCES public.macro_tables(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sidebar_macro_tables_unique UNIQUE (role_id, macro_table_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS sidebar_macro_tables_role_idx ON public.sidebar_macro_tables(role_id);
CREATE INDEX IF NOT EXISTS sidebar_macro_tables_macro_idx ON public.sidebar_macro_tables(macro_table_id);

-- Enable RLS
ALTER TABLE public.sidebar_macro_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sidebar macro tables for their tenant roles"
  ON public.sidebar_macro_tables
  FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage sidebar macro tables for their tenant roles"
  ON public.sidebar_macro_tables
  FOR ALL
  USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM public.roles
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Helper function to get sidebar macro tables for a user
CREATE OR REPLACE FUNCTION public.get_user_sidebar_macro_tables(p_user_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  macro_table_id UUID,
  macro_table_name TEXT,
  sort_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    mt.id AS macro_table_id,
    mt.name AS macro_table_name,
    COALESCE(MIN(smt.position), 0) AS sort_position
  FROM public.macro_tables mt
  INNER JOIN public.sidebar_macro_tables smt ON smt.macro_table_id = mt.id
  INNER JOIN public.user_roles ur ON ur.role_id = smt.role_id
  WHERE ur.user_id = p_user_id
    AND ur.tenant_id = p_tenant_id
    AND mt.tenant_id = p_tenant_id
  GROUP BY mt.id, mt.name
  ORDER BY sort_position, mt.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

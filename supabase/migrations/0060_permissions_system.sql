-- Enhanced Permissions System
-- Adds visual role management, per-macro-table permissions, and role templates

-- =====================================================
-- 1. ENHANCE EXISTING TABLES
-- =====================================================

-- Add new columns to permissions table
ALTER TABLE public.permissions
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Add new columns to roles table
ALTER TABLE public.roles
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1',
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 2. CREATE MACRO TABLE PERMISSIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.macro_table_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_table_id UUID NOT NULL REFERENCES public.macro_tables(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'edit', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Either user_id or role_id must be set, not both
  CONSTRAINT macro_table_permissions_target_check CHECK (
    (user_id IS NOT NULL AND role_id IS NULL) OR
    (user_id IS NULL AND role_id IS NOT NULL)
  )
);

-- Unique constraints for user and role assignments
CREATE UNIQUE INDEX IF NOT EXISTS macro_table_permissions_user_unique
  ON public.macro_table_permissions(macro_table_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS macro_table_permissions_role_unique
  ON public.macro_table_permissions(macro_table_id, role_id) WHERE role_id IS NOT NULL;

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS macro_table_permissions_macro_idx ON public.macro_table_permissions(macro_table_id);
CREATE INDEX IF NOT EXISTS macro_table_permissions_user_idx ON public.macro_table_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS macro_table_permissions_role_idx ON public.macro_table_permissions(role_id) WHERE role_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.macro_table_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view macro table permissions for their tenant"
  ON public.macro_table_permissions
  FOR SELECT
  USING (
    macro_table_id IN (
      SELECT id FROM public.macro_tables
      WHERE tenant_id IN (
        SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage macro table permissions"
  ON public.macro_table_permissions
  FOR ALL
  USING (
    macro_table_id IN (
      SELECT mt.id FROM public.macro_tables mt
      WHERE public.is_admin_of(mt.tenant_id)
    )
  )
  WITH CHECK (
    macro_table_id IN (
      SELECT mt.id FROM public.macro_tables mt
      WHERE public.is_admin_of(mt.tenant_id)
    )
  );

-- =====================================================
-- 3. CREATE ROLE TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role templates are global, no RLS needed (read-only for users)
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role templates"
  ON public.role_templates
  FOR SELECT
  USING (true);

-- Only superadmins can modify templates (handled at application level)

-- =====================================================
-- 4. HELPER FUNCTION FOR MACRO TABLE PERMISSIONS
-- =====================================================

-- Check if user has specific permission level on a macro table
CREATE OR REPLACE FUNCTION public.has_macro_table_permission(
  p_macro_table_id UUID,
  p_required_level TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_level TEXT;
  v_role_level TEXT;
  v_level_order INTEGER;
  v_required_order INTEGER;
BEGIN
  -- Get the tenant for this macro table
  SELECT tenant_id INTO v_tenant_id
  FROM public.macro_tables
  WHERE id = p_macro_table_id;

  IF v_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmins and tenant admins always have full access
  IF public.is_superadmin() OR public.is_admin_of(v_tenant_id) THEN
    RETURN TRUE;
  END IF;

  -- Check if user is a member of the tenant at all
  IF NOT public.is_member_of(v_tenant_id) THEN
    RETURN FALSE;
  END IF;

  -- Define level hierarchy (admin > edit > read)
  v_required_order := CASE p_required_level
    WHEN 'read' THEN 1
    WHEN 'edit' THEN 2
    WHEN 'admin' THEN 3
    ELSE 0
  END;

  -- Check direct user permission
  SELECT permission_level INTO v_user_level
  FROM public.macro_table_permissions
  WHERE macro_table_id = p_macro_table_id
    AND user_id = auth.uid();

  IF v_user_level IS NOT NULL THEN
    v_level_order := CASE v_user_level
      WHEN 'read' THEN 1
      WHEN 'edit' THEN 2
      WHEN 'admin' THEN 3
      ELSE 0
    END;
    IF v_level_order >= v_required_order THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Check through roles
  SELECT MAX(
    CASE mtp.permission_level
      WHEN 'read' THEN 1
      WHEN 'edit' THEN 2
      WHEN 'admin' THEN 3
      ELSE 0
    END
  ) INTO v_level_order
  FROM public.macro_table_permissions mtp
  JOIN public.user_roles ur ON ur.role_id = mtp.role_id
  WHERE mtp.macro_table_id = p_macro_table_id
    AND ur.user_id = auth.uid();

  RETURN COALESCE(v_level_order, 0) >= v_required_order;
END;
$$;

-- =====================================================
-- 5. SEED PERMISSIONS
-- =====================================================

-- Update existing permissions and add new ones
INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  -- Navigation permissions
  ('nav:dashboard', 'Access to Dashboard', 'navigation', 'Dashboard', 0),
  ('nav:excel', 'Access to Obras listing', 'navigation', 'Excel/Obras', 10),
  ('nav:certificados', 'Access to Certificates section', 'navigation', 'Certificados', 20),
  ('nav:macro', 'Access to Macro Tables section', 'navigation', 'Macro Tablas', 30),
  ('nav:notifications', 'Access to Notifications', 'navigation', 'Notificaciones', 40),
  ('nav:admin', 'Access to Admin section', 'navigation', 'Administracion', 100),

  -- Obras permissions
  ('obras:read', 'View obras and their data', 'obras', 'Ver Obras', 0),
  ('obras:edit', 'Edit obra data and tables', 'obras', 'Editar Obras', 1),
  ('obras:admin', 'Full obra management including delete', 'obras', 'Administrar Obras', 2),

  -- Certificates permissions
  ('certificados:read', 'View certificates', 'certificados', 'Ver Certificados', 0),
  ('certificados:edit', 'Create and edit certificates', 'certificados', 'Editar Certificados', 1),
  ('certificados:admin', 'Full certificate management', 'certificados', 'Administrar Certificados', 2),

  -- Macro table permissions (global, per-table handled separately)
  ('macro:read', 'View macro tables (global access)', 'macro', 'Ver Macro Tablas', 0),
  ('macro:edit', 'Edit macro table data (global access)', 'macro', 'Editar Macro Tablas', 1),
  ('macro:admin', 'Configure and manage macro tables', 'macro', 'Administrar Macro Tablas', 2),

  -- Admin permissions
  ('admin:users', 'Manage tenant users', 'admin', 'Gestionar Usuarios', 0),
  ('admin:roles', 'Manage roles and permissions', 'admin', 'Gestionar Roles', 1),
  ('admin:audit', 'View audit logs', 'admin', 'Ver Auditoria', 2),
  ('admin:settings', 'Manage tenant settings', 'admin', 'Configuracion', 3)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

-- =====================================================
-- 6. SEED ROLE TEMPLATES
-- =====================================================

INSERT INTO public.role_templates (key, name, description, permissions, is_system)
VALUES
  (
    'viewer',
    'Viewer',
    'Can view all data but cannot make changes. Ideal for stakeholders who need read-only access.',
    '["nav:dashboard", "nav:excel", "nav:certificados", "nav:macro", "nav:notifications", "obras:read", "certificados:read", "macro:read"]'::jsonb,
    true
  ),
  (
    'editor',
    'Editor',
    'Can view and edit data in most sections. Cannot access admin functions.',
    '["nav:dashboard", "nav:excel", "nav:certificados", "nav:macro", "nav:notifications", "obras:read", "obras:edit", "certificados:read", "certificados:edit", "macro:read", "macro:edit"]'::jsonb,
    true
  ),
  (
    'obra_manager',
    'Obra Manager',
    'Full control over obras and projects. Can view certificates but not edit them.',
    '["nav:dashboard", "nav:excel", "nav:certificados", "nav:notifications", "obras:read", "obras:edit", "obras:admin", "certificados:read"]'::jsonb,
    true
  ),
  (
    'accountant',
    'Accountant',
    'Specialized access for accounting tasks. Full certificate management with obra viewing.',
    '["nav:dashboard", "nav:excel", "nav:certificados", "nav:notifications", "obras:read", "certificados:read", "certificados:edit", "certificados:admin"]'::jsonb,
    true
  ),
  (
    'macro_analyst',
    'Macro Analyst',
    'Focused on macro table analysis and reporting. Full macro table access.',
    '["nav:dashboard", "nav:macro", "nav:notifications", "macro:read", "macro:edit", "macro:admin"]'::jsonb,
    true
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- =====================================================
-- 7. UPDATE has_permission TO CHECK NEW PERMISSIONS
-- =====================================================

-- Update the has_permission function to handle the new permission structure
CREATE OR REPLACE FUNCTION public.has_permission(tenant uuid, perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(
      -- Superadmin has all permissions
      (SELECT true WHERE public.is_superadmin())
      OR
      -- Owner/Admin of tenant have all permissions
      (SELECT true WHERE public.is_admin_of(tenant))
      OR
      -- Direct user permission grant
      (
        EXISTS (
          SELECT 1
          FROM public.user_permission_overrides upo
          JOIN public.permissions p ON p.id = upo.permission_id
          WHERE upo.user_id = auth.uid() AND upo.is_granted = true AND p.key = perm_key
        )
      )
      OR
      -- Through any role assigned to user, scoped to this tenant
      (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = auth.uid()
            AND r.tenant_id = tenant
            AND p.key = perm_key
        )
      )
    , false);
$$;

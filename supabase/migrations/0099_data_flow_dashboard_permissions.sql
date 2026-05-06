-- Data-flow and dashboard permission keys.

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  ('data-flow:read', 'View data-flow graphs and configuration for the tenant and obras', 'data-flow', 'Ver data-flow', 0),
  ('data-flow:edit', 'Edit obra-level data-flow overrides and calculations', 'data-flow', 'Editar data-flow de obra', 1),
  ('data-flow:tenant-edit', 'Edit tenant-level data-flow defaults inherited by obras', 'data-flow', 'Editar data-flow general', 2)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;

UPDATE public.permissions
SET
  category = 'navigation',
  display_name = 'Dashboard',
  sort_order = 0,
  description = 'Access to Dashboard'
WHERE key = 'nav:dashboard';

INSERT INTO public.role_templates (key, name, description, permissions, is_system)
VALUES
  (
    'data_flow_viewer',
    'Data Flow Viewer',
    'Can view data-flow graphs and dashboard navigation without editing calculations.',
    '["nav:dashboard", "nav:excel", "data-flow:read", "obras:read"]'::jsonb,
    true
  ),
  (
    'data_flow_editor',
    'Data Flow Editor',
    'Can view and edit obra-level data-flow overrides and calculations.',
    '["nav:dashboard", "nav:excel", "data-flow:read", "data-flow:edit", "obras:read"]'::jsonb,
    true
  ),
  (
    'data_flow_admin',
    'Data Flow Admin',
    'Can manage tenant-level data-flow defaults and obra-level overrides.',
    '["nav:dashboard", "nav:excel", "data-flow:read", "data-flow:edit", "data-flow:tenant-edit", "obras:read"]'::jsonb,
    true
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

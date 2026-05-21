-- Fine-grained admin configuration permissions.
-- These allow custom roles to access specific admin configuration pages
-- without granting full tenant admin/owner membership.

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  (
    'admin:obra-defaults',
    'Manage tenant obra defaults and reporting defaults',
    'admin',
    'Configuracion de Obras',
    4
  ),
  (
    'admin:main-table-config',
    'Manage main obras table columns and options',
    'admin',
    'Tabla Principal',
    5
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order;


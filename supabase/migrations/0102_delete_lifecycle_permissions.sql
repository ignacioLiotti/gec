-- Fine-grained destructive permissions for obras and document manager items.

UPDATE public.permissions
SET description = 'Full obra management'
WHERE key = 'obras:admin'
  AND description = 'Full obra management including delete';

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  ('obras:delete', 'Send obras to trash', 'obras', 'Borrar Obras', 3),
  ('documents:delete:file', 'Send document files to trash', 'documents', 'Borrar Archivos', 30),
  ('documents:delete:folder', 'Send document folders to trash', 'documents', 'Borrar Carpetas', 31)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order;

-- Preserve existing "full obra management" roles by granting the new explicit
-- delete capabilities to roles that already had obras:admin.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old ON p_old.id = rp.permission_id
JOIN public.permissions p_new ON p_new.key IN (
  'obras:delete',
  'documents:delete:file',
  'documents:delete:folder'
)
WHERE p_old.key = 'obras:admin'
ON CONFLICT DO NOTHING;

UPDATE public.role_templates
SET permissions = (
  SELECT jsonb_agg(DISTINCT value ORDER BY value)
  FROM jsonb_array_elements_text(
    COALESCE(role_templates.permissions, '[]'::jsonb)
    || '["obras:delete", "documents:delete:file", "documents:delete:folder"]'::jsonb
  ) AS value
)
WHERE key = 'obra_manager';

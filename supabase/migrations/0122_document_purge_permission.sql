-- Dedicated permission for permanent document purge from history.

INSERT INTO public.permissions (key, description, category, display_name, sort_order)
VALUES
  (
    'documents:purge',
    'Permanently delete document files from storage',
    'documents',
    'Purgar Documentos',
    32
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order;

-- Preserve existing broad obra-management roles without granting purge to every
-- role that can merely send folders to trash.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old ON p_old.id = rp.permission_id
JOIN public.permissions p_new ON p_new.key = 'documents:purge'
WHERE p_old.key = 'obras:admin'
ON CONFLICT DO NOTHING;

UPDATE public.role_templates
SET permissions = (
  SELECT jsonb_agg(DISTINCT value ORDER BY value)
  FROM jsonb_array_elements_text(
    COALESCE(role_templates.permissions, '[]'::jsonb)
    || '["documents:purge"]'::jsonb
  ) AS value
)
WHERE key = 'obra_manager';

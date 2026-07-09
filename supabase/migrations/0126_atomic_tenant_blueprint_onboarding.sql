-- Atomic, invitation-safe tenant onboarding with a versioned configuration blueprint.
-- This migration is intentionally authored for manual application; do not auto-run it.

DROP POLICY IF EXISTS "self join tenant as member" ON public.memberships;

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS TABLE (tenant_id UUID, tenant_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_email TEXT;
  v_invitation public.invitations%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT lower(trim(account.email))
  INTO v_actor_email
  FROM auth.users account
  WHERE account.id = v_actor_id;

  SELECT invitation.*
  INTO v_invitation
  FROM public.invitations invitation
  WHERE invitation.token = p_token
    AND invitation.status = 'pending'
    AND invitation.expires_at > now()
    AND lower(trim(invitation.email)) = v_actor_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or email-mismatched invitation'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (
    v_invitation.tenant_id,
    v_actor_id,
    v_invitation.invited_role::public.membership_role
  )
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  UPDATE public.invitations
  SET
    status = 'accepted',
    accepted_at = now(),
    accepted_by = v_actor_id
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT tenant.id, tenant.name
  FROM public.tenants tenant
  WHERE tenant.id = v_invitation.tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_tenant_from_blueprint(
  p_name TEXT,
  p_blueprint JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_tenant_id UUID;
  v_name TEXT := regexp_replace(trim(COALESCE(p_name, '')), '\s+', ' ', 'g');
  v_item JSONB;
  v_column JSONB;
  v_table_id UUID;
  v_role_id UUID;
  v_macro_id UUID;
  v_source_table_id UUID;
  v_template_permissions JSONB;
  v_table_ids JSONB := '{}'::jsonb;
  v_role_ids UUID[] := '{}'::uuid[];
  v_macro_ids UUID[] := '{}'::uuid[];
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) < 3 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Tenant name must contain between 3 and 120 characters'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_blueprint->>'key', '') <> 'standard-construction'
    OR COALESCE((p_blueprint->>'version')::INTEGER, 0) <> 1 THEN
    RAISE EXCEPTION 'Unsupported tenant blueprint' USING ERRCODE = '22023';
  END IF;

  IF octet_length(p_blueprint::TEXT) > 150000
    OR jsonb_array_length(COALESCE(p_blueprint->'mainTableColumns', '[]'::jsonb)) <> 15
    OR jsonb_array_length(COALESCE(p_blueprint->'folders', '[]'::jsonb)) <> 8
    OR jsonb_array_length(COALESCE(p_blueprint->'tables', '[]'::jsonb)) <> 2
    OR jsonb_array_length(COALESCE(p_blueprint->'roles', '[]'::jsonb)) <> 3
    OR jsonb_array_length(COALESCE(p_blueprint->'macros', '[]'::jsonb)) <> 3 THEN
    RAISE EXCEPTION 'Incomplete tenant blueprint' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenants (name)
  VALUES (v_name)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_actor_id, 'owner');

  INSERT INTO public.tenant_main_table_configs (tenant_id, columns, updated_by)
  VALUES (v_tenant_id, p_blueprint->'mainTableColumns', v_actor_id);

  INSERT INTO public.tenant_data_flow_config (tenant_id, config_json, updated_by)
  VALUES (v_tenant_id, COALESCE(p_blueprint->'dataFlowConfig', '{}'::jsonb), v_actor_id);

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_blueprint->'folders')
  LOOP
    IF COALESCE(v_item->>'name', '') = '' OR COALESCE(v_item->>'path', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'Invalid blueprint folder' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.obra_default_folders (tenant_id, name, path, position)
    VALUES (
      v_tenant_id,
      v_item->>'name',
      v_item->>'path',
      COALESCE((v_item->>'position')::INTEGER, 0)
    );
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_blueprint->'tables')
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.obra_default_folders folder
      WHERE folder.tenant_id = v_tenant_id
        AND folder.path = v_item->>'linkedFolderPath'
    ) THEN
      RAISE EXCEPTION 'Blueprint table references an unknown folder' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.obra_default_tablas (
      tenant_id,
      name,
      description,
      source_type,
      linked_folder_path,
      settings,
      position
    )
    VALUES (
      v_tenant_id,
      v_item->>'name',
      NULLIF(v_item->>'description', ''),
      'ocr',
      v_item->>'linkedFolderPath',
      COALESCE(v_item->'settings', '{}'::jsonb),
      COALESCE((v_item->>'position')::INTEGER, 0)
    )
    RETURNING id INTO v_table_id;

    v_table_ids := v_table_ids || jsonb_build_object(v_item->>'key', v_table_id::TEXT);

    FOR v_column IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_item->'columns', '[]'::jsonb))
    LOOP
      INSERT INTO public.obra_default_tabla_columns (
        default_tabla_id,
        field_key,
        label,
        data_type,
        position,
        required,
        config
      )
      VALUES (
        v_table_id,
        v_column->>'fieldKey',
        v_column->>'label',
        COALESCE(v_column->>'dataType', 'text'),
        COALESCE((v_column->>'position')::INTEGER, 0),
        COALESCE((v_column->>'required')::BOOLEAN, FALSE),
        '{}'::jsonb
      );
    END LOOP;
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_blueprint->'quickActions', '[]'::jsonb))
  LOOP
    INSERT INTO public.obra_default_quick_actions (
      tenant_id,
      name,
      description,
      folder_paths,
      position
    )
    VALUES (
      v_tenant_id,
      v_item->>'name',
      NULLIF(v_item->>'description', ''),
      ARRAY(
        SELECT jsonb_array_elements_text(COALESCE(v_item->'folderPaths', '[]'::jsonb))
      ),
      COALESCE((v_item->>'position')::INTEGER, 0)
    );
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_blueprint->'roles')
  LOOP
    SELECT template.permissions
    INTO v_template_permissions
    FROM public.role_templates template
    WHERE template.key = v_item->>'templateKey';

    IF v_template_permissions IS NULL THEN
      RAISE EXCEPTION 'Required role template is unavailable: %', v_item->>'templateKey'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.roles (tenant_id, key, name, description, color, is_default)
    VALUES (
      v_tenant_id,
      NULL,
      v_item->>'name',
      NULLIF(v_item->>'description', ''),
      COALESCE(v_item->>'color', '#64748b'),
      FALSE
    )
    RETURNING id INTO v_role_id;

    v_role_ids := array_append(v_role_ids, v_role_id);

    INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
    SELECT v_role_id, permission.id, TRUE
    FROM public.permissions permission
    WHERE permission.key IN (
      SELECT jsonb_array_elements_text(v_template_permissions)
    )
    ON CONFLICT (role_id, permission_id) DO UPDATE SET is_granted = TRUE;
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_blueprint->'macros')
  LOOP
    v_source_table_id := NULLIF(v_table_ids->>(v_item->>'sourceTableKey'), '')::UUID;
    IF v_source_table_id IS NULL THEN
      RAISE EXCEPTION 'Blueprint macro references an unknown table' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.macro_tables (tenant_id, name, description, settings)
    VALUES (
      v_tenant_id,
      v_item->>'name',
      NULLIF(v_item->>'description', ''),
      jsonb_build_object(
        'sourceMode', 'template',
        'sourceTemplateId', v_source_table_id,
        'sourceTemplateName', (
          SELECT default_table.name
          FROM public.obra_default_tablas default_table
          WHERE default_table.id = v_source_table_id
        ),
        'sourceTemplateTableNames', jsonb_build_array(
          (
            SELECT default_table.name
            FROM public.obra_default_tablas default_table
            WHERE default_table.id = v_source_table_id
          )
        )
      )
    )
    RETURNING id INTO v_macro_id;

    v_macro_ids := array_append(v_macro_ids, v_macro_id);

    FOR v_column IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_item->'columns', '[]'::jsonb))
    LOOP
      INSERT INTO public.macro_table_columns (
        macro_table_id,
        column_type,
        source_field_key,
        label,
        data_type,
        position,
        config
      )
      VALUES (
        v_macro_id,
        'source',
        v_column->>'fieldKey',
        v_column->>'label',
        COALESCE(v_column->>'dataType', 'text'),
        COALESCE((v_column->>'position')::INTEGER, 0),
        '{"allowManualEdit": false}'::jsonb
      );
    END LOOP;
  END LOOP;

  INSERT INTO public.sidebar_macro_tables (role_id, macro_table_id, position)
  SELECT roles.role_id, macros.macro_id, (macros.macro_position - 1)::INTEGER
  FROM unnest(v_role_ids) AS roles(role_id)
  CROSS JOIN unnest(v_macro_ids) WITH ORDINALITY AS macros(macro_id, macro_position)
  ON CONFLICT (role_id, macro_table_id) DO NOTHING;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB) IS
  'Creates the tenant, owner membership and versioned standard setup atomically for the authenticated caller.';

COMMENT ON FUNCTION public.accept_tenant_invitation(TEXT) IS
  'Atomically validates an invitation against the authenticated email, creates the membership, and marks the invitation accepted.';

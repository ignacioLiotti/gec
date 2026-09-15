-- Members may create obras and materialize their organization's defaults.
-- SECURITY DEFINER setup functions retain authentication, active-obra ownership,
-- validation, and attempt-token checks. Tenant configuration permissions stay unchanged.
BEGIN;
DROP POLICY IF EXISTS "Users can insert obras with setup permission" ON public.obras;
CREATE POLICY "Tenant members can create obras"
  ON public.obras FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(tenant_id));

CREATE OR REPLACE FUNCTION public.begin_obra_setup_provisioning(
  p_obra_id UUID,
  p_materializer_version INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_attempt_id UUID := gen_random_uuid();
  v_blueprint_key TEXT;
  v_blueprint_version INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_materializer_version <> 1 THEN
    RAISE EXCEPTION 'Unsupported obra defaults materializer version'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    obra.tenant_id,
    tenant.setup_blueprint_key,
    tenant.setup_blueprint_version
  INTO v_tenant_id, v_blueprint_key, v_blueprint_version
  FROM public.obras obra
  JOIN public.tenants tenant ON tenant.id = obra.tenant_id
  WHERE obra.id = p_obra_id
    AND obra.deleted_at IS NULL;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active obra not found' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_member_of(v_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permission to prepare obra'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.obra_setup_provisioning AS existing (
    obra_id,
    source_blueprint_key,
    source_blueprint_version,
    materializer_version,
    status,
    attempt_id,
    attempt_count,
    started_at,
    finished_at,
    manifest,
    issues,
    updated_at
  )
  VALUES (
    p_obra_id,
    v_blueprint_key,
    v_blueprint_version,
    p_materializer_version,
    'running',
    v_attempt_id,
    1,
    now(),
    NULL,
    '{}'::JSONB,
    '[]'::JSONB,
    now()
  )
  ON CONFLICT (obra_id) DO UPDATE
  SET
    source_blueprint_key = EXCLUDED.source_blueprint_key,
    source_blueprint_version = EXCLUDED.source_blueprint_version,
    materializer_version = EXCLUDED.materializer_version,
    status = 'running',
    attempt_id = EXCLUDED.attempt_id,
    attempt_count = existing.attempt_count + 1,
    started_at = now(),
    finished_at = NULL,
    manifest = '{}'::JSONB,
    issues = '[]'::JSONB,
    updated_at = now();

  RETURN v_attempt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_obra_setup_provisioning(
  p_obra_id UUID,
  p_attempt_id UUID,
  p_status TEXT,
  p_manifest JSONB,
  p_issues JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('partial', 'ready')
    OR jsonb_typeof(COALESCE(p_manifest, '{}'::JSONB)) <> 'object'
    OR jsonb_typeof(COALESCE(p_issues, '[]'::JSONB)) <> 'array'
    OR octet_length(COALESCE(p_manifest, '{}'::JSONB)::TEXT)
      + octet_length(COALESCE(p_issues, '[]'::JSONB)::TEXT) > 150000 THEN
    RAISE EXCEPTION 'Invalid provisioning result' USING ERRCODE = '22023';
  END IF;

  SELECT obra.tenant_id
  INTO v_tenant_id
  FROM public.obras obra
  WHERE obra.id = p_obra_id
    AND obra.deleted_at IS NULL;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active obra not found' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_member_of(v_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permission to prepare obra'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.obra_setup_provisioning
  SET
    status = p_status,
    finished_at = now(),
    manifest = COALESCE(p_manifest, '{}'::JSONB),
    issues = COALESCE(p_issues, '[]'::JSONB),
    updated_at = now()
  WHERE obra_id = p_obra_id
    AND attempt_id = p_attempt_id;

  RETURN FOUND;
END;
$$;

COMMIT;

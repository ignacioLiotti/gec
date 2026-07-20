-- Persist blueprint provenance and additive obra setup health so onboarding
-- remains truthful after reloads and interrupted storage work. This migration
-- is authored for manual application and must not be run automatically.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS setup_blueprint_key TEXT,
  ADD COLUMN IF NOT EXISTS setup_blueprint_version INTEGER,
  ADD COLUMN IF NOT EXISTS setup_blueprint_hash TEXT,
  ADD COLUMN IF NOT EXISTS setup_blueprint_applied_at TIMESTAMPTZ;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_setup_blueprint_pair_check CHECK (
    (setup_blueprint_key IS NULL AND setup_blueprint_version IS NULL)
    OR (
      setup_blueprint_key IS NOT NULL
      AND setup_blueprint_version IS NOT NULL
      AND setup_blueprint_version > 0
    )
  ),
  ADD CONSTRAINT tenants_setup_blueprint_hash_check CHECK (
    setup_blueprint_hash IS NULL
    OR setup_blueprint_hash ~ '^[0-9a-f]{64}$'
  );

-- Preserve the already-applied v1 implementation as an internal primitive,
-- then wrap it so provenance is written in the same transaction.
ALTER FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB)
  RENAME TO create_tenant_from_blueprint_untracked;

CREATE FUNCTION public.create_tenant_from_blueprint(
  p_name TEXT,
  p_blueprint JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_materializer_version INTEGER := COALESCE(
    (p_blueprint->>'obraDefaultsMaterializerVersion')::INTEGER,
    1
  );
BEGIN
  IF v_materializer_version <> 1 THEN
    RAISE EXCEPTION 'Unsupported obra defaults materializer version'
      USING ERRCODE = '22023';
  END IF;

  v_tenant_id := public.create_tenant_from_blueprint_untracked(
    p_name,
    p_blueprint
  );

  UPDATE public.tenants
  SET
    setup_blueprint_key = p_blueprint->>'key',
    setup_blueprint_version = (p_blueprint->>'version')::INTEGER,
    setup_blueprint_hash = encode(digest(p_blueprint::TEXT, 'sha256'), 'hex'),
    setup_blueprint_applied_at = now()
  WHERE id = v_tenant_id;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_from_blueprint_untracked(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_from_blueprint(TEXT, JSONB)
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.obra_setup_provisioning (
  obra_id UUID PRIMARY KEY REFERENCES public.obras(id) ON DELETE CASCADE,
  source_blueprint_key TEXT,
  source_blueprint_version INTEGER,
  materializer_version INTEGER NOT NULL CHECK (materializer_version > 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'partial', 'ready')),
  attempt_id UUID NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  manifest JSONB NOT NULL DEFAULT '{}'::JSONB,
  issues JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obra_setup_manifest_object_check
    CHECK (jsonb_typeof(manifest) = 'object'),
  CONSTRAINT obra_setup_issues_array_check
    CHECK (jsonb_typeof(issues) = 'array'),
  CONSTRAINT obra_setup_payload_size_check
    CHECK (octet_length(manifest::TEXT) + octet_length(issues::TEXT) <= 150000)
);

ALTER TABLE public.obra_setup_provisioning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_obra_setup_provisioning"
  ON public.obra_setup_provisioning;
CREATE POLICY "members_read_obra_setup_provisioning"
  ON public.obra_setup_provisioning
  FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.obras obra
      WHERE obra.id = obra_setup_provisioning.obra_id
        AND public.is_member_of(obra.tenant_id)
    )
  );

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
  IF NOT public.is_superadmin()
    AND NOT (
      public.is_member_of(v_tenant_id)
      AND (
        public.has_permission(v_tenant_id, 'obras:edit')
        OR public.has_permission(v_tenant_id, 'admin:obra-defaults')
      )
    ) THEN
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
  IF NOT public.is_superadmin()
    AND NOT (
      public.is_member_of(v_tenant_id)
      AND (
        public.has_permission(v_tenant_id, 'obras:edit')
        OR public.has_permission(v_tenant_id, 'admin:obra-defaults')
      )
    ) THEN
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

REVOKE ALL ON FUNCTION public.begin_obra_setup_provisioning(UUID, INTEGER)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_obra_setup_provisioning(UUID, UUID, TEXT, JSONB, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_obra_setup_provisioning(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_obra_setup_provisioning(UUID, UUID, TEXT, JSONB, JSONB)
  TO authenticated;

COMMENT ON TABLE public.obra_setup_provisioning IS
  'Latest additive default-materialization attempt for an obra; used to resume onboarding honestly after reloads.';
COMMENT ON FUNCTION public.begin_obra_setup_provisioning(UUID, INTEGER) IS
  'Starts a versioned obra setup attempt and returns a token that prevents stale completion writes.';
COMMENT ON FUNCTION public.finish_obra_setup_provisioning(UUID, UUID, TEXT, JSONB, JSONB) IS
  'Finishes the current obra setup attempt as ready or partial when the attempt token still matches.';

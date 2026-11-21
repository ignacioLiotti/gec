-- pgcrypto may live outside the wrapper's restricted search path.
-- Built-in SHA256 preserves the UTF8 blueprint fingerprint without widening it.
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
    setup_blueprint_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_blueprint::TEXT, 'UTF8')),
      'hex'
    ),
    setup_blueprint_applied_at = now()
  WHERE id = v_tenant_id;

  RETURN v_tenant_id;
END;
$$;

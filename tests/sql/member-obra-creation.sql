-- Run with psql -v ON_ERROR_STOP=1 -f tests/sql/member-obra-creation.sql
-- against an empty disposable PostgreSQL database only.
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.memberships (user_id uuid, tenant_id uuid);
CREATE FUNCTION public.is_member_of(tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = auth.uid() AND tenant_id = tenant);
$$;
CREATE TABLE public.tenants (id uuid PRIMARY KEY, setup_blueprint_key text, setup_blueprint_version integer);
CREATE TABLE public.obras (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants, deleted_at timestamptz);
CREATE TABLE public.obra_setup_provisioning (
  obra_id uuid PRIMARY KEY, source_blueprint_key text, source_blueprint_version integer,
  materializer_version integer, status text, attempt_id uuid, attempt_count integer,
  started_at timestamptz, finished_at timestamptz, manifest jsonb, issues jsonb, updated_at timestamptz
);
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT INSERT, SELECT ON public.obras TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
CREATE POLICY member_read ON public.obras FOR SELECT TO authenticated USING (public.is_member_of(tenant_id));
INSERT INTO tenants VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'test', 1), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'test', 1);
INSERT INTO memberships VALUES ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO obras VALUES ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
INSERT INTO obras VALUES ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now());

\ir ../../supabase/migrations/0132_member_obra_creation.sql

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO obras VALUES ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
DO $$
DECLARE attempt uuid;
BEGIN
  attempt := public.begin_obra_setup_provisioning('aaaaaaaa-0000-4000-8000-000000000001',1);
  IF public.finish_obra_setup_provisioning('aaaaaaaa-0000-4000-8000-000000000001',gen_random_uuid(),'ready','{}','[]') THEN
    RAISE EXCEPTION 'Stale attempt was accepted';
  END IF;
  IF NOT public.finish_obra_setup_provisioning('aaaaaaaa-0000-4000-8000-000000000001',attempt,'ready','{}','[]') THEN
    RAISE EXCEPTION 'Member could not finish setup';
  END IF;
  BEGIN
    INSERT INTO obras VALUES (gen_random_uuid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
    RAISE EXCEPTION 'Cross-tenant insert was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.begin_obra_setup_provisioning('bbbbbbbb-0000-4000-8000-000000000001',1);
    RAISE EXCEPTION 'Cross-tenant setup was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.finish_obra_setup_provisioning('bbbbbbbb-0000-4000-8000-000000000001',attempt,'ready','{}','[]');
    RAISE EXCEPTION 'Cross-tenant finish was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.begin_obra_setup_provisioning('aaaaaaaa-0000-4000-8000-000000000002',1);
    RAISE EXCEPTION 'Deleted obra setup was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.begin_obra_setup_provisioning('aaaaaaaa-0000-4000-8000-000000000001',1);
    RAISE EXCEPTION 'Anonymous setup was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
SELECT 'PASS: member insert/setup, cross-tenant denials, deleted/anonymous denials, stale token protection' AS result;

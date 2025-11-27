-- Audit log infrastructure + certificate tenant scoping

-- Ensure certificates carry tenant ownership for auditing
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.certificates c
SET tenant_id = o.tenant_id
FROM public.obras o
WHERE c.tenant_id IS NULL AND o.id = c.obra_id;

ALTER TABLE public.certificates
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS certificates_tenant_id_idx
  ON public.certificates(tenant_id);

CREATE OR REPLACE FUNCTION public.set_certificates_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.obras
    WHERE id = NEW.obra_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS certificates_set_tenant_id ON public.certificates;
CREATE TRIGGER certificates_set_tenant_id
BEFORE INSERT OR UPDATE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.set_certificates_tenant_id();

-- Refresh RLS policies to rely on tenant_id
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view certificates from their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert certificates in their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can update certificates in their tenant's obras" ON public.certificates;
DROP POLICY IF EXISTS "Users can delete certificates in their tenant's obras" ON public.certificates;

CREATE POLICY "certificates select in tenant"
  ON public.certificates
  FOR SELECT
  USING (public.is_member_of(tenant_id));

CREATE POLICY "certificates insert in tenant"
  ON public.certificates
  FOR INSERT
  WITH CHECK (public.is_member_of(tenant_id));

CREATE POLICY "certificates update in tenant"
  ON public.certificates
  FOR UPDATE
  USING (public.is_member_of(tenant_id))
  WITH CHECK (public.is_member_of(tenant_id));

CREATE POLICY "certificates delete in tenant"
  ON public.certificates
  FOR DELETE
  USING (public.is_member_of(tenant_id));

-- =====================================================================
-- Audit log table + trigger helpers
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  table_name TEXT NOT NULL,
  row_pk JSONB NOT NULL DEFAULT '{}'::jsonb,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_keys TEXT[],
  before_data JSONB,
  after_data JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_table_idx
  ON public.audit_log(table_name, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit log insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit log select" ON public.audit_log;

CREATE POLICY "audit log insert"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "audit log select"
  ON public.audit_log
  FOR SELECT
  USING (
    tenant_id IS NOT NULL
    AND public.is_admin_of(tenant_id)
  );

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_row JSONB;
  old_row JSONB;
  actor UUID;
  actor_email TEXT;
  tenant UUID;
  tenant_hint TEXT := COALESCE(TG_ARGV[0], '');
  pk_hint TEXT := COALESCE(TG_ARGV[1], '');
  pk_cols TEXT[];
  pk JSONB := '{}'::jsonb;
  col TEXT;
  fk_parts TEXT[];
  fk_table TEXT;
  fk_column TEXT;
  fk_value UUID;
  changed TEXT[];
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    new_row := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    old_row := to_jsonb(OLD);
  END IF;

  BEGIN
    actor := auth.uid();
  EXCEPTION WHEN others THEN
    actor := NULL;
  END;

  IF actor IS NULL THEN
    BEGIN
      actor := NULLIF(current_setting('app.current_actor', TRUE), '')::uuid;
    EXCEPTION WHEN others THEN
      actor := NULL;
    END;
  END IF;

  BEGIN
    actor_email := (auth.jwt())->>'email';
  EXCEPTION WHEN others THEN
    actor_email := NULL;
  END;

  IF actor_email IS NULL OR actor_email = '' THEN
    BEGIN
      actor_email := NULLIF(current_setting('app.current_actor_email', TRUE), '');
    EXCEPTION WHEN others THEN
      actor_email := NULL;
    END;
  END IF;

  IF tenant_hint <> '' THEN
    IF position('fk:' IN tenant_hint) = 1 THEN
      fk_parts := string_to_array(substring(tenant_hint FROM 4), ':');
      fk_table := fk_parts[1];
      fk_column := COALESCE(fk_parts[2], 'id');

      IF new_row ? fk_column THEN
        fk_value := NULLIF(new_row->>fk_column, '')::uuid;
      ELSIF old_row ? fk_column THEN
        fk_value := NULLIF(old_row->>fk_column, '')::uuid;
      END IF;

      IF fk_value IS NOT NULL THEN
        EXECUTE format('select tenant_id from %I where id = $1 limit 1', fk_table)
        INTO tenant
        USING fk_value;
      END IF;
    ELSE
      IF tenant IS NULL AND new_row ? tenant_hint THEN
        tenant := NULLIF(new_row->>tenant_hint, '')::uuid;
      ELSIF tenant IS NULL AND old_row ? tenant_hint THEN
        tenant := NULLIF(old_row->>tenant_hint, '')::uuid;
      END IF;
    END IF;
  END IF;

  IF pk_hint = '' THEN
    pk_cols := ARRAY['id'];
  ELSE
    pk_cols := string_to_array(pk_hint, ',');
  END IF;

  FOREACH col IN ARRAY pk_cols LOOP
    EXIT WHEN col IS NULL OR col = '';
    IF new_row ? col THEN
      pk := pk || jsonb_build_object(col, new_row->>col);
    ELSIF old_row ? col THEN
      pk := pk || jsonb_build_object(col, old_row->>col);
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
    INTO changed
    FROM (
      SELECT key FROM jsonb_object_keys(new_row) AS t(key)
      WHERE (new_row -> key) IS DISTINCT FROM (old_row -> key)
    ) diff;
  ELSE
    changed := NULL;
  END IF;

  IF tenant IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_log (
    tenant_id,
    actor_id,
    actor_email,
    table_name,
    row_pk,
    action,
    changed_keys,
    before_data,
    after_data
  ) VALUES (
    tenant,
    actor,
    actor_email,
    TG_TABLE_NAME,
    pk,
    TG_OP,
    changed,
    old_row,
    new_row
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers to key domain tables
DROP TRIGGER IF EXISTS audit_log_obras ON public.obras;
CREATE TRIGGER audit_log_obras
AFTER INSERT OR UPDATE OR DELETE ON public.obras
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_flujo_actions ON public.obra_flujo_actions;
CREATE TRIGGER audit_log_flujo_actions
AFTER INSERT OR UPDATE OR DELETE ON public.obra_flujo_actions
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_certificates ON public.certificates;
CREATE TRIGGER audit_log_certificates
AFTER INSERT OR UPDATE OR DELETE ON public.certificates
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_pendientes ON public.obra_pendientes;
CREATE TRIGGER audit_log_pendientes
AFTER INSERT OR UPDATE OR DELETE ON public.obra_pendientes
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_calendar_events ON public.calendar_events;
CREATE TRIGGER audit_log_calendar_events
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('tenant_id', 'id');

DROP TRIGGER IF EXISTS audit_log_pendiente_schedules ON public.pendiente_schedules;
CREATE TRIGGER audit_log_pendiente_schedules
AFTER INSERT OR UPDATE OR DELETE ON public.pendiente_schedules
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log('fk:obra_pendientes:pendiente_id', 'id');

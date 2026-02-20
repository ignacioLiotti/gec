-- Reduce audit-log noise from metadata-only updates.
-- Keep recording full CRUD, but skip updates where only updated_at changed.

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
  changed_without_meta TEXT[];
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
        BEGIN
          EXECUTE format('select tenant_id from %I where id = $1 limit 1', fk_table)
          INTO tenant
          USING fk_value;
        EXCEPTION WHEN undefined_column THEN
          IF fk_table = 'obra_tablas' THEN
            SELECT o.tenant_id INTO tenant
            FROM public.obra_tablas ot
            JOIN public.obras o ON o.id = ot.obra_id
            WHERE ot.id = fk_value
            LIMIT 1;
          ELSIF fk_table = 'obra_tabla_columns' THEN
            SELECT o.tenant_id INTO tenant
            FROM public.obra_tabla_columns otc
            JOIN public.obra_tablas ot ON ot.id = otc.tabla_id
            JOIN public.obras o ON o.id = ot.obra_id
            WHERE otc.id = fk_value
            LIMIT 1;
          ELSIF fk_table = 'obra_tabla_rows' THEN
            SELECT o.tenant_id INTO tenant
            FROM public.obra_tabla_rows otr
            JOIN public.obra_tablas ot ON ot.id = otr.tabla_id
            JOIN public.obras o ON o.id = ot.obra_id
            WHERE otr.id = fk_value
            LIMIT 1;
          END IF;
        END;
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

    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
    INTO changed_without_meta
    FROM unnest(changed) AS key
    WHERE key <> 'updated_at';

    IF COALESCE(array_length(changed_without_meta, 1), 0) = 0 THEN
      RETURN NEW;
    END IF;
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

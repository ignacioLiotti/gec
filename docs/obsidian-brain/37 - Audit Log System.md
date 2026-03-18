# Audit Log System

tags: #audit #security #compliance #database

## Overview

Every data-modifying operation on tracked tables is logged to `audit_log`. The system captures who changed what, when, and from what previous state — with a configurable trigger that handles both direct and FK-indirect tenant ID resolution.

---

## Database Schema (migration 0044)

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  actor_id UUID,          -- auth.uid() at time of change
  actor_email TEXT,       -- denormalized for readability
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,   -- 'INSERT' | 'UPDATE' | 'DELETE'
  row_pk TEXT,            -- Primary key of changed row
  changed_keys TEXT[],    -- Array of changed column names (UPDATE only)
  before_data JSONB,      -- Row state before change (NULL for INSERT)
  after_data JSONB,       -- Row state after change (NULL for DELETE)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## The Audit Trigger Function

`record_audit_log()` is a configurable trigger function that accepts **two arguments**:

### Argument 1: tenant_hint
How to find the `tenant_id` from the row being changed:

| Pattern | Example | Meaning |
|---------|---------|---------|
| Direct column | `'tenant_id'` | Row has `tenant_id` directly |
| FK resolution | `'fk:obra_tablas:tabla_id'` | Look up tenant via FK join |

### Argument 2: pk_hint
The primary key column name (defaults to `'id'`).

```sql
-- Direct tenant_id example (obras table)
CREATE TRIGGER audit_obras
  AFTER INSERT OR UPDATE OR DELETE ON obras
  FOR EACH ROW EXECUTE FUNCTION record_audit_log('tenant_id', 'id');

-- Indirect via FK (obra_tabla_rows → obra_tablas → obras)
CREATE TRIGGER audit_obra_tabla_rows
  AFTER INSERT OR UPDATE OR DELETE ON obra_tabla_rows
  FOR EACH ROW EXECUTE FUNCTION record_audit_log('fk:obra_tablas:tabla_id', 'id');
```

### FK Resolution Logic
```sql
-- Parses 'fk:obra_tablas:tabla_id'
fk_parts := string_to_array(substring(tenant_hint FROM 4), ':');
-- fk_parts[1] = 'obra_tablas' (table)
-- fk_parts[2] = 'tabla_id' (FK column)

EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', fk_parts[1])
  INTO tenant USING (new_row->>fk_parts[2])::uuid;

-- Special handling for obra_tablas (needs another JOIN to obras)
IF fk_table = 'obra_tablas' THEN
  SELECT o.tenant_id INTO tenant
  FROM public.obra_tablas ot
  JOIN public.obras o ON o.id = ot.obra_id
  WHERE ot.id = fk_value LIMIT 1;
END IF;
```

---

## Tables with Audit Triggers

### Phase 1 (migration 0044) — Core tables
- `obras`
- `obra_flujo_actions`
- `certificates`
- `pendiente_schedules` (via FK to `obra_pendientes`)

### Phase 2 (migration 0083) — Dynamic tables
- `obra_tablas`
- `obra_tabla_columns`
- `obra_tabla_rows`

### Phase 3 (migration 0084) — Templates and macro
- `ocr_templates`
- `macro_tables`
- `macro_table_sources`
- `macro_table_columns`
- `macro_table_custom_values`
- `obra_default_folders`
- `obra_default_tablas`
- `tenant_main_table_configs`

### Phase 4 (migration 0085) — Documents
- `obra_document_uploads`

**Total: 14 tables** with full before/after audit logging.

---

## Noise Reduction (migration 0086)

High-frequency, low-value updates are filtered out to prevent audit table bloat:

```sql
-- Before inserting audit record, check if only updated_at changed
SELECT COALESCE(array_agg(key), ARRAY[]::text[])
INTO changed_without_meta
FROM unnest(changed_keys) AS key
WHERE key <> 'updated_at';  -- Filter timestamp-only updates

-- Skip audit log if only updated_at changed
IF COALESCE(array_length(changed_without_meta, 1), 0) = 0 THEN
  RETURN NEW;
END IF;
```

**Always logged regardless:** INSERT and DELETE operations.

---

## Actor Resolution

The trigger captures the authenticated user at the moment of the change:

```sql
actor_id    := auth.uid();
actor_email := (SELECT email FROM auth.users WHERE id = auth.uid());
```

- For API routes using `createClient()` (anon key): captures the logged-in user
- For routes using `createAdminClient()` (service role): `auth.uid()` is NULL → actor_id is NULL

**Implication:** Background jobs and workflow steps that use the admin client will have `actor_id = NULL` in the audit log. The `actor_email` will also be NULL.

---

## Querying Audit Log

### View changes to a specific obra
```sql
SELECT action, actor_email, changed_keys, before_data, after_data, created_at
FROM audit_log
WHERE table_name = 'obras' AND row_pk = '<obra_id>'
ORDER BY created_at DESC;
```

### View all changes by a user in the last 24h
```sql
SELECT table_name, action, row_pk, changed_keys, created_at
FROM audit_log
WHERE actor_id = '<user_id>'
  AND created_at > now() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### View all changes in a tenant
```sql
SELECT * FROM audit_log
WHERE tenant_id = '<tenant_id>'
ORDER BY created_at DESC
LIMIT 100;
```

---

## Admin Panel Access

`/admin/audit-log` (superadmin only) shows:
- All audit events across all tenants
- Filterable by tenant, table, actor, date range
- Shows before/after diff for UPDATE events

Tenant admins can view their own tenant's audit log at `/settings/audit-log`.

---

## RLS on Audit Log

```sql
-- Tenants can only see their own audit log
CREATE POLICY "tenant_audit_isolation" ON audit_log
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Superadmin can see all
CREATE POLICY "superadmin_audit_all" ON audit_log
  FOR SELECT USING (public.is_superadmin());
```

The audit log is **append-only** — no UPDATE or DELETE policies exist. Records are immutable once created.

---

## Soft Delete + Audit Interaction

When `soft_delete_row()` converts a DELETE to an UPDATE:

1. The `BEFORE DELETE` trigger fires `soft_delete_row()` → converts to UPDATE, returns NULL
2. The actual DELETE is suppressed
3. The `AFTER UPDATE` trigger on the same table fires `record_audit_log()` with the `deleted_at` change

Result: Audit log shows the soft-delete as an UPDATE with `changed_keys = ['deleted_at', 'deleted_by']`.

---

## Related Notes

- [[31 - RLS & Security Policies]]
- [[19 - Admin Panel]]
- [[33 - Superadmin Implementation]]
- [[28 - Database Migrations]]

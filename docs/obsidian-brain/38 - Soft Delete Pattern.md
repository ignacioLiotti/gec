# Soft Delete Pattern

tags: #database #patterns #data-integrity #schema

## Overview

Instead of hard-deleting records, the app uses a **trigger-based soft delete** pattern. A `BEFORE DELETE` trigger intercepts the DELETE statement, converts it to an UPDATE setting `deleted_at`, and suppresses the actual deletion. Deleted records remain in the database but are excluded from all RLS queries.

---

## Implementation (migration 0046)

### The Trigger Function
```sql
CREATE OR REPLACE FUNCTION public.soft_delete_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'UPDATE %I.%I SET deleted_at = now(), deleted_by = $2 WHERE ctid = $1',
      TG_TABLE_SCHEMA, TG_TABLE_NAME
    ) USING old.ctid, auth.uid();
    RETURN NULL;  -- Suppress actual DELETE
  END IF;
  RETURN NULL;
END; $$;
```

Using `ctid` (physical row ID) instead of `id` makes the UPDATE immune to RLS — it targets the exact row regardless of any policies.

### Tables with Soft Delete
```sql
CREATE TRIGGER soft_delete_obras
  BEFORE DELETE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_row();

CREATE TRIGGER soft_delete_certificates
  BEFORE DELETE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_row();

CREATE TRIGGER soft_delete_obra_pendientes
  BEFORE DELETE ON public.obra_pendientes
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_row();

CREATE TRIGGER soft_delete_calendar_events
  BEFORE DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_row();
```

---

## Schema Impact

Tables with soft delete gain two columns:
```sql
ALTER TABLE obras
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
```

And a partial index for performance:
```sql
CREATE INDEX obras_active_idx ON public.obras(tenant_id, deleted_at);
-- Queries always add WHERE deleted_at IS NULL → this index is used
```

---

## RLS + Soft Delete

All RLS policies on soft-deleted tables implicitly (or explicitly) filter:
```sql
-- Either via RLS policy:
CREATE POLICY "obras_active_only" ON obras
  FOR ALL USING (deleted_at IS NULL AND is_member_of(tenant_id));

-- Or via view (depending on table):
CREATE VIEW active_obras AS
  SELECT * FROM obras WHERE deleted_at IS NULL;
```

From the application's perspective, deleted records are simply invisible.

---

## Orphan Cleanup (migration 0046)

When an obra is soft-deleted, its child records may become orphaned. The `cleanup_orphan_records()` function handles cascading soft-deletes:

```sql
CREATE OR REPLACE FUNCTION public.cleanup_orphan_records()
RETURNS table(entity text, affected integer) AS $$
DECLARE now_ts TIMESTAMPTZ := now();
BEGIN
  -- Soft-delete certificates whose obra was deleted
  RETURN QUERY
    WITH updated AS (
      UPDATE public.certificates c
      SET deleted_at = now_ts
      WHERE c.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.obras o
          WHERE o.id = c.obra_id AND o.deleted_at IS NULL
        )
      RETURNING 1
    ) SELECT 'certificates_missing_obras'::text, count(*)::integer FROM updated;

  -- Same pattern for pendientes, calendar_events linked to deleted obras
  -- ...
END; $$;
```

This function is called by the maintenance cron endpoint (`/api/maintenance/orphans`) which requires `x-cron-secret` authorization.

---

## Audit Log Interaction

When a soft delete triggers:
1. `BEFORE DELETE` fires `soft_delete_row()` → converts to UPDATE
2. `soft_delete_row()` returns NULL → DELETE suppressed
3. The UPDATE sets `deleted_at` and `deleted_by`
4. `AFTER UPDATE` on the table fires `record_audit_log()`
5. Audit log records: `action='UPDATE'`, `changed_keys=['deleted_at', 'deleted_by']`

The delete is fully auditable and shows who deleted the record and when.

---

## Restoring Soft-Deleted Records

No built-in restore endpoint exists. To restore:

```sql
-- Via admin SQL (superadmin only)
UPDATE obras
SET deleted_at = NULL, deleted_by = NULL
WHERE id = '<obra_id>';
```

The app UI has no restore functionality — deletion is intended to be final from a UX perspective.

---

## Tables Without Soft Delete

Not all tables use soft delete. These use hard deletes:
- `notifications` — ephemeral, no recovery needed
- `memberships` — membership removal is permanent
- `invitations` — status field handles lifecycle
- `obra_tablas` / `obra_tabla_rows` — ON DELETE CASCADE from obras
- `background_jobs` — processed records are unneeded

---

## Related Notes

- [[37 - Audit Log System]]
- [[31 - RLS & Security Policies]]
- [[28 - Database Migrations]]
- [[04 - Obras (Construction Projects)]]

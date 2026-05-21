# Soft Delete Pattern

tags: #database #patterns #data-integrity #schema

## Overview

Instead of immediately hard-deleting user data, the app uses soft-delete lifecycles. Older tables use a **trigger-based soft delete** pattern. Newer obra and document trash flows write explicit delete-event rows with a 30-day recovery window and later maintenance purges.

Deleted records remain in the database while recoverable and are excluded from normal application queries. Deleted documents are also hidden from the file tree and document access endpoints. Deleted obras are hidden from workspace/list endpoints via `deleted_at`.

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

The app has restore flows for the current trash systems:

- Delete actions are permission-gated: `obras:delete` for obras, `documents:delete:file` for files, and `documents:delete:folder` for folders. Tenant `owner`/`admin` still bypass custom role restrictions through `has_permission`.
- Deleted obras are tracked in `obra_deletes` and can be restored by tenant admins within 30 days via `/api/obras/deletes/restore`.
- Deleted files/folders are tracked in `obra_document_deletes` and can be restored within 30 days via `/api/obras/[id]/documents/deletes/restore`.
- Expired delete events are not recoverable from the UI/API. Maintenance jobs mark them as purged after retention.

Manual SQL restore should be reserved for exceptional admin repair, because it can bypass audit fields, usage accounting, and delete-event state.

## Purge Semantics

Purge does not mean the same thing for every entity:

- Document purge removes the physical Storage object and cleans known document-derived metadata such as upload tracking, OCR processing rows, and extracted rows linked by `__docPath`.
- Obra purge removes files under the obra Storage prefix and marks the obra/delete event as purged. The obra row and related database records may remain for audit/history unless a future migration defines a stronger data-erasure contract.

If product/legal requirements demand complete erasure of all obra child data, that needs a separate ADR and migration plan.

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

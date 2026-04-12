# Destructive Data Safety Review

Date: 2026-04-06

## Scope

Review focused on irreversible failure modes:

- user documents stored in Supabase Storage
- user-entered table rows and imported OCR/spreadsheet rows
- tenant/admin configuration that can trigger bulk deletes
- backup/restore and auditability around destructive operations

## Highest-Risk Findings

### 1. Storage delete is effectively wide open to any authenticated user

Evidence:

- `supabase/migrations/0014_storage_obra_documents.sql`
- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- `components/quick-actions/quick-actions-panel.tsx`

Why this is dangerous:

- The storage policy allows any authenticated user to read, upload, update, and delete objects in the `obra-documents` bucket.
- File deletion is executed directly from browser code instead of a guarded server endpoint.
- A UI bug, bad client state, or a manual client-side request can remove files immediately.
- Storage object deletion has no soft-delete layer in the app.

Impact:

- Irrecoverable user document loss unless external storage versioning/backups exist and are restorable.

### 2. File and folder deletion permanently remove storage objects before any recoverable tombstone exists

Evidence:

- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- `app/api/obras/[id]/extracted-data/cleanup/route.ts`

Why this is dangerous:

- The file manager recursively lists a folder and deletes every file under it.
- Tracking cleanup in `obra_document_uploads` and OCR cleanup in `ocr_document_processing` happen only after storage deletion.
- There is no trash bucket, retention period, restore UI, or delete journal that can recreate the file bytes.

Impact:

- Wrong-folder deletion is immediately destructive.
- A partial failure can also leave database metadata out of sync with storage.

### 3. Deleting one default folder can cascade into tenant-wide data and file deletion

Evidence:

- `app/api/obra-defaults/route.ts`
- `app/api/jobs/run/route.ts`
- `lib/obra-defaults/remove-default-folder.ts`

Why this is dangerous:

- Deleting a default folder enqueues a background job.
- The background job runs with the service-role client.
- It removes linked OCR tablas, OCR processing rows, and all files in the matching folder for every obra in the tenant.
- There is no dry-run preview, snapshot, restore path, or approval barrier beyond the initial delete action.

Impact:

- One mistaken admin/config action can remove large amounts of tenant data and documents.

### 4. Several write flows use delete-first replacement on critical tables with no transaction or versioning

Evidence:

- `app/api/obras/[id]/tablas/import/spreadsheet-multi/route.ts`
- `app/api/obras/[id]/tablas/import/ocr-multi/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/rows/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/route.ts`
- `lib/ocr-template-sync.ts`
- `lib/obra-defaults/apply-default-folder.ts`

Why this is dangerous:

- Existing rows or columns are deleted before replacement data is fully committed and validated.
- `obra_tabla_rows`, `obra_tablas`, and related config tables do not use the app's soft-delete pattern.
- If an insert or later step fails after the delete succeeds, the prior data is gone.

Impact:

- Imported spreadsheets, OCR results, manual table rows, and schema/config state can be lost without an in-app recovery path.

### 5. Delete authority is much broader than the permission system suggests

Evidence:

- `app/api/obras/route.ts`
- `app/api/obras/[id]/route.ts`
- `app/api/certificados/[id]/route.ts`
- `app/api/reports/presets/route.ts`
- `app/api/reports/templates/route.ts`
- `supabase/migrations/0038_optimize_rls_policies_prevent_stack_overflow.sql`
- `supabase/migrations/0049_obra_defaults.sql`
- `supabase/migrations/0050_ocr_templates.sql`
- `supabase/migrations/0054_macro_tables.sql`
- `supabase/migrations/0071_report_presets.sql`

Why this is dangerous:

- Many destructive routes only require a logged-in tenant user plus tenant membership.
- Many RLS policies use `public.is_member_of(...)` or tenant-wide `FOR ALL` management policies.
- The app has a richer `has_permission` model, but these destructive routes are not consistently enforcing it.

Impact:

- More users can trigger destructive actions than intended.
- The probability of accidental deletion is higher than necessary.

### 6. Backup and restore are documented, but not enforced or proven in-repo

Evidence:

- `docs/supabase-backup.md`
- `docs/roadmap.md`
- `docs/roadmap-debt.md`
- `package.json`

Why this is dangerous:

- The repo contains a backup runbook, but no CI workflow or script that proves it is running.
- No restore verification log exists in the repo.
- The roadmap still flags backup verification as an open high-risk gap.

Impact:

- In the exact scenario this review cares about, there is no demonstrated recovery path.

### 7. Test coverage is thin around destructive behavior

Evidence:

- `tests/`

Why this is dangerous:

- Existing tests barely exercise delete, restore, import-replace, or bulk cleanup behavior.
- There are no obvious regression tests asserting that critical tables are soft-deleted instead of hard-deleted.
- There are no tests for storage deletion guardrails, bulk background delete jobs, or rollback behavior after failed replacements.

Impact:

- Destructive regressions can ship unnoticed.

## Existing Safety Nets

Useful but insufficient:

- Soft-delete triggers exist for `obras`, `certificates`, `obra_pendientes`, `calendar_events`, and `pendiente_schedules`.
- Audit logging exists for many important tables.
- Orphan cleanup exists for some child records.

Limitations:

- Soft delete is not applied to several data-heavy tables such as `obra_tablas`, `obra_tabla_rows`, `ocr_document_processing`, report config tables, and many permission/config tables.
- Audit log helps investigation, not recovery.
- There is no general restore workflow exposed in the app.

## Recommended Safety Net

### Priority 0: Stop direct irreversible file deletion

- Remove direct browser-side delete access to `obra-documents`.
- Route all deletes through a server endpoint using service role plus explicit authorization checks.
- Replace hard delete with move-to-trash semantics:
  - original object moved to `trash/...`
  - retain for 30 to 90 days
  - record delete actor, timestamp, and original path
- Add a restore path for trashed files.

### Priority 1: Expand recoverability to critical tables

- Add soft delete or row-versioning for:
  - `obra_tablas`
  - `obra_tabla_rows`
  - `obra_document_uploads`
  - `ocr_document_processing`
  - `report_presets`
  - `report_templates`
  - high-value config tables used by admins
- Add restore tooling for these tables.

### Priority 2: Eliminate delete-first replacement flows

- Replace delete-then-insert patterns with staged writes:
  - write new version
  - validate counts/schema/reference integrity
  - atomically mark new version active
  - retain prior version for rollback
- For Postgres-backed operations, prefer RPC or server-side transaction boundaries instead of multi-step client logic.

### Priority 3: Reduce blast radius of admin mistakes

- Add dry-run previews for bulk destructive actions.
- Require typed confirmation for bulk delete operations.
- Show affected obra count, file count, and row count before execution.
- Queue destructive jobs with a short cancellation window before execution.
- Snapshot affected config/data before running tenant-wide sync jobs.

### Priority 4: Tighten authorization

- Enforce `has_permission` checks on destructive routes.
- Restrict delete/update RLS on critical tables to admins or explicit permission holders.
- Separate member read/edit from destructive admin actions.

### Priority 5: Make backup and restore real, not aspirational

- Add CI automation for nightly Supabase dumps.
- Store encrypted backups outside the primary platform.
- Run scheduled restore drills into a disposable environment.
- Commit or persist restore drill results in a machine-generated log.

### Priority 6: Add prevention-focused tests and checks

- Integration tests for every destructive API path.
- Tests that assert soft-delete behavior on critical tables.
- Tests that simulate replacement-flow failure after delete and verify rollback behavior.
- Static grep/lint check that flags new `.delete()` or `storage.remove()` usage on protected resources without an approved wrapper.

## Suggested Implementation Order

1. Lock down storage delete and move document deletion server-side.
2. Add trash/retention for files.
3. Add soft delete or versioning for `obra_tabla_rows` and related dynamic table entities.
4. Convert replace-first imports/config sync to staged transactional writes.
5. Tighten authorization for destructive routes.
6. Automate backup plus restore drills.
7. Add regression tests and CI checks around destructive operations.


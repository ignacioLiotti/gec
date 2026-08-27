# ADR-0033: Obra creation requires the materialization permission

## Status

Accepted

## Date

2026-08-27

## Context

Obra rows could be inserted or updated by any tenant member, while the setup RPC that materializes default folders and extraction tables required `obras:edit` or `admin:obra-defaults`. The API logged setup failures but still returned success. This allowed a new obra to appear with virtual tenant folders even though its obra-scoped OCR tables did not exist, and document generation only discovered the missing destination after the user had completed the form.

## Decision

- Require `obras:edit` in the regular obra create/update API handlers. The first-obra setup route may insert with `admin:obra-defaults`, which is also sufficient to materialize defaults.
- Restrict `obras` inserts in RLS to `obras:edit` or `admin:obra-defaults`, so every identity that creates an obra can also materialize its defaults.
- Keep update RLS tenant-scoped and enforce operation-specific permissions at the API boundary. A single update policy cannot distinguish ordinary edits from the recoverable-delete lifecycle governed by `obras:delete`.
- Expose `obras:edit` in the role permission matrix so tenant administrators can grant the capability to non-admin members.
- Return a non-success response with per-obra setup results when a newly saved obra cannot finish default materialization.
- Validate that the selected generation folder resolves to a materialized extraction table with columns before accepting the generation target.
- Keep tenant default folders visible as configuration, but do not treat them as writable OCR destinations until materialization succeeds.

## Consequences

- Tenant membership alone no longer permits creating or editing obras. Owners and administrators retain access through `has_permission`; other users must be assigned an operational role that grants `obras:edit`. A setup operator with `admin:obra-defaults` may still create the tenant's first obra.
- A failed setup may leave the obra row persisted, but callers receive `503` and a `partial` setup status instead of a false success. Retrying the dedicated setup action remains safe because materialization is idempotent.
- Document generation fails before rendering or upload when the destination is only a virtual default folder.
- Existing incomplete obras require a one-time setup retry after deploying this change.

## Alternatives considered

- Allow every tenant member to run setup. Rejected because it bypasses the operational permission model for obra configuration.
- Hide every unmaterialized default folder. Rejected because the virtual tree is also used to explain the configured tenant structure; the generation boundary is the safer place to prevent writes.
- Make obra creation and setup one database transaction. Deferred because materialization spans existing application orchestration and setup-health RPCs; surfacing partial state is the smallest compatible correction.

## Related files

- `app/api/obras/route.ts`
- `app/api/obras/bulk/route.ts`
- `app/api/obras/[id]/route.ts`
- `app/api/obras/first/route.ts`
- `app/setup/first-obra-dialog.tsx`
- `app/admin/roles/_components/permission-matrix.tsx`
- `lib/obras/permissions.ts`
- `lib/document-generation-server.ts`
- `supabase/migrations/0131_require_obra_setup_permission_for_insert.sql`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`

## Agent notes

Any future ordinary obra edit path must enforce `obras:edit` before mutation; lifecycle actions must enforce their dedicated permission. A caller must not report a newly created obra as ready until default materialization has completed, and a document-generation destination is valid only when an obra-scoped extraction table with columns exists.

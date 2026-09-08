# ADR-0033: Obra creation requires the materialization permission

## Status

Accepted

Amended 2026-09-08: editing an existing obra through `PUT` or `PATCH /api/obras/[id]` is baseline tenant-member access. The original creation and provisioning decision remains in force.

## Date

2026-08-27

## Context

Obra rows could be inserted or updated by any tenant member, while the setup RPC that materializes default folders and extraction tables required `obras:edit` or `admin:obra-defaults`. The API logged setup failures but still returned success. This allowed a new obra to appear with virtual tenant folders even though its obra-scoped OCR tables did not exist, and document generation only discovered the missing destination after the user had completed the form.

## Decision

- Require `obras:edit` in create/upsert API handlers. Existing-obra `PUT` and `PATCH /api/obras/[id]` require membership through `is_member_of(tenant)` and retain tenant-scoped queries and RLS. The first-obra setup route may insert with `admin:obra-defaults`, which is also sufficient to materialize defaults.
- Restrict `obras` inserts in RLS to `obras:edit` or `admin:obra-defaults`, so every identity that creates an obra can also materialize its defaults.
- Keep update RLS tenant-scoped and enforce operation-specific permissions at the API boundary. A single update policy cannot distinguish ordinary edits from the recoverable-delete lifecycle governed by `obras:delete`.
- Expose `obras:edit` in the role permission matrix so tenant administrators can grant the capability to non-admin members.
- Return a non-success response with per-obra setup results when a newly saved obra cannot finish default materialization.
- Validate that the selected generation folder resolves to a materialized extraction table with columns before accepting the generation target.
- Keep tenant default folders visible as configuration, but do not treat them as writable OCR destinations until materialization succeeds.

## Consequences

- Tenant membership permits editing existing obras through the single-obra endpoint, even without `obras:edit`. Creation and bulk upsert still require the operational permission because they can materialize defaults. A setup operator with `admin:obra-defaults` may still create the tenant's first obra.
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

Existing-obra edits must verify tenant membership before mutation; creation/upsert and lifecycle actions retain their dedicated permissions. A caller must not report a newly created obra as ready until default materialization has completed, and a document-generation destination is valid only when an obra-scoped extraction table with columns exists.

## Amendment evidence and visual documentation

The provisioning fix `e5ce172` also blocked ordinary edits when `has_permission('obras:edit')` returned false. Provisioning is not needed to update an existing obra. Route regression tests reproduce the former 403 and cover successful PUT/PATCH for a member without the operational permission, rejection of non-members and unauthenticated users, and membership lookup failures. No database migration is required.

FigJam update pending because the MCP Starter quota was exhausted on 2026-09-08. Update Product OS (`NDzN30GN3koTteiTdkgV3P`), Journeys 01 / Inicio y Obras (`W6SZcSjlbhn1XdFLSktU03`), and Journeys 04 / Plataforma y Acceso (`ySjUIomuoMG00LNK0sKajF`): existing-obra save accepts any member of the active tenant; non-members remain denied; creation/provisioning remains permission-gated. Status: locally verified, not deployed. No screenshot change is required because the form layout is unchanged.

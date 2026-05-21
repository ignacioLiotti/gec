# ADR-0014: Tenant-Scoped Document Storage Policies

## Status

Accepted

## Date

2026-05-21

## Context

The `obra-documents` Supabase Storage bucket originally allowed broad access to any authenticated user. Application routes validated tenant and obra ownership, but direct Storage access could bypass the API-level soft-delete and tenant checks if a client knew or guessed an object path.

Document deletion is a soft-delete lifecycle: files stay in Storage during the 30-day recovery window and are hidden by `obra_document_deletes`. Storage policies must therefore enforce both tenant scope and active delete state, not only authentication.

## Decision

Storage policies for `obra-documents` are scoped by the first path segment, which must match an active `obras.id` visible to the current user's tenant membership through `public.is_member_of(o.tenant_id)`.

Read, update, and delete policies also reject objects whose path is covered by an active `obra_document_deletes` row, including children of a deleted folder. Insert and update targets must belong to active, non-purged obras.

The app should continue to use document API routes for user-visible upload, access, move, soft-delete, restore, and purge behavior. Direct Storage operations remain a lower-level implementation detail.

## Consequences

- Cross-tenant direct Storage access is blocked by RLS instead of relying only on API code.
- Soft-deleted document paths are also hidden from direct Storage reads while recoverable.
- Listing or moving folders may depend on active delete rows and active obra state, so routes that manipulate Storage must keep document lifecycle metadata in sync.
- Maintenance jobs that purge expired deletes must use service-role/admin clients, which bypass user RLS.

## Alternatives considered

- Keep broad authenticated Storage policies and rely on API routes: rejected because direct Storage clients can bypass soft-delete and tenant checks.
- Fully disable direct user Storage access: rejected for now because existing upload/folder flows still use Supabase Storage operations under authenticated user context.

## Related files

- `supabase/migrations/0101_tenant_scoped_obra_document_storage_policies.sql`
- `app/api/obras/[id]/documents/deletes/route.ts`
- `app/api/obras/[id]/documents/deletes/restore/route.ts`
- `app/api/obras/[id]/documents/access/route.ts`

## Related domain docs

- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/38 - Soft Delete Pattern.md`

## Agent notes

When changing document Storage behavior, check both the API route and the Storage policy. A path can be tenant-correct and still unavailable because it is covered by an active soft-delete record.

# ADR 0015: Delete Lifecycle Permissions

## Status

Accepted

## Context

Soft delete for obras and document manager items is destructive enough to require explicit authorization. The previous implementation tied obra deletion to tenant admin status, while file and folder deletion were available to authenticated obra users. That made it hard to delegate operational delete rights without giving broader admin access.

## Decision

Introduce three distinct permission keys:

- `obras:delete`
- `documents:delete:file`
- `documents:delete:folder`
- `documents:purge` for manual permanent purge from document history

API routes must enforce these permissions through `has_permission`. Client UI may hide destructive actions based on the same permissions, but server-side checks remain authoritative.

Tenant `owner` and `admin` memberships continue to bypass custom role restrictions through the existing permission function. Migration 0102 grants the new permissions to roles that already had `obras:admin` and adds them to the `obra_manager` template.

## Consequences

- Roles can grant obra, file, folder deletion, and manual purge independently.
- Existing roles with `obras:admin` keep their previous destructive capability.
- Restore remains a separate lifecycle concern. Manual permanent purge is governed by `documents:purge`, not by the trash/delete permissions.

## Related

- `supabase/migrations/0102_delete_lifecycle_permissions.sql`
- `supabase/migrations/0124_document_purge_permission.sql`
- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/38 - Soft Delete Pattern.md`

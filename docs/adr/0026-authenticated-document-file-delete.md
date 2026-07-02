# ADR-0026: Authenticated document file delete

## Status

Accepted

## Date

2026-06-17

## Context

Document file deletion is an operational cleanup action inside an obra. Requiring
the `documents:delete:file` permission made regular users unable to remove files
they could otherwise work with, while folder and obra deletion remain broader
destructive actions because they can hide many files or an entire project.

ADR 0015 split delete lifecycle permissions into obra, file, and folder keys.
The file portion is now too restrictive for the product rule that any normal
obra user can send individual files to trash.

## Decision

Allow any authenticated user with access to the tenant and non-deleted obra to
send an individual document file to the document trash.

Keep explicit permission gates for broader destructive actions:

- `documents:delete:folder` remains required for folder deletion.
- `obras:delete` remains required for obra deletion.

The `documents:delete:file` permission key can remain in existing role data for
compatibility, but the document delete API no longer enforces it for individual
files.

## Consequences

Regular obra users can clean up mistaken or obsolete file uploads without role
changes. Folder deletion still needs delegated destructive permission, so users
cannot hide an entire folder tree by default.

Existing role templates and tenants may still contain `documents:delete:file`.
That key should be treated as legacy unless a future migration removes it from
role configuration data.

## Alternatives considered

Keep `documents:delete:file` and grant it to every role. That would require data
backfills and still make the default product rule depend on role setup.

Allow any user to delete both files and folders. Rejected because folder deletes
affect many descendant files and should remain separately delegated.

## Related files

- `app/api/obras/[id]/documents/deletes/route.ts`
- `app/excel/[obraId]/tabs/file-manager/file-manager.tsx`
- `docs/adr/0015-delete-lifecycle-permissions.md`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`
- `docs/obsidian-brain/38 - Soft Delete Pattern.md`

## Agent notes

When changing document delete behavior, keep server-side enforcement
authoritative. Client permission checks may hide folder actions, but file delete
availability should follow the API rule above.

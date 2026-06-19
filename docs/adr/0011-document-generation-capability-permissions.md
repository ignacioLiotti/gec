# Document generation uses baseline creation with capability-based review/config surfaces

Status: accepted

Date: 2026-05-03

## Context

The original document-generation flow treated creation, template administration, and status review as one flat feature. In practice, the product needs different operator surfaces: every tenant member can generate and resume their own drafts, reviewers must approve or reject generated documents, and admins or delegated managers must manage template/configuration screens. The first version also relied too heavily on UI hiding while RLS still allowed tenant members to mutate review state and template overrides.

## Decision

Document generation is now split into dedicated surfaces:

- `/document-generation` for create/edit
- `/document-generation/drafts` for draft recovery
- `/document-generation/review` for approval review
- `/document-generation/templates` and `/document-generation/config` for template administration

Access is controlled by capability permissions instead of a single route-level assumption:

- `documents:review`
- `documents:templates`

API routes and RLS policies must enforce the same split. Creation and own-draft management are baseline access for authenticated tenant members, review actions require `documents:review`, and template mutation requires `documents:templates`.

## Consequences

- Sidebar visibility is no longer enough; server pages, API handlers, and Supabase policies must agree on the same access model.
- Tenant admins still bypass these checks through the existing `has_permission(...)` admin path.
- New role templates are required only for reviewers and document managers.
- Future document-generation features should be tenant-member access by default unless they mutate review decisions or template/configuration state.

## Alternatives considered

- Keep one document-generation route and hide admin/review actions in the UI. Rejected because it mixes responsibilities and leaves review/config authorization too implicit.
- Rely only on application-level guards. Rejected because previous RLS policies still allowed cross-user mutations inside the tenant.

## Related files

- `app/document-generation/*`
- `app/api/document-generation/*`
- `components/app-sidebar.tsx`
- `supabase/migrations/0097_document_generation.sql`
- `supabase/migrations/0098_document_generation_permissions.sql`
- `supabase/migrations/0107_document_generation_member_create_access.sql`

## Related domain docs

- `docs/obsidian-brain/20 - Permissions System.md`

## Agent notes

When changing document-generation access, update both the capability matrix and the corresponding RLS policies. Do not add new document surfaces that are visible in the sidebar without defining which permission key unlocks them.

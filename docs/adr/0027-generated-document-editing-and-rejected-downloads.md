# Generated document editing and rejected downloads

Status: accepted

Generated operational documents are tenant work products, not private drafts. We decided that any authenticated tenant member with document generation access may edit a generated document while it is still `GENERATED`, `UNDER_REVIEW`, or `REJECTED`, regardless of who generated it. Approved documents remain locked.

Rejected generated PDFs must not be downloadable through document storage access. The storage access endpoints refuse both direct downloads and signed URLs when the requested path belongs to a `generated_documents` row with status `REJECTED`.

Why this ADR exists:

- operators need to correct each other's generated documents without reviewer-only access
- the lifecycle already treats rejected documents as editable correction targets
- rejected PDFs should not keep circulating as downloadable final artifacts

Consequences:

- ownership no longer limits editability for generated documents in editable statuses
- generated-document history and detail are visible to authenticated members of the same tenant
- draft ownership remains unchanged; drafts are still scoped to the creating user
- storage access must check generated-document status before returning bytes or signed URLs
- document review permission still controls approval and rejection decisions

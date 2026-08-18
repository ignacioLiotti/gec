# Generated document editing, approval reset, and rejected downloads

Status: accepted

Generated operational documents are tenant work products, not private drafts. We decided that any authenticated tenant member with document generation access may edit a generated document while it is `GENERATED`, `UNDER_REVIEW`, `APPROVED`, or `REJECTED`, regardless of who generated it. Saving changes to an approved document regenerates it as `UNDER_REVIEW`, so the prior approval is not carried forward and the document must be reviewed again.

Rejected generated PDFs must not be downloadable through document storage access. The storage access endpoints refuse both direct downloads and signed URLs when the requested path belongs to a `generated_documents` row with status `REJECTED`.

Why this ADR exists:

- operators need to correct each other's generated documents without reviewer-only access
- the lifecycle already treats rejected documents as editable correction targets
- approved documents sometimes need corrections, but edited content must not retain an approval granted to an earlier version
- rejected PDFs should not keep circulating as downloadable final artifacts

Consequences:

- ownership no longer limits editability for generated documents in editable statuses
- approved documents expose the same edit action in history; regeneration records the transition from `APPROVED` to `UNDER_REVIEW`
- cancelled documents remain non-editable
- generated-document history and detail are visible to authenticated members of the same tenant
- a tenant member may open a specific generated document from history in a read-only review view; only members with `documents:review` see the review queue and decision controls
- draft ownership remains unchanged; drafts are still scoped to the creating user
- storage access must check generated-document status before returning bytes or signed URLs
- document review permission still controls approval and rejection decisions

# Destructive default sync needs a domain migration contract

Status: accepted

Default-folder apply/remove and force-sync paths can change or delete tenant-derived structures across many obras. The current implementation still uses background jobs and TODOs, but the domain decision is that destructive changes require a dedicated migration run, impact preview, compatibility classification, frozen approved snapshot, one-shot approval token and final auditable outcome.

This ADR captures the constraint so future implementation does not normalize direct execution as acceptable. Background jobs may execute work, but they are not the business record of a destructive migration.

# Current tenant operations model

## Overview

Platform operations currently span several independent systems: tenant administration, resource metering, database audit history, technical monitoring, and a documented recovery procedure. They provide useful evidence individually, but do not yet form a complete tenant operations dashboard.

The repository establishes implementation and migration intent. It does not establish which triggers are deployed, whether production backups run, or whether a complete restore has succeeded. Source anchors and review limits are in [evidence.md](evidence.md).

## Key concepts

- **Tenant scope:** the active tenant, the user's administered tenants, and the platform-wide tenant set are distinct scopes.
- **Metering:** monthly resource quantities and signed adjustments for storage, AI tokens, and WhatsApp messages.
- **Product activity:** completed semantic actions, such as configuring a workflow. No complete action catalog or frequency aggregate exists.
- **Audit:** historical record of covered database changes, including actor, tenant, changed fields, and before/after values.
- **Lineage:** data relationships and transformation history. Graphs primarily project current state; some workflows maintain separate histories.
- **Recovery:** restoring database contents and other required assets. Audit history and lineage do not constitute backups.

## How it works

Tenant administration first authenticates the user and resolves superadmin status. Superadmins can list all tenants through a server-only service client; ordinary administrators see owner/admin memberships. Permission simulation can further restrict effective permissions. Existing screens use different scopes: tenant usage follows the active tenant, expenses cover administered memberships, and the audit viewer selects one membership-derived tenant. Any combined view must explicitly identify its scope.

Resource-consuming operations call the usage helpers. These increment counters in UTC monthly periods and may append signed metering events with contextual metadata. Uploads, storage lifecycle operations, OCR reservations and settlement, and Document AI token usage contribute evidence. Optional event insertion can fail independently without durable retry through an outbox.

The expenses UI displays quantities, limits, and recent events. It estimates some AI costs from explicit `metadata.costUsd` or a small model-price table. This is partial pricing evidence, not complete tenant operating expenditure: unsupported models produce unknown estimates, and shared infrastructure allocation and invoice reconciliation are absent.

Database triggers record covered mutations in the audit log. Migration-defined coverage includes obras, extraction configuration and rows, macros, templates, and document lifecycle. Coverage is uneven: data-flow configuration lacks the standard trigger, and other domains sometimes use separate histories. Trigger logic suppresses timestamp-only noise and skips changes whose tenant cannot be resolved. Service-role changes can lack the initiating user because runtime actor settings were not found.

Technical monitoring uses production Sentry, Vercel Analytics, and Speed Insights. Sentry defaults to 10% trace sampling. The health endpoint reports process health/version, without proving database availability or recovery readiness.

Recovery documentation describes nightly dumps, encrypted offsite copies, retention, and restore exercises. Supporting automation and restore evidence were not found. The manual production-to-local clone script handles selected database, auth, and Storage content; it does not demonstrate complete scheduled recovery.

## Where things live

- `app/admin/tenants/page.tsx`, `lib/superadmin.ts`, `lib/route-guard.ts`: tenant visibility and access.
- `lib/tenant-usage.ts`, `lib/tenant-expenses.ts`, `lib/ai-pricing.ts`: metering and estimates.
- `app/admin/expenses/`, `app/api/tenant-usage/route.ts`: usage presentation and retrieval.
- Audit migrations and `app/admin/audit-log/page.tsx`: mutation history and viewer.
- `lib/data-flow-writeback.ts`: separate transformation/writeback history.
- Instrumentation and Sentry configuration files: technical monitoring.
- `docs/supabase-backup.md`, `scripts/clone-prod-to-local.ps1`: recovery guidance and manual cloning.

## Gotchas

Metering events count resource adjustments, including reservations and rollbacks; sampled traces capture selected technical executions. Neither establishes exact semantic action frequency or historical adoption.

Audit visibility and full JSON payloads need a separate permissions/redaction review. Missing audit triggers do not imply missing domain histories.

Database backups omit Storage object bytes. Recovery coverage must account for those separately, and documented procedures remain unverified until a restore is exercised. See the [official backup guide](https://supabase.com/docs/guides/platform/backups).

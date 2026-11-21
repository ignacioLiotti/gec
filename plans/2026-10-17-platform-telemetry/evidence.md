# Current platform operations and usage evidence

Repository review on 2026-10-17. This is local source evidence, not a production audit. Existing unrelated changes, including admin UI changes, must be preserved.

## Scope and assumptions

The request covers telemetry, tenant visualization, production database backups, create/edit/configuration traceability, tenant operating costs, and user action frequency. Operating costs are assumed to mean infrastructure and provider costs attributable to tenants. The intended audience is pending clarification; design cross-tenant information for platform operators and retain existing tenant-admin access until a separate permission decision.

No credentials, production access, schema application, new dependencies, commits or external writes are authorized by this review. Local planning files are safe to create. Do not start/rebuild the existing dev server; `.cursor/rules/do-not-run-build-or-dev.mdc` forbids this without asking.

## Existing flows

### Tenant overview and access

- `app/admin/tenants/page.tsx:29-89` authenticates and resolves superadmin status. Superadmins list all tenants through the server-only service client; ordinary admins list their owner/admin memberships.
- `app/admin/tenants/page.tsx:103-226` shows name, ID, creation, owner, invitations and tenant switching. It lacks usage, operating cost, product activity and operational health summaries.
- `lib/superadmin.ts:1-25` owns profile/deployment-allowlist superadmin identity. `lib/route-guard.ts` additionally narrows effective permissions during permission simulation.
- `app/api/tenant-usage/route.ts:23-109` resolves the active tenant and current UTC-month usage. Its POST is intentionally disabled with 405.
- `app/admin/expenses/page.tsx:41-116` scopes to all owner/admin memberships, rather than the active-tenant cookie. A new dashboard must make its selected scope explicit.

### Usage and costs

- `supabase/migrations/0064_tenant_api_expenses.sql:3-29` defines monthly quantities/limits for bytes, AI tokens and WhatsApp messages. It does not store priced operating expenses.
- `supabase/migrations/0066_tenant_usage_enforcement.sql:18-95` increments monthly usage with UTC boundaries and nullable limits.
- `supabase/migrations/0067_usage_event_logs.sql:3-24` defines signed metering deltas plus context/metadata. These are not semantic user task completions.
- `lib/tenant-usage.ts:176-239` increments usage and optionally records events; event insert failures are logged, not made durable through an outbox.
- `lib/tenant-expenses.ts:52-112` normalizes quantities and sums the latest period per tenant.
- `app/admin/expenses/all/page.tsx:32-122` gates access using superadmin/limit-manager rules, then reads all tenant summaries and the latest 50 metering events. `:124-337` shows limits, usage and an editable limit table.
- `components/expenses/usage-event-log.tsx:21-51` uses `metadata.costUsd` or the limited price table in `lib/ai-pricing.ts:1-10`. Gemini OCR defaults are missing from that table, so some estimates are null. A missing price is unknown, not zero.
- Current metering covers uploads, storage lifecycle, OCR reservation/settlement and Document AI token usage. There is no complete action catalog or feature adoption/cadence aggregate. Metering reservations and rollback events must not inflate product usage counts.

### Audit and lineage

- `supabase/migrations/0044_audit_log.sql:72-108` defines audit storage with tenant, actor, table/action, primary key, changed columns, full before/after JSON and context. Read RLS uses `is_admin_of`; insert policy is broad. Policy hardening requires an explicit permissions/schema decision.
- `supabase/migrations/0086_audit_log_noise_reduction.sql:28-57` obtains actors from auth or transaction settings. No runtime setting of `app.current_actor` / `app.current_actor_email` was found. Service-role actions can therefore lack the initiating actor.
- `supabase/migrations/0086_audit_log_noise_reduction.sql:117-151` ignores timestamp-only updates and silently skips unresolved tenants.
- Audit-trigger declarations appear in migrations 0044, 0083-0086, 0089 and 0090. Coverage includes obras, extraction rows/config, macros, templates and document lifecycle. This is migration-defined coverage; deployed triggers were not inspected.
- `app/api/data-flow-config/route.ts:77-132` writes tenant data-flow configuration, but migration 0096 defines no standard audit trigger for it.
- Access/roles, secrets, several document-generation, insurance and WhatsApp actions have no standard audit trigger in the inspected migrations. Some have separate domain event histories; preserve and correlate those instead of assuming no history exists.
- `app/admin/audit-log/page.tsx:107-169` lists one membership-derived tenant. `:342-379` renders full technical JSON without field redaction. The file already has unrelated user changes.
- `lib/data-flow-writeback.ts:56-169` and migration 0100 store separate recompute/suggestion/writeback history. The lineage/data-flow graph routes project current state with explicit partial coverage; graphs are not a canonical historical event store.

### Technical telemetry

- `instrumentation.ts:1-32`, `instrumentation-client.ts:5-50`, `sentry.server.config.ts`, `sentry.edge.config.ts` wire Sentry only in Vercel production. Default trace sampling is 0.1. Sampled traces cannot provide exact product-action counts.
- `app/layout.tsx:331-353` mounts production Vercel Analytics/Speed Insights. The explicit analytics event located in `app/page.tsx:133-138` is a public landing view.
- `app/api/health/route.ts:1-23` returns process health/version with an optional token. It does not prove database availability, backup freshness, job success or tenant health.

### Recovery

- Before this review, `docs/supabase-backup.md` described nightly public-data dumps, encrypted offsite upload, retention and weekly restores. The original text is available through `git show HEAD:docs/supabase-backup.md`. No backup runner, CI workflow, retention configuration or restore log was found. `.github/` is absent. The runbook was corrected during this planning change to make that status explicit.
- The runbook references `docs/runbooks/backup-log.md` and a smoke-test command/path that do not exist in the repository.
- `scripts/clone-prod-to-local.ps1:392-538` is a separately gated manual local-clone tool, not a scheduled backup. It dumps public, separately handles selected auth data, and copies selected Storage objects. It does not establish complete recovery.
- No production backup state, provider plan, cloud retention policy or successful restore has been verified. Local Docker health could not be checked because the Linux engine pipe was unavailable.
- Official Supabase documentation confirms that database backups omit Storage object bytes, which require separate recovery coverage: https://supabase.com/docs/guides/platform/backups
- Official CLI recovery guidance covers additional platform concerns and must be used when writing the restore runbook: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Constraints and relevant checks

- `AGENTS.md` requires approval before schema/stored-data changes, production dependencies, credentials, deployment, spending or external-account actions. Prepare concrete proposals first.
- `app/AGENT_CONTEXT.md` requires Product OS and Journey 04 FigJam review/update for user-visible implementation. Planning alone does not mark a capability shipped.
- Before UI work, read `docs/styleguide/design-system.md`; use `@/components/ui/*` and existing product tokens.
- Relevant existing tests: `tests/app/api/tenant-usage-post.test.ts`, `tests/lib/admin/tenant-limit-access.test.ts`. No audit trigger or action-cadence tests were found.
- Initial implementation verification should add meaningful fixture-based cadence/cost tests and a disposable local database proof of audit atomicity, actor attribution and cross-tenant denial. Do not reset a database without authorization.

## Design questions to resolve

1. Which storage and collection boundary keeps business audit transactional while allowing bounded product analytics and technical sampling?
2. Which semantic actions count as usage, how are retries/bulk/background work counted, and how are daily/weekly/monthly habits defined without inventing history?
3. How are attributable estimates, actual invoices and allocated shared costs distinguished, including unknown coverage and currencies?
4. What recovery loss/downtime objective, offsite destination and retention does the operator approve?
5. Which smallest increments can be verified without credentials, schema application or new production dependencies?

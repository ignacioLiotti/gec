# Agent Context: app/api

## Purpose

All HTTP API routes (Next.js route handlers). Routes are thin: they authenticate, resolve tenant scope, validate input, and delegate to helpers in `lib/**`. Business logic belongs in `lib`, not here.

## Area map

- `obras/` — obra CRUD, search (`?q=`, `?limit=`, `?page=` returning `detalleObras`), backfills, per-obra sub-resources (data-flow config, tables). Has its own `AGENT_CONTEXT.md`.
- `admin/` — tenant-admin operations (users, roles, invitations).
- `macro-tables/`, `sidebar-macro-tables/` — cross-obra consolidation data.
- `data-flow-config/`, `data-flow-graph/` — tenant/obra data-flow configuration and traceability graph.
- `certificados/` — certificate series and documents.
- `insurance-policies/` — insurance policy import/matching/movements (see ADRs 0011, 0019, 0020, 0025).
- `document-ai/`, `document-generation/` — Document AI runs and template-generated documents.
- `ocr-templates/`, `ocr-playground/` — extraction template management and testing.
- `company-files/` — company-global files (ADR 0018).
- `notifications/`, `events/`, `calendar-events/`, `doc-reminders/` — notifications engine, domain events, calendar, document reminders.
- `billing/`, `tenant-usage/` — MercadoPago billing and usage metering/plan limits.
- `tenants/`, `tenant-secrets/`, `tenant-marker/` — tenant management and per-tenant secrets.
- `permissions/`, `impersonate/` — permission checks/simulation and owner-only impersonation (ADRs 0023, 0024, 0028, 0029).
- `whatsapp/` — WhatsApp capture channel (ADRs 0021, 0022).
- `reporting/`, `reports/`, `pdf-render/` — signals/findings reporting and PDF rendering.
- `jobs/`, `schedules/`, `maintenance/`, `workflow-test/` — background jobs and scheduled maintenance.
- `demo/` — demo-session endpoints (capability-limited).
- `health/` — health check.
- `flujo-actions/` — workflow/flujo runtime actions.
- `aps/`, `contact/`, `obra-recipients/`, `obra-defaults/`, `main-table-config/` — misc feature endpoints.

## Local rules

- Every handler must authenticate (`createClient()` from `@/utils/supabase/server` + `getUser()`) and scope by tenant before touching data. Never trust a tenant id from the request body.
- Use `lib/http/validation.ts` for input validation; return structured errors.
- The service-role client (`utils/supabase/admin.ts`) bypasses RLS. Only use it where the route's purpose makes the bypass explicit, and re-verify tenant scope manually.
- Rate limiting and request signing helpers live in `lib/security/**`; sensitive endpoints (OCR, AI, billing) should meter usage via `lib/tenant-usage.ts`.
- Changing a response shape requires checking direct consumers with `rg` (React Query hooks and page components).
- Mutations that affect governed areas (schema sync, migrations, extraction, permissions) must follow the contracts in `CONTEXT.md` and the ADRs — no shortcuts.

## Related documentation

- `docs/obsidian-brain/25 - API Reference.md` (if present) and `docs/obsidian-brain/39 - API Secrets & Request Signing.md`
- `docs/obsidian-brain/31 - RLS & Security Policies.md`
- `docs/obsidian-brain/30 - Background Jobs.md`
- `docs/obsidian-brain/35 - Usage Metering & Subscriptions.md`
- `lib/AGENT_CONTEXT.md`

## Validation

- `pnpm lint`
- Targeted Vitest under `tests/app/**` when the route has coverage.
- Smoke-check the route with an authenticated request when behavior changes.

# Getting Started

Onboarding guide for developers joining the multi-tenant obras platform.

## 1. What you're building

A multi-tenant SaaS where construction companies (tenants) manage **obras**: they upload documents, the system extracts structured data (OCR or manual), rows land in editable **tablas de extraccion** with stable lineage, tenant-configured **data-flows** compute KPIs per obra, and **macro tables** consolidate across obras. Schema changes flow from tenant templates to obras with strict governance (non-destructive by default, audited Migration Runs for anything destructive).

Before writing domain code, read [`CONTEXT.md`](../../CONTEXT.md) — it defines the canonical vocabulary (Plantilla Tenant, Instancia de Obra, Lineage Row Key, Migration Run, …) and the business rules the codebase must honor. Using the right terms is not optional; PRs and docs are expected to use them.

## 2. Prerequisites

- Node.js 20+ and **pnpm**
- Docker Desktop (running)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Windows, macOS, or Linux (the team develops on Windows; scripts include PowerShell variants)

## 3. First run

```bash
git clone <repo> && cd multi-tenant
pnpm install

# Environment — local values in env.example already point at the local stack
cp env.example .env.local          # PowerShell: Copy-Item env.example .env.local

# Local Supabase (Postgres 54322, API 54321, Studio printed by status)
pnpm supabase:start
pnpm supabase:status

# Create schema + seed
pnpm db:reset

# Optional: a demo tenant with realistic sample data
pnpm seed:demo-tenant

# Run
pnpm dev                            # http://localhost:3000
```

Sign up through the app's auth flow; the onboarding flow creates your tenant. For a data-rich environment, `pnpm clone:prod-to-local` clones production into the local stack (requires prod credentials — ask before using).

## 4. The stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js App Router | Server components + API route handlers under `app/api/**` |
| Database/Auth/Storage | Supabase | Postgres with **RLS as the enforcement layer**; migrations in `supabase/migrations/` |
| Data fetching | TanStack React Query | Provider at `lib/query-client-provider.tsx` |
| Tables | TanStack Table + custom `components/form-table/` grid | The form-table is the product's core editing surface |
| Forms | TanStack Form + Zod | |
| UI | shadcn/ui-style primitives in `components/ui/` on the "Sintesis" design system | Orange primary, tokens in `app/globals.css` / `design-system/tokens.css` |
| Toasts | `sonner` (`toast.success/error`) | Already wired in the layout |
| Email | React Email (`emails/`) + durable workflows (`workflows/`) | |
| Observability | Sentry (`sentry.*.config.ts`), Vercel Analytics | |
| Video | Remotion (`remotion/`) | Marketing asset only |

## 5. Key patterns

**Auth (server):**
```ts
import { createClient } from "@/utils/supabase/server";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

**Auth (client):** `createSupabaseBrowserClient()` from `@/utils/supabase/client`.

**Tenant scoping:** the active tenant travels in the `active_tenant_id` cookie; memberships and RLS policies enforce access. Never trust a tenant id from a request body, and never use the service-role client (`utils/supabase/admin.ts`) without re-verifying scope.

**Route access:** declared in `lib/route-access.ts` / enforced by `lib/route-guard.ts` — don't hand-roll permission checks.

**Dates:** date-only strings go through `utils/date.ts` (`parseLocalDate`/`formatLocalDate`) to avoid UTC off-by-one bugs (users are GMT-3).

## 6. Where things are

See [project-structure.md](project-structure.md) for the full map. Rule of thumb: routes in `app/`, shared logic in `lib/`, shared UI in `components/`, and every major folder has an `AGENT_CONTEXT.md` that tells you what's inside and what's dangerous.

## 7. Tests

See [testing.md](testing.md). Quick version: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright), and prefer targeted runs (`pnpm test -- tests/lib/lineage.test.ts`).

## 8. Things that will bite you

- **RLS is the security model.** A query that "works" with the admin client may be leaking across tenants. Test with a normal user session.
- **Migrations are governed.** Read `supabase/migrations/AGENT_CONTEXT.md` and the ADRs before schema changes. Destructive template changes require the Migration Run contract from `CONTEXT.md`.
- **Lineage is sacred.** Extracted rows carry `lineage_row_key`; reimports must reconcile, not recreate. See ADR 0001/0002 before touching import code.
- **`form-table/` is everywhere.** Changes to the grid affect the whole product; run its tests and check the styleguide.
- **Design system:** import from `@/components/ui/*`, use token classes, read `docs/styleguide/design-system.md` before UI changes.

## 9. Deep dives

The `docs/obsidian-brain/` folder is a ~40-note architecture wiki (open it as an Obsidian vault, start at `00 - Home.md`). Best first reads: `01 - Architecture Overview`, `02 - Multi-Tenancy & Auth`, `05 - Tablas`, `18 - OCR Pipeline`, `24 - Database Schema`.

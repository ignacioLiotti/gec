# Multi-tenant Obras Platform

A multi-tenant platform for managing **obras** (construction/works projects): documents, OCR-driven data extraction, editable dynamic tables, cross-obra consolidation (macro tables), certificates, insurance policies, reporting, and schema/version governance with migration safety.

Built with Next.js (App Router), Supabase (Postgres + Auth + Storage + RLS), TanStack Query/Table/Form, and shadcn/ui components on a custom design system ("Sintesis").

## The product in one paragraph

Each **tenant** (a company) manages many **obras**. Documents (certificates, insurance policies, purchase orders, spreadsheets) are uploaded into configured folders and extracted — via OCR or manual entry — into **tablas de extraccion** (extraction tables). Extracted rows keep a stable business identity (**lineage**) across reimports. Tenant-level **data-flow** configuration turns rows and obra fields into calculations, KPIs and layout blocks on each obra's detail view, and **macro tables** consolidate data across obras. Tenant template changes propagate to obras through **Sincronizacion No Destructiva** by default; destructive changes require explicit, audited **Migration Runs**.

> The canonical value flow: **Documento → Extraccion → Tabla de Extraccion → Calculo → Obra → Decision**

## Quick start

Prerequisites: Node 20+, pnpm (or npm), Docker Desktop (for local Supabase), and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Environment
cp env.example .env.local        # PowerShell: Copy-Item env.example .env.local

# 2. Local database (Postgres + Auth + Storage via Docker)
pnpm supabase:start
pnpm supabase:status             # verify; API on :54321, DB on :54322

# 3. Dev server
pnpm dev                         # http://localhost:3000
```

See [docs/dev/getting-started.md](docs/dev/getting-started.md) for the full onboarding guide (seeding a demo tenant, env vars, common pitfalls).

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build (turbopack) |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests |
| `pnpm test:e2e` / `pnpm test:e2e:ui` | Playwright end-to-end tests |
| `pnpm supabase:start` / `:stop` / `:status` | Local Supabase stack |
| `pnpm db:reset` | Recreate local DB from `supabase/migrations` + `seed.sql` (destructive, local only) |
| `pnpm db:push` | Apply pending migrations to the linked DB (high impact — read `supabase/migrations/AGENT_CONTEXT.md` first) |
| `pnpm seed:demo-tenant` | Bootstrap a demo tenant with sample data |
| `pnpm video:studio` | Remotion studio for the promo video (not a product feature) |

## Repository map

| Path | Contents |
| --- | --- |
| `app/` | Next.js App Router routes: product pages (`excel/`, `admin/`, `dashboard/`, `certificados/`, …) and API routes (`app/api/**`) |
| `components/` | React components; `components/ui/` are the shared primitives (import via `@/components/ui/*`) |
| `design-system/` | Standalone "Sintesis" design-system layer (tokens, tailwind preset). Do not import directly from app code |
| `lib/` | Shared business logic: tables, lineage, data-flow, macro tables, permissions, billing, notifications, OCR policy |
| `hooks/` | Small shared React hooks |
| `utils/` | Supabase client factories (`utils/supabase/`) and date helpers |
| `supabase/` | Local config, SQL migrations, seed data |
| `emails/` + `workflows/` | React Email templates and durable email workflows |
| `tests/` | Vitest unit tests (`tests/lib`, `tests/app`, `tests/components`) and Playwright e2e (`tests/e2e`) |
| `scripts/` | One-off operational scripts (backfills, demo bootstrap, prod-to-local clone) |
| `docs/` | All documentation — see [docs/README.md](docs/README.md) for the index |
| `remotion/` | Promo video composition (standalone asset, not shipped in the app) |

## Documentation

- **New developers** → [docs/dev/getting-started.md](docs/dev/getting-started.md)
- **Customers / end users** → [docs/guide/README.md](docs/guide/README.md) (Spanish)
- **Domain vocabulary** (canonical terms, required reading) → [CONTEXT.md](CONTEXT.md)
- **Architecture deep dives** → `docs/obsidian-brain/` (open as an Obsidian vault; start at `00 - Home.md`)
- **Decisions (ADRs)** → `docs/adr/`
- **Design system** → `docs/styleguide/design-system.md` and [docs/sintesis-ds.md](docs/sintesis-ds.md)
- **AI agents / Claude Code** → [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and the nearest `AGENT_CONTEXT.md` to the code you're touching

## Working in this repo

Three rules save the most pain:

1. **Use the domain language.** Terms like *Plantilla Tenant*, *Instancia de Obra*, *Sincronizacion No Destructiva*, *Cambio Destructivo*, *Migration Run*, and *Lineage Row Key* are defined in [CONTEXT.md](CONTEXT.md). Don't invent synonyms.
2. **Database, permissions, extraction, and migration behavior are governed.** Check `docs/adr/` and the relevant `AGENT_CONTEXT.md` before touching them.
3. **UI goes through the design system.** Import primitives from `@/components/ui/*` and use token classes; read `docs/styleguide/design-system.md` before changing product UI.

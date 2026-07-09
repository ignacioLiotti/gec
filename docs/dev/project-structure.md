# Project Structure

A guided map of the repository. Every major folder also has an `AGENT_CONTEXT.md` with local rules — this page is the overview; those files are the detail.

```
multi-tenant/
├── app/                    # Next.js App Router — every URL in the product
│   ├── api/                #   HTTP route handlers (thin; logic lives in lib/)
│   ├── excel/              #   MAIN SURFACE: obras spreadsheet + obra detail tabs
│   ├── admin/              #   tenant admin: users, roles, invitations, defaults
│   ├── auth/ onboarding/   #   Supabase auth + first-run flows
│   ├── certificados/       #   certificate views
│   ├── macro/              #   cross-obra macro tables
│   ├── document-ai/        #   auditable AI runs over obra documents
│   ├── document-generation/#   template-generated documents + review cycle
│   ├── dashboard/ dashboard2/ notifications/ billing/ whatsapp/ profile/ ...
│   └── landings/           #   public marketing pages (own visual rules)
├── components/
│   ├── ui/                 #   design-system primitives — the only UI import layer
│   ├── form-table/         #   core editable grid (high impact)
│   ├── data-table/ viewer/ report/ event-calendar/ quick-actions/ ...
│   └── *.tsx               #   app shell (sidebar, breadcrumbs, tabs, wrappers)
├── design-system/          # "Sintesis" tokens + tailwind preset (consumed via components/ui)
├── lib/                    # shared business logic (tablas, lineage, data-flow,
│                           #   macro-tables, permissions, billing, security, ...)
├── hooks/                  # small generic React hooks
├── utils/                  # supabase client factories + date helpers
├── types/                  # shared standalone types (data-grid)
├── supabase/               # config.toml, migrations/, seed.sql
├── emails/                 # React Email templates
├── workflows/              # durable workflows ("use workflow" / "use step")
├── scripts/                # one-off operational scripts (backfills, demo seed)
├── tests/                  # vitest (lib/app/components) + playwright (e2e)
├── docs/                   # you are here — see docs/README.md
├── remotion/               # promo video (standalone asset)
└── public/                 # static assets
```

## The dependency direction

```
app/ (routes, pages)  ──►  lib/ (business logic)  ──►  utils/supabase (clients)
        │                        │
        ▼                        ▼
components/ (shared UI)   supabase/migrations (schema contract)
        │
        ▼
components/ui ──► design-system (tokens)
```

- Routes call `lib` helpers; `lib` never imports from `app/` or `components/`.
- UI primitives wrap the design system; app code never imports `design-system/*` directly.
- The database schema (+ RLS) is the ultimate contract; migrations change it, ADRs govern it.

## Root-level files worth knowing

| File | Purpose |
| --- | --- |
| `CONTEXT.md` | Canonical domain vocabulary + business rules |
| `AGENTS.md` / `CLAUDE.md` | Contract for AI agents |
| `proxy.ts` | Request proxy entry |
| `instrumentation.ts` / `instrumentation-client.ts` / `sentry.*.config.ts` | Observability wiring |
| `env.example` | Template for `.env.local` (local Supabase values preset) |
| `playwright.config.ts` / `vitest.config.ts` / `vitest.setup.ts` | Test configs |
| `components.json` | shadcn/ui generator config |
| `pnpm-workspace.yaml` | Workspace config (design-system package) |

## Naming conventions

- Route-local, non-routed folders use a `_` prefix: `_components/`, `_hooks/`.
- Dynamic segments: `app/excel/[obraId]/…`.
- Domain terms stay in Spanish (`obras`, `certificados`, `tablas`); infrastructure vocabulary in English.
- Test files mirror source paths: `lib/lineage.ts` → `tests/lib/lineage.test.ts`.

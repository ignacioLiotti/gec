# Architecture Overview

tags: #architecture #stack #overview

## App Identity

**Name:** Sintesis — a multi-tenant construction project management SaaS.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui (orange theme) + Tailwind CSS |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Supabase Auth (JWT-based) |
| Realtime | Supabase Realtime (Postgres Changes) |
| State | TanStack React Query (5min staleTime, no refetch-on-focus) |
| Table | TanStack React Table + TanStack React Form (in FormTable) |
| Email | Resend |
| Observability | Sentry (client + server + edge) |
| Testing | Vitest (unit) + Playwright (e2e) |
| Storage | Supabase Storage (`obra-documents` bucket) |
| 3D Viewer | Autodesk Platform Services (APS) |
| Workflow Engine | **Temporal.io** via `workflow` npm package (`"use workflow"`, `"use step"` directives) |
| OCR | OpenAI GPT-4o-mini via Vercel AI SDK (`generateObject`) |
| Materials OCR | Google Gemini 2.5 Flash (vision) |
| PDF | Puppeteer Core + `@sparticuz/chromium` (serverless) |
| Rate Limiting | Upstash Redis (sliding window) |

---

## File Structure Philosophy

```
app/                    Next.js App Router
  (route-groups)/       Grouped layouts without URL segment
  admin/                Admin-only pages
  api/                  REST API routes (server-only)
  excel/[obraId]/       Main workspace per obra
  macro/                Macro table views

components/             Shared UI components
  ui/                   shadcn/ui primitives
  form-table/           Core editable table component (the "engine" of the app)
  app-sidebar.tsx       Navigation sidebar
  event-calendar/       Full-featured calendar component
  report/               Report builder and renderer
  viewer/               PDF + 3D document viewer

lib/                    Business logic (server + shared)
  tablas.ts             Schema types, date/number parsing, formula eval
  macro-tables.ts       Macro table types and DB mapping
  notifications/        Notification delivery engine
  workflow/             Workflow execution helpers
  email/                Email templates and sending
  security/             Rate limiting, request signing, secrets
  engine/               Flow state machine (PMC flow)

utils/supabase/
  server.ts             Server-side Supabase client (SSR cookies)
  client.ts             Browser Supabase client
  admin.ts              Service role client (bypasses RLS)

tests/
  e2e/                  Playwright end-to-end tests
  lib/                  Vitest unit tests
  components/           Component-level tests
```

---

## Request Lifecycle

> **Note:** There is NO `middleware.ts`. Auth and tenant resolution happen inside server components and route handlers, not middleware.

```
Browser Request
    ↓
Next.js App Router (no middleware interceptor)
    ↓ page.tsx (server component)
    ↓ createClient() → Supabase session
    ↓ resolveTenantMembership() → active tenant
    ↓
React Client Components
    ↓ TanStack React Query (data fetching + caching)
    ↓ API calls to /api/* routes
    ↓
API Routes (app/api/)
    ↓ createClient() verifies auth
    ↓ resolveTenantMembership() gets tenant
    ↓ Supabase queries (RLS enforced by JWT)
    ↓
PostgreSQL (Supabase)
    Row Level Security policies on every table
```

---

## Data Flow

```
User Action (UI)
    → React Query mutation
    → /api/[entity]/route.ts
    → Supabase (RLS-protected)
    → Optional: notification engine emit
    → Optional: workflow trigger
    → Optional: email/calendar side-effect
```

---

## Multi-Tenancy Architecture

- Every table has `tenant_id` column
- PostgreSQL RLS policies enforce `tenant_id = auth.jwt() -> 'tenant_id'`
- Tenant is resolved per-request via `active_tenant_id` cookie
- Users can belong to multiple tenants (many-to-many via `tenant_memberships`)
- Switching tenants sets a new `active_tenant_id` cookie

See: [[02 - Multi-Tenancy & Auth]]

---

## Key Design Decisions

1. **Obras as the central entity** — everything hangs off an obra (project)
2. **Tablas are flexible** — each tabla has a dynamic schema (columns defined per obra)
3. **Form-table is the UI workhorse** — used for obras list, certificates, and any tablas
4. **Macro tables aggregate** — pulling from multiple obra tablas into one cross-obra view
5. **Workflow system handles async** — notifications, emails, reminders run via workflow engine
6. **Admin panel is tenant-scoped** — each tenant's admin configures their own structure

---

## Related Notes

- [[02 - Multi-Tenancy & Auth]]
- [[03 - Routing & Navigation]]
- [[24 - Database Schema]]
- [[25 - API Reference]]

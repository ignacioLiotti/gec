# Agent Context: app

## Purpose

Next.js App Router root. Every URL of the product lives here: product pages, admin surfaces, auth flows, and all API routes (`app/api/**`, which has its own context file). Use this file to find the right route folder fast, then work locally inside it.

## Route map

- `excel/` — **main product surface**: the global obras spreadsheet view and the per-obra detail (`excel/[obraId]/` with tabs for documents, file manager, insurance policies, etc.). Has its own `AGENT_CONTEXT.md`; read it before editing anything here.
- `admin/` — tenant administration: users/invitations, roles, obra defaults, configuration. Has its own `AGENT_CONTEXT.md`.
- `api/` — all HTTP API routes. See `app/api/AGENT_CONTEXT.md`.
- `auth/` — sign in / sign up / callback flows (Supabase Auth).
- `onboarding/` — first-run tenant/user onboarding.
- `invitations/` — invitation acceptance flow.
- `tenants/` — tenant selection/switching.
- `dashboard/`, `dashboard2/` — dashboard views (`dashboard2` is the newer iteration; verify which one a task targets before editing).
- `certificados/` — certificate (certificado de avance) views.
- `macro/` — macro table (cross-obra consolidation) views.
- `document-ai/` — Document AI runs (natural-language queries over obra documents with auditable outputs).
- `document-generation/` — template-driven generated documents (borradores, revision, approval).
- `notifications/` — notifications center.
- `billing/` — subscription/billing pages (MercadoPago).
- `whatsapp/` — WhatsApp integration surfaces.
- `profile/` — user profile settings.
- `landings/`, `page.tsx` — public landing pages (domain-specific visual rules; not the product design system).
- `privacy/` — legal pages.
- `demo/`, `r/` — demo links / short-link redirect surfaces backed by `lib/demo-session.ts`.
- `certexampleplayground/`, `permissions-demo/`, `system-design/` — internal playgrounds/labs; not customer-facing. Keep production-gated.

## Local rules

- Server components fetch data with `createClient()` from `@/utils/supabase/server` and check `supabase.auth.getUser()`; client components use `@/utils/supabase/client` and TanStack Query.
- Route access is governed by `lib/route-access.ts` / `lib/route-guard.ts`. Do not hand-roll permission checks in pages.
- All tenant-scoped queries must respect the active tenant (cookie `active_tenant_id`) and RLS; never widen a query beyond the tenant.
- Directories prefixed with `_` (e.g. `_components/`, `_hooks/`) are route-local and intentionally excluded from routing.
- Product UI imports primitives from `@/components/ui/*` and uses design-system token classes. Landing pages, report/document output, and viewer canvases keep their own visual systems.
- Prefer editing the route-local component over adding props to shared components.

## Related documentation

- `docs/obsidian-brain/03 - Routing & Navigation.md`
- `docs/obsidian-brain/02 - Multi-Tenancy & Auth.md`
- `docs/obsidian-brain/27 - User Flow Walkthrough.md`
- `docs/route-access-configuration.md`
- Local contexts: `app/excel/AGENT_CONTEXT.md`, `app/admin/AGENT_CONTEXT.md`, `app/api/AGENT_CONTEXT.md`

## Validation

- `pnpm lint`
- Targeted Playwright specs under `tests/e2e/**` for navigation/flows touched.
- Route smoke check via `pnpm dev` for pages without e2e coverage.

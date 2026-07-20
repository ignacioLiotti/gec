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
- `dashboard/` — the live dashboard (linked from the sidebar, auth callback, and onboarding). `dashboard2/` is an unlinked internal prototype (see `docs/feature-capture-catalog.md`); do not treat it as the shipping dashboard.
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
- Route entry convention: `page.tsx` is a server component (auth, initial data, metadata, `<Suspense>`); interactivity lives in a sibling `*-client.tsx` / `page-client.tsx`. Do not put `"use client"` in a `page.tsx` — `app/excel/page.tsx` and `app/macro/page.tsx` are the reference pattern. (`app/dashboard/page.tsx` and `app/admin/obra-defaults/page.tsx` predate this rule and are pending migration.)
- Pairs that look like duplicates but are not: `tabs/documents-tab.tsx` and `tabs/documents-new-tab.tsx` are both live (distinct tabs, mid-transition), and `excel/desktop-excel-page-full.tsx` / `-preview.tsx` implement deliberate progressive loading. Confirm wiring in the consumer before deleting anything with a "new"/"full"/"preview" suffix.

## Visual product map (FigJam)

FigJam is the required visual companion to the code and domain documentation for user-visible product behavior. Code, tests, domain docs, and ADRs remain authoritative; keep the visual maps synchronized with them instead of changing implementation merely to match an outdated board.

### Boards

- [Product OS / dashboard](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P) - actors, navigation, central value flow, backlog, and recently shipped work.
- [Journeys 01 / Inicio y Obras](https://www.figma.com/board/W6SZcSjlbhn1XdFLSktU03) - invitation, onboarding, daily obra work, tenant templates, and obra lifecycle.
- [Journeys 02 / Datos y Reportes](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb) - reimport/lineage, data-flow, certificates, insurance policies, and macro tables.
- [Journeys 03 / Documentos y Automatizacion](https://www.figma.com/board/nnPSyRwgsNseS3cm9BIMTp) - generated documents, Document AI, reminders, completion workflows, and WhatsApp.
- [Journeys 04 / Plataforma y Acceso](https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF) - shared reports, users/permissions, impersonation, billing, deletion/restoration, and 3D models.
- [Screenshots actuales](https://www.figma.com/board/mC50ck1vEmJzOvrdW9s9AU) - sanitized current product screenshots.

FigJam Free does not provide additional pages for this workspace, so the visual system is intentionally split across these linked files.

### Required maintenance

Update the main board and the relevant journey board when a change:

- adds a user-visible feature, screen, state, decision, branch, or actor;
- changes navigation, ordering, permissions as experienced by a user, automation timing/effects, or a data flow;
- removes, deprecates, renames, or materially changes an existing capability;
- touches an existing user-visible flow that is not represented yet; add the missing current flow before documenting the change;
- moves planned work through `Inbox`, `Next`, `Building`, `Verify`, or `Shipped`.

For a shipped change, record the date and commit hash when one exists. Distinguish confirmed behavior from planned or inferred behavior; do not present a proposal as implemented.

### Screenshots

- Add or replace screenshots when the visible UI changes materially. Prefer a before/after pair when it explains the change better than one image.
- Put sanitized screenshots in the screenshots board and next to the relevant journey when practical.
- Use demo/local data or redact sensitive content. Never upload tenant data, personal information, credentials, tokens, secrets, private URLs, or production-only identifiers to FigJam.
- If no representative screen exists yet, keep a clearly labeled screenshot placeholder rather than inventing one.

### Agent workflow

1. Before implementing user-visible work, inspect the Product OS board and the relevant journey board.
2. Confirm whether the current flow exists and is accurate. Add missing existing behavior before layering the proposed change on top.
3. After implementation and validation, update nodes, branches, status, screenshots, backlog position, and shipped metadata affected by the change.
4. In the final response, name the FigJam boards updated and describe any visual documentation gap that remains.

If Figma access or authentication is unavailable, do not silently skip the update. Report the exact board, nodes/flow, status, and screenshots that still need changing so the gap is actionable. Do not use the unavailable board as justification to guess product behavior.

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

# Agent Context: components

## Purpose

Shared React components used across routes. Route-local components live next to their route under `app/**` (often in `_components/`); only genuinely shared pieces belong here.

## Area map

- `ui/` — design-system primitives (buttons, dialogs, tables, sidebar…). Import via `@/components/ui/*`. Has its own `AGENT_CONTEXT.md`.
- `form-table/` — the editable dynamic-table grid used for tablas de extraccion and the obras spreadsheet. High-impact; has its own `AGENT_CONTEXT.md`.
- `data-table/` — TanStack-table based display tables (column visibility, filters).
- `viewer/` — document/file viewer canvases (domain-specific visuals; not standard token styling).
- `report/` — report/document rendering output (domain-specific visuals).
- `event-calendar/` — calendar views.
- `quick-actions/` — quick-action entry points (see `docs/quick-actions.md`).
- `notifications/` — notification UI.
- `forms/`, `auth/`, `invitations/`, `expenses/` — feature-scoped shared components.
- `demo-flows/`, `demo-tours/` — demo/guided-tour machinery.
- `motion/` — animation helpers.
- Top-level files — app shell pieces: `app-sidebar.tsx`, `pathname-layout-shell.tsx`, `main-wrapper.tsx`, `page-breadcrumb.tsx`, `excel-page-tabs.tsx` (dark pill top-nav tabs reference), `navigation-progress.tsx`, `tenant-switch-button.tsx`, plus chart/visual one-offs (`advance-curve-chart*.tsx`, `ascii-*`, `dither-effect.tsx`).

## Local rules

- Product UI must use `@/components/ui/*` primitives and design-system token classes. Read `docs/styleguide/design-system.md` before visual changes.
- Do not import from `@/design-system/*` directly; that layer is consumed through `components/ui`.
- Keep report/viewer/calendar/landing visuals on their existing domain-specific rules unless the task targets them explicitly.
- Shared components should stay tenant-agnostic: data comes in via props or route-level hooks, not module-level fetches.
- `form-table/` changes ripple across the whole product — read its context file and run its tests before editing.
- Use `cn()` from `@/lib/utils` for class merging; follow existing prop patterns before adding new variants.

## Related documentation

- `docs/styleguide/design-system.md`, `docs/sintesis-ds.md`
- `docs/styleguide/table-bulk-edit.md`
- `docs/obsidian-brain/05 - Tablas (Data Tables).md`, `docs/obsidian-brain/06 - Excel View.md`
- `components/form-table/AGENT_CONTEXT.md`, `components/ui/AGENT_CONTEXT.md`

## Validation

- `pnpm lint`
- Targeted Vitest under `tests/components/**`.
- Visual check via `pnpm dev` for styling changes.

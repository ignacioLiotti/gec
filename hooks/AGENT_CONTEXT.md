# Agent Context: hooks

## Purpose

Small shared React hooks with no feature ownership. Feature-specific hooks live next to their feature (route-local `_hooks/` dirs or `lib/**`).

## Main files

- `use-callback-ref.ts` — Radix-style stable callback ref; avoids re-renders/effect re-runs when callbacks are passed as deps.
- `use-debounced-callback.ts` — debounced callback built on `useCallbackRef`; cleans up its timer on unmount.
- `use-mobile.ts` — `useIsMobile()`, media-query listener at the 768px breakpoint. Returns `false` during SSR/first paint (state starts `undefined`).
- `use-tenant-admin-status.ts` — client-side check of the current user's admin/superadmin status for the active tenant (reads `active_tenant_id` cookie, queries `profiles` + `memberships`). UI convenience only — **never a substitute for server-side authorization**.
- `use-data-grid.tsx` — data-grid state hook backing grid components (pairs with `lib/data-grid.ts` and `types/data-grid.ts`). The largest file here; read it fully before changing grid behavior.

## Local rules

- Hooks here must be generic and dependency-light; if a hook needs feature knowledge, it belongs next to the feature.
- `use-tenant-admin-status` results gate visibility only; the server (route guards, RLS) remains the enforcement layer.
- Breakpoint changes in `use-mobile.ts` must stay consistent with Tailwind's responsive classes used across the app.

## Related documentation

- `docs/obsidian-brain/26 - Key Libraries & Utilities.md`
- `docs/obsidian-brain/02 - Multi-Tenancy & Auth.md` (for the admin-status hook)

## Validation

- `pnpm lint`
- Grep consumers (`rg "use-debounced-callback"` etc.) when changing signatures.

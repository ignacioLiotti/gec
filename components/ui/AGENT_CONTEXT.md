# Agent Context: components/ui

## Purpose

The shared UI primitive layer — shadcn/ui-style components adapted to the "Sintesis" design system (orange primary `#ff5800`, lifted button recipe, tray+chip tabs, notch details). This is the **only** layer app code should import UI primitives from (`@/components/ui/*`).

## Main files

- Standard shadcn-derived primitives: `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`, `input.tsx`, `table.tsx`, `card.tsx`, `badge.tsx`, `tooltip.tsx`, `sheet.tsx`, `popover.tsx`, `command.tsx`, etc. Built on Radix; variants via `class-variance-authority`.
- Sintesis-specific pieces: `tabs.tsx` (tray+chip pattern), `tray.tsx` (Tray + Chip), `notch-tail.tsx`, `glassy-icon.tsx`, `kbd.tsx`, `FolderFront.tsx` / `FolderFrontEmpty.tsx` (folder visuals).
- App-shell primitives: `sidebar.tsx` (+ `sidebar-menu-button-variants.ts`).
- Utilities: `column-resizer.tsx`, `sortable.tsx` (dnd-kit), `hydrated-date-text.tsx` (SSR-safe dates), `contextual-wizard.tsx`.

## Local rules

- Colors, spacing, radius, and shadows come from token classes / CSS variables defined in `app/globals.css` and `design-system/tokens.css`. Never hardcode hex values in primitives.
- Changing a primitive's variants or default styles affects the whole product; check `docs/styleguide/design-system.md` and `docs/sintesis-ds.md` first, and grep for usages of the variant you touch.
- Keep the shadcn conventions: `cn()` for class merging, `data-slot`/`data-state` attributes, forwarded refs, Radix composition.
- New primitives should be promoted here only when used by 2+ features; otherwise keep them route-local.
- This layer wraps `design-system/*`; app code must not bypass it.

## Related documentation

- `docs/styleguide/design-system.md` (required before visual changes)
- `docs/sintesis-ds.md` (migration guide: tokens, spacing, radius, shadows, buttons, tabs, cards, empty states)
- `design-system/README.md`

## Validation

- `pnpm lint`
- Visual pass in `pnpm dev` on at least one consumer page per changed primitive (e.g. `app/excel` for tables/tabs, `app/admin` for forms/dialogs).

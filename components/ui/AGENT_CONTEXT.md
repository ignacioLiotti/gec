# Agent Context: components/ui

## Purpose

The product import surface for Sintesis UI. Components shared with `design-system/components` are reexports; edit their canonical source there. The theme includes accessible orange controls, lifted buttons, tray+chip tabs, and notch details. App code imports primitives from `@/components/ui/*`.

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
- Run `npm run check:ui`, `npm run typecheck:ui`, and the Storybook checks after changing shared appearance or behavior. Keep screen classes to layout and density; add semantic variants at the canonical source for reusable appearance.

## Related documentation

- `docs/styleguide/design-system.md` (required before visual changes)
- `docs/sintesis-ds.md` (migration guide: tokens, spacing, radius, shadows, buttons, tabs, cards, empty states)
- `design-system/README.md`

## Validation

- `pnpm lint`
- Visual pass in `pnpm dev` on at least one consumer page per changed primitive (e.g. `app/excel` for tables/tabs, `app/admin` for forms/dialogs).

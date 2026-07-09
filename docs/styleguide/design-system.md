# Design System Rules

This is the canonical UI contract for agents working in this repository. Codex, Claude, Cursor, and any other agent should read this file before changing product UI.

The design system is project-local. It lives in `design-system/`, and the app consumes it through `components/ui/*` compatibility wrappers.

## Import Rules

- In app and feature code, import primitives from `@/components/ui/*`.
- Do not import directly from `@/design-system/*` in normal app code unless you are editing the design-system layer itself.
- Do not copy primitive source into routes, pages, or feature folders.
- Keep app-only primitives in `components/ui` until they are intentionally promoted into `design-system/components`.

Preferred:

```tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
```

Avoid:

```tsx
import { Button } from "@/design-system/components/button"
```

## Component Choices

Use the existing primitive that matches the job.

- `Button`: actions, submits, toolbar commands, icon buttons, links that behave like actions.
- `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Label`: form controls.
- `Card`: real panels, repeated item containers, dense dashboard sections. Do not use cards as decorative page wrappers.
- `Badge`: metadata, compact status labels, counts, tags, and small classifications.
- `Dialog`: focused modal tasks and confirmations.
- `DropdownMenu`: compact command menus.
- `Tabs`: switching between peer views in the same workflow.
- `Table`: structured row/column data.
- `Tooltip`: short hover clarification for icon-only or dense controls.
- `Skeleton`: loading placeholders that preserve layout.
- `Avatar`: user or entity identity marks.

Keep these app-local for now unless a task explicitly promotes them into the design system:

- `Sidebar`
- `Sheet`
- `Popover`
- `Separator`
- `ScrollArea`
- `Accordion`
- `AlertDialog`
- `Calendar`
- `Command`
- `ContextMenu`
- `Collapsible`
- `ContextualWizard`
- `Sortable`
- `ColumnResizer`
- `NotchTail`
- `FolderFront`
- `GlassyIcon`
- `Kbd`
- `HydratedDateText`
- `Tray`

## Button Rules

- Use `variant="default"` or `variant="primary"` for the main action on a surface.
- Use `variant="outline"` or `variant="secondary"` for secondary actions.
- Use `variant="destructive"` only for destructive actions.
- Use `variant="destructiveSecondary"` for soft destructive actions in dialogs or banners.
- Use `variant="success"` only for real success/proceed states.
- Use `variant="link"` for inline text actions.
- Existing `variant="ghost"` maps to the design-system tile style through the compatibility wrapper. For normal subtle buttons, prefer `outline`, `secondary`, or a future explicit variant instead of adding one-off classes.
- Use `ExpandableLightButton` for dense icon-first toolbar actions that should reveal their text label on hover, focus, or open state. Keep the former visible label in the `label` prop for accessibility.

## Badge Rules

- Use `variant="secondary"` or `variant="outline"` for neutral metadata.
- Use `variant="default"` for primary/brand metadata.
- Use `variant="success"`, `variant="warning"`, or `variant="destructive"` only when the badge communicates real state.
- Do not use arbitrary color classes on badges for decoration. Category colors are allowed only when the category meaning is real and consistent.

## Tooltip Rules

- Use `Tooltip` for icon-only buttons, dense header controls, truncated labels, and hidden affordances such as clickable titles that open a selector.
- Do not combine a custom tooltip with a native `title` attribute on the same control. It creates two visible tooltips and makes hover feedback noisy.
- For dense navigation controls in headers, sidebars, or sticky bars, prefer a high-contrast tooltip style: `bg-stone-950 text-white border-stone-950` with compact padding and `text-xs`.
- If a tooltip can overlap a sidebar, sticky header, clipped container, or disabled button wrapper, render it through a portal or fixed-position layer above app chrome. Do not rely on an absolutely positioned child inside the clipped layout.
- Disabled buttons do not always fire tooltip triggers consistently. Wrap the disabled button in a focusable/hoverable inline wrapper when the tooltip still needs to explain the disabled control.
- Combobox triggers hidden behind an entity name still need a tooltip or clear hover/focus affordance explaining that clicking opens navigation or selection.

## Color Tokens

Use token classes for product UI structure.

| Purpose | Token classes |
| --- | --- |
| Page background | `bg-canvas` |
| Muted page background | `bg-canvas-muted` |
| Panels and controls | `bg-surface` |
| Cards | `bg-card` |
| Raised panels | `bg-surface-raised` |
| Recessed wells | `bg-surface-recessed` |
| Main text | `text-content` |
| Secondary text | `text-content-secondary` |
| Muted text | `text-content-muted` |
| Disabled text | `text-content-disabled` |
| Soft borders | `border-stroke-soft` |
| Default borders | `border-stroke` |
| Strong borders | `border-stroke-strong` |
| Primary action | `bg-orange-primary text-primary-foreground` |

Replace structural hardcoded colors when editing nearby UI:

- `bg-white` on product panels -> `bg-surface` or `bg-card`
- `bg-stone-50`, `bg-stone-100`, warm page fills -> `bg-canvas`, `bg-surface-muted`, or `bg-surface-recessed`
- `border-stone-200`, `border-stone-300`, hardcoded neutral borders -> `border-stroke-soft` or `border-stroke`
- `text-stone-900`, `text-stone-950` -> `text-content`
- `text-stone-500`, `text-stone-600`, `text-stone-700` -> `text-content-muted` or `text-content-secondary`

## Semantic Colors

Use semantic colors only for actual meaning.

- `success`: completed, valid, healthy, enabled, passed.
- `warning`: risk, pending attention, partial, caution.
- `destructive`: delete, remove, failed, blocked, dangerous.
- `primary`/`orange-primary`: main action or brand emphasis.

Do not use green, yellow, red, or blue merely to make an area more visually interesting.

## Spacing And Density

This app is an operational product. Prefer dense, calm spacing.

Default spacing:

- Small inline gaps: `gap-1.5`, `gap-2`
- Control groups: `gap-2`, `gap-3`
- Panel padding: `p-3`, `p-4`
- Larger panels: `p-5`, `p-6` only when the content needs it
- Section gaps: `gap-4`, `gap-6`
- Avoid page-scale marketing spacing such as large `py-20` sections in product UI

Token spacing is available through the design system:

- `acme-xs`: `0.5rem`
- `acme-sm`: `0.75rem`
- `acme-md`: `1rem`
- `acme-lg`: `1.5rem`
- `acme-xl`: `2rem`
- `acme-2xl`: `3rem`

## Layout Rules

- Build quiet, dense, operational SaaS UI.
- Prefer sidebars, top bars, tables, forms, compact panels, and full-width work surfaces.
- Do not create marketing heroes inside authenticated app surfaces.
- Do not nest cards inside cards unless the inner card is a repeated item with clear boundaries.
- Do not add decorative gradient blobs, ornamental backgrounds, or one-off visual flourishes.
- Do not add visible instructional text that explains obvious UI behavior.
- Keep toolbars and table controls stable in size so hover states and labels do not shift layout.

## Exceptions

Do not blindly migrate these surfaces to product tokens:

- Report/document output CSS such as `.report-paper`.
- Chart series colors.
- Calendar/event category colors.
- Static landing pages and marketing pages.
- Generated previews, document viewers, OCR overlays, and file viewer canvases.
- Domain-specific status/category colors where the color encodes real meaning.

When touching an exception surface, preserve its domain semantics and only replace structural neutrals when it is clearly safe.

## Creating Or Changing Components

- Before creating a new component, check `components/ui` and `design-system/components`.
- If the component is a reusable primitive, add it to `design-system/components` first, then expose it through `components/ui`.
- If the component is feature-specific, keep it near the feature and build it from existing primitives.
- Do not add a new color, shadow, radius, or motion recipe unless an existing token cannot represent the need.

## Review Checklist

Before handing back UI work, check:

- App code imports primitives from `@/components/ui/*`.
- New product UI uses token classes for structure.
- Hardcoded colors are limited to real semantic, chart, calendar, report, or landing needs.
- Spacing is dense and consistent.
- No nested decorative cards were introduced.
- No app-only primitive was copied into a route.
- Any new reusable pattern is documented in `docs/styleguide`.

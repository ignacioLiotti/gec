# ADR 0035: Canonical UI components and screen variants

Date: 2026-09-07
Status: Accepted

## Problem

The app and design-system folders contained 17 separate implementations of the same primitives. Screens also replaced primitive appearance, while policy states, OCR badges, permission selectors, and a row menu had independent implementations. A fix in one location did not reach the others.

## Decision

`design-system/components` owns the overlapping primitives. `components/ui` reexports them without redefining variants or behavior. Preserve the shipping app's composition contracts, including CardAction, dialog close controls, compact field sizes, and expandable toolbar buttons. Merge the additional library variants into that contract.

Screens select semantic variants and keep layout and domain behavior. NativeSelect preserves native form events; Input, Textarea, SelectTrigger, and the Button field variant share one field recipe. Document output, calendars, charts, viewer/data-flow canvases and spreadsheet cell editing retain their domain rules.

Palette values live in tokens.css. The TypeScript map distinguishes full CSS colors from HSL channel tokens. Orange text and solid controls use accessible theme-specific colors. Ghost is a subtle action; ghost-tile is explicit.

Share the policy-state calculation between dashboard and obra detail. Check expired coverage before a later calculated cancellation date, preserving the obra screen's existing precedence and 60-day cancellation warning window. Share its labels and tones, OCR status metadata, and the permission choice control. Replace the editor's custom row menu with the existing Radix dropdown.

## Consequences

Changes to a primitive now reach both Storybook and product screens. Some screen colors, borders and shadows intentionally change to their shared variants. Product imports remain stable. No database, authorization, persistence, or external API contracts change.

The catalog has one implementation per component, with gallery controls for variants and composed behavior examples. `npm run check:ui` rejects redefined wrappers and direct appearance overrides on core product primitives. It is a source guard, not a substitute for reviewing computed styles or rendered pages.

Validation uses source and Storybook TypeScript checks, a static Storybook build, both-theme rendering, color-token/contrast checks, keyboard interactions, and focused policy regression tests. The source TypeScript config excludes generated Next files so stale generated output cannot prevent checking the actual app code.

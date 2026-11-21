# ADR-0034: Storybook for the existing component layers

## Status

Accepted

## Date

2026-09-07

## Context

The reusable UI lives in both `components/ui` and `design-system/components`. Several app implementations differ from the shared versions. A catalog of only one layer would conceal existing visual variations.

## Decision

Use Storybook with the Next.js Vite framework as development tooling. Keep stories under `stories/`, with separate App UI and Shared system groups. Import existing components and product CSS directly. Do not relocate components or consolidate their variants as part of extraction.

Load a minimal Next configuration for Storybook so component builds do not execute application workflow or Sentry plugins. Keep production scripts unchanged. Use the PostCSS object plugin format, which both builders accept.

## Consequences

Both implementations remain inspectable. Component changes appear in the catalog automatically, but new options require new stories. Light and dark previews expose the current styling, including incomplete dark styling. Browser checks render every indexed story in both themes and exercise representative interactions.

The tooling adds development dependencies and static build output. It does not change storage, tenant behavior, permissions, or product flows. No domain or FigJam changes are required for this developer catalog.

## Alternatives considered

- Copying component source into a separate project would let the catalog drift from the app.
- Showing only the shared layer would omit app-specific styles and components.
- A product route would require the application runtime and mix developer documentation with product navigation.

## Related files

- `.storybook/main.ts`
- `.storybook/preview.tsx`
- `stories/README.md`
- `stories/coverage.md`
- `scripts/check-storybook.mjs`
- `docs/styleguide/design-system.md`

## Related domain docs

None. This decision concerns component development tooling.

## Consolidation follow-up (2026-09-07)

[ADR 0035](./0035-canonical-ui-components-and-screen-variants.md) replaces the separate app/shared implementations with canonical components and one story per component. Variant galleries remain the entry point; current inventory and checks live in `stories/README.md`.

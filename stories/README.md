# Design system Storybook

Run `npm run storybook` and open http://localhost:6006. Buttons, light buttons, expandable buttons, badges, alerts, and toasts each have one Playground showing every variant together. Controls apply size, shape, content, icons, and state across the gallery. The toolbar switches between light and dark.

```sh
npm run check:ui
npm run typecheck:ui
npm run typecheck:storybook
npm run build-storybook
npm run test:storybook
```

The browser check requires a completed static build and the Chrome installed by the existing Puppeteer dependency. It starts a temporary server, renders every indexed story in both themes, exercises interactions, measures settled button/badge text contrast, checks token resolution, and captures desktop/mobile screenshots in `.codex-tmp/`.

## Scope and ownership

- **Foundations** documents live colors, surfaces, spacing, radius, shadows, typography, motion, layers, and breakpoints.
- **App UI** consumes `components/ui` imports. The 17 modules that previously duplicated `design-system/components` are now re-exports of the canonical implementation and share the same stories.
- **Shared system** contains Alert and Toast, which have no matching app wrapper.
- **Patterns / Shared behavior** covers permission choices, policy statuses, OCR statuses, Slot composition, form states, and menus inside dialogs with sanitized fixtures.

Compound exports are exercised in their parent compositions. Utility exports are covered through their components. The catalog includes declared variants, sizes, shapes, mixed/disabled/invalid states, overlays, tables, navigation, calendars, sorting, resizing, and folder visuals. Hover and focus use real component CSS.

Reports, document output, charts, calendars, viewer canvases, and spreadsheet cell editors retain their domain-specific presentation. See the design-system guide for the precise exceptions. The catalog does not reproduce authenticated product routes.

## Configuration and maintenance

Storybook uses Next.js Vite and development dependencies. It loads `app/globals.css`, the real fonts, and the tooltip provider. Theme/font classes apply to the document root so portaled content inherits them. `.storybook/next.config.mjs` omits application workflow/Sentry build plugins; `@` still resolves to the repository root.

Add public variants to the existing playground and its controls. Add working compositions for new modules. Run `npm run check:ui` to reject duplicate implementations, direct product imports of the design-system layer, and local appearance overrides on managed controls; this also runs before ESLint. The guard inspects static classes, not arbitrary helper return values or inline style objects.

The index includes component galleries and screen compositions, exercised in both themes. Interaction checks cover mixed checkboxes, chip selection, Slot composition, permission selection, nested menus and focus return, selects, dialogs, tabs, command filtering, and keyboard sorting. Contrast checks cover all button, light-button, and badge variants.

See [coverage](./coverage.md), [the product guide](../docs/styleguide/design-system.md), and [ADR 0035](../docs/adr/0035-canonical-ui-components-and-screen-variants.md).

## Motion comparison

[Motion / Pantallas](./motion/screens/README.md) composes the references into Excel, Obra, Documentos and General examples, with local create/edit/review flows, error simulation and motion preference controls.

[Motion / Comparacion](./motion/README.md) contains 40 source-backed examples from Interior and Beautiful UI, with component-specific variants, provenance links, catalog filters, and reduced/animated comparisons. The loading example uses the canonical Sintesis Button; the other reference compositions use scoped Sintesis tokens. Source motion constants and choreography are retained. These experimental copies do not replace product components. The browser suite checks every example and variant in both themes, motion timing, keyboard/focus behavior, and mobile layout.

For a stable preview of the verified build, run `npm run storybook:preview`. It serves `storybook-static` on localhost:6006. Rebuild and refresh after changes; this mode does not hot reload. The motion comparison was verified in this mode after the development server stopped responding.

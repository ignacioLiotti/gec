# Screen examples

`Motion / Pantallas` has four screen examples and a navigable Playground. All actions update local React state using sanitized fixtures. No authenticated route, API, storage client, or real document is loaded.

| Screen | Interactions | Reference components |
| --- | --- | --- |
| Excel | Search, status filter, sorting, create and confirm a fixture import, open an obra | Interior SortableTable, Dropdown, Drawer, InlineValidation, LoadingButton, ProgressBar |
| Obra | Header and tabs, General content, local team notes, latest extraction, open Documents | Product ExcelPageTabList with Interior panel spring; Beautiful ToolChips |
| Documentos | Folder tree, search and status filtering, document drawer, asynchronous confirmation and retry | Interior TreeView, SortableTable, Drawer, LoadingButton; Beautiful SegmentedControl, ToolChips, LoadingState |
| General | Edit name, client and certified amount; validate, save or retry; inspect financial changes and expand deadlines | Interior InlineValidation, LoadingButton, ValueFlash, ProgressBar, Accordion |

Imports use the pinned MIT references in `../vendor/manifest.json`, with their original motion constants and the existing scoped Sintesis token adaptations. The product Excel header, table surface, canonical UI controls and AdvanceCurveChart are reused. This example's static General layout illustrates those interactions; production layout remains owned by data-flow configuration under ADR 0005.

## Published identity reference

The user selected https://sintesis.dev as the visual reference. `published-theme.json` records computed light/dark custom properties read from its public page, which redirects to https://www.sintesis.dev/, on 2026-09-08. `published-theme.css` applies those values only to these screen examples and their portals. This is a dated reference snapshot, not a replacement for the local design-system palette. It deliberately preserves published values rather than approximating them or changing global product tokens. Local tokens introduced during the previous consolidation differ from the deployed site.

| Location | Previous example | Current ownership |
| --- | --- | --- |
| Brand | Invented square S and uppercase wordmark | Shared AppBrand extracted unchanged from AppSidebar: orange circle, mono wordmark and subtitle |
| Sidebar | Custom 180px white column and generic Button | Product Sidebar components, 256px width, published sidebar tokens and SidebarMenuButton |
| Route tabs | Interior folder-shaped tabs | Shared ExcelPageTabList with the published transparent tray / rounded rectangle recipe, with Interior's panel movement; only the two implemented example destinations are shown |
| Actions | Reference LoadingButton and generic import button | Canonical Button with Interior async state and crossfade; product ExpandableLightButton for import |
| Theme | Local modified palette | Computed published orange `21 100% 50%`, surfaces, text, shadows and sidebar values, inherited by portals |

The public theme capture does not authenticate or read tenant data. Product brand/tab extraction changes ownership only; existing route defaults and markup are preserved. The screen browser check asserts the published orange, sidebar background, real tab active fill/icons, and portal inheritance, in addition to the existing interactions.

Canvas controls select a screen, reduce motion, simulate a save failure, and reset the fixtures. OS reduced motion also applies. Nested Beautiful surfaces inherit reduced motion, including inside Interior portals. Closing a verified document remains a focusable action so keyboard dismissal continues working after confirmation.

Verification: `npm run typecheck:storybook`, focused ESLint, `npm run build-storybook`, and `node scripts/check-motion-screens.mjs` against the static preview. The screen checks are also included in `npm run test:storybook`: light/dark desktop/mobile rendering, create/edit/confirm flows, retained drafts after errors, retry, folder filters, Escape/focus return, inherited motion preference, and absence of product API requests. Screenshots are saved to `.codex-tmp/motion-screen-*.png`.

These are Storybook experiments, not a shipped feature or a change to production navigation, permissions or extraction. No domain/ADR/FigJam change is required for this scope.

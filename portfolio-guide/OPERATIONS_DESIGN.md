# Operations presentation

Reference: the user-provided Visitors screenshot, associated with https://visitors.now/sintesis.dev. The web reader could not open that URL; the attached screenshot supplied the visual evidence. The design follows its continuous background, open spacing and readable metrics. It does not copy its traffic chart or introduce analytics data.

## Scope and coverage

Full review within `OperationalWorkspace`, the component used by the portfolio Operations screen. React, existing CSS Modules, shared UI components and project tokens. The separate dashboard route coordinator and its data loading are outside this change.

| Category | Evidence | Result |
| --- | --- | --- |
| Typography | Component, labels, numeric values, desktop/mobile captures | Sentence-case labels, tabular figures, consistent percentage decimals, shorter visual hierarchy |
| Surfaces | Workspace, KPIs, chart, signals, works and review list | Continuous background; cards removed where spacing and headings already group information |
| Motion | Existing entrance effects; shared disclosure at normal speed, 10% playback and reduced motion | Removed staggered page entrance and document tilt; shared 150ms disclosure and Escape checked |
| Icons | Header, project numbers, review rows | Existing Lucide family; one file icon replaces decorative document thumbnails |
| Performance | Changed imports and removed decorative markup/animations | No new dependency; no runtime performance profile or benchmark claimed |

## Changes

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `operational-workspace.module.css`, canvas/workspace/KPIs | Large white panel inside a gray canvas, bordered KPI group | One background, centered content, unboxed metrics | Reduce competing boundaries and give figures space |
| MEDIUM | `operational-workspace.tsx`, policy section | Chart competed with the right sidebar | Full-width monthly chart before the works/activity section | Make the time distribution the main visual comparison |
| MEDIUM | CSS module, month/signal/project rules | Compressed bars and small labels, ornamental project tiles | Narrow rounded bars, count labels, quiet grid, text-based project identifiers | Use space and alignment to distinguish information |
| MEDIUM | `DetailPopover`, metric and KPI triggers | Absolute detail could be clipped by the table; Tooltip prototype closed on ancestor scroll | Shared nonmodal Popover with collision handling; hover, focus and click; Escape dismissal | Keep explanations readable during keyboard navigation and mobile scrolling |
| LOW | `DocumentCard` and notification list | Decorative mini-documents and repeated cards | File icons with title, work, time and status; simple notification rows | Keep actionable information visible without simulated document content |
| MEDIUM | CSS module, named `operations` container | Viewport breakpoints for an embedded component | Container breakpoints; two-column mobile KPIs; horizontally scrollable month chart and work table | Respond to actual available space and retain usable targets |
| LOW | CSS module, entrance and hover effects | Staggered load and document tilt | Immediate page presentation; shared detail transitions | Avoid introducing extra movement into a frequently read workspace |

## Considered and rejected

| Candidate | Reason |
| --- | --- |
| Smoothed line chart matching Visitors | Monthly policy counts are discrete. Bars preserve that meaning without implying intermediate measurements |
| Violet/orange palette copied from the reference | Keep the existing brand and risk meanings; the reference's spacing is the relevant direction |
| Replace the entire operations module with a demo-only view | The portfolio should continue using the existing component and data contract |

## Validation

Run `node portfolio-guide/operations-check.mjs`, or the combined `npm run portfolio:check`. The focused check covers month selection, KPI details, Escape, metric click/focus, a 620px component within a 1440px viewport, 390px mobile containment, and the drilldown into document review. Captures and runtime errors are saved in `artifacts/`.

Build, type check, scoped lint, UI-contract check and browser outcomes are recorded in `VALIDATION.md`. Domain rules, data contracts and token definitions did not change, so no new domain document, ADR or shared style token was needed. FigJam remains pending as described in `FIGJAM_UPDATE.md`.

Verdict: Approve for the requested local presentation. The static build, type check, scoped lint, 1,112-control UI check, full guide journey and focused Operations browser check passed. Desktop, mobile, a narrow parent and metric details were visually reviewed. No console or HTTP errors were observed. Production data loading and performance profiling were not part of this verification; FigJam synchronization is blocked by the existing tool quota.

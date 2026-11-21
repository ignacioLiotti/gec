# Visual and experience changes for the portfolio

Date: 2026-09-07. Initial review followed by a local implementation of the selected changes.

Implemented in the portfolio demo: viewport-sized chapter workspaces, contextual notes with real persistence code, an optional correction-to-export case, adjustable source/data comparison with narrow-screen tabs, compact report navigation, larger guide text and controls, explicit mobile chapter selection, ownership copy and consistent dashboard totals. Decimal delay display was corrected in the reused operations component. The tables below preserve the evidence and rationale from the review; proposed package extraction and broader product refactors remain future work.

The first iteration should give visitors more room to use the product and make one complete task easy to follow. The source/data comparison is the strongest place to demonstrate careful engineering, so it should receive the first product-layout improvement.

## Scope and evidence

Review mode: full within the selected portfolio scope. React components in a static Vite guide; plain CSS for the guide, existing tokens and `components/ui` for product controls, with existing document/report visual rules retained.

Inspected: the guide shell and chapter copy, the existing desktop/mobile browser captures, document/data sheets, report workspace, data-flow and sample-analysis captures, and direct implementation references. This is not a complete audit of all application routes.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | `guide.css`, guide desktop/mobile captures, dashboard metrics, report and sample-analysis captures | Small guide controls, inconsistent numeric presentation and a visible floating-point remainder need attention |
| Surfaces and layout | Fixed-height guide iframe, document/data sheets, report sidebar and narrow guide navigation | Nested scrolling, overlapping review panels and repeated report navigation compete with the task |
| Animations | Existing captures used reduced motion | Timing, interruptibility and exits were not reviewed at normal or slowed playback; no animation defect is claimed |
| Icons | Guide Lucide imports and toolbar captures | No icon-family inconsistency found in the guide; some clickable controls need larger hit areas |
| Performance | Guide lazy imports and existing build record | No new timing, memory or interaction profiling performed; no performance regression is claimed |

## Findings and proposed changes

### Workflow and layout

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `portfolio-guide/guide.css:420`, chapter screen container | A 780px iframe sits inside the scrolling guide, below a large header and instructions | A compact chapter bar and a workspace using the available viewport; notes open in a reading panel; keep a clear return path | The product needs room for its own tables and scroll regions. Visitors should immediately know which area they are operating |
| HIGH | `app/excel/[obraId]/tabs/file-manager/components/document-data-sheet.tsx`, document-review capture | The data sheet covers the source at the embedded desktop width | Add a reusable comparison presentation with source and data beside one another at suitable container widths; source/data tabs on narrow screens | Keeping the source visible is necessary for the core comparison task. Reuse the existing viewer and table, with deliberate focus and close behavior |
| MEDIUM | `components/report/report-page.tsx`, report workshop sidebar | Navigation tabs and shortcut cards both expose Filters, Columns and Style | One primary control navigation, persistent essential document fields and a separate preset action | Removing repeated routes makes the export workflow easier to scan while preserving the report's editing capabilities |
| MEDIUM | `portfolio-guide/chapters.ts`, chapter tasks | Three written instructions; progress is inferred by the visitor | An optional guided task with one current action, an observable completion state and a Next action; retain free exploration | A visitor can complete a small business task without learning the entire app first |
| MEDIUM | `portfolio-guide/guide.css`, mobile navigation and live preview | Only some chapter links are initially visible; the preview is cropped and scrollable inside the page | A chapter selector showing position and title, visible previous/next controls, and a deliberate Open workspace action for the preview | Make the complete tour discoverable without compressing dense product tables into a phone viewport |

### Typography and visual hierarchy

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `app/dashboard/_components/operational-workspace.tsx:119`, `:135`, `:138`; `portfolio-guide/fixtures.ts`; sample-analysis values | The dashboard displays `+13.600000000000001 pp`; amounts alternate between `$19,1 mil M`, `$8307 M` and raw ungrouped sample values | Format displayed deltas with a defined decimal precision and locale; use consistent amount units, alignment and tabular figures; retain underlying calculation precision and source values | A precision artifact widens the metric column and undermines confidence in a numbers-heavy product |
| MEDIUM | `portfolio-guide/guide.css:372`, `:409` | Instructions use 11px text; toolbar actions use 10px text with small vertical padding | Use a clearer reading scale and larger action labels, with 40px desktop and 44px touch targets where space permits | The guide's instructions and controls should be easier to read and operate than the dense data they introduce |
| LOW | `portfolio-guide/main.tsx`, overview and chapter framing | The hero describes the product generally, while the implementation name is exposed above the demo | State the construction-operations problem and independently owned scope early; put component names in engineering notes | The opening should establish the problem solved and the author's responsibility. Technical identifiers become useful when the visitor asks how it works |

### Contextual explanation

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `portfolio-guide/main.tsx`, `Notes` and `Engineering` | Architecture is mostly paragraphs, ADR numbers and plain source paths | Attach a small explanation to the active task: source row → stable identity → reviewed edit → report. Link to the relevant contract or a reviewed source excerpt | Concrete evidence makes lineage and state ownership assessable. Keep explanatory diagrams distinct from operations actually executed by the static demo |

## A useful guided case

Use Torre Madero throughout the short tour:

1. Read the operational context and open its certificate.
2. Compare the source against an extracted amount.
3. Correct and save the row. Mark this step complete only after the local save succeeds.
4. Open the report and point to the saved value.
5. Export the report, then offer the explanation of how reviewed data reaches the artifact.

Data-flow and sample-based setup remain optional deeper chapters. Their local behavior must stay explicit: editing configuration does not run production writeback, and the sample analysis is preloaded. Do not imply that saving a certificate recomputes the fixed dashboard snapshot.

The guide should introduce its scenario controls outside the product workspace. Keep the continuity-conflict example available, but frame it as an example state rather than a service currently processing the visitor's document.

## Recommended order

1. **Workspace and comparison:** compact guide framing, source/data layout and a reliable return path. Preserve saved state while changing presentation.
2. **Reading and precision:** numeric formatting, action sizing and report navigation. Preserve domain calculations and the paper layout.
3. **Presentation:** the short guided case, contextual engineering notes and narrow-screen chapter navigation.

Acceptance checks should cover document visibility at the guide's actual container widths, keyboard focus, source/data toggling, unsaved edits while changing presentation, saved values reaching the report, formatting around the 10pp delay threshold, and navigation at 390px. Rendering a rounded value must not change the threshold calculation.

## Considered and rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Guide and product identity | Replace the warm neutral/orange palette with a new portfolio theme | The existing identity connects the guide to the product. Layout, type and precision are the visible issues in these captures |
| Workspace controls | Hide all editing controls to create cleaner screenshots | The portfolio needs visitors to discover real interactions. Simplify repeated controls and stage advanced options, while keeping the active task available |

No UI code or motion was changed. This plan is grounded in the existing checked build and captures; it does not claim that the proposed layouts or interactions have been validated yet.

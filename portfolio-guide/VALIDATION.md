# Local validation

Date: 2026-09-07. Windows, Node 22.20.0, installed Chrome. The browser journey uses the Argentina time zone and reduced motion. This records local evidence, not a production deployment.

| Check | Result |
| --- | --- |
| `npm run portfolio:build` | Passed; static output generated in `portfolio-guide/dist/` |
| `npm run portfolio:typecheck` | Passed, including directly imported product source |
| ESLint on `portfolio-guide/`, `ReportPage`, `OperationalWorkspace` and `SampleAnalysisCard` | Passed with no errors or warnings |
| `npm run check:ui` | Passed; 1,112 product controls checked |
| Focused Vitest contracts | 31 tests passed across sample-analysis, data-flow-builder, data-flow-writeback, ocr-row-policy and lineage |
| `portfolio:check` against the static preview at port 4176 | Seven entry views rendered; ten interaction groups and the guided case passed |
| Browser errors and network | No console errors, uncaught errors, failed HTTP responses, backend requests or external requests during the checked journeys |

The browser checks confirm:

1. Chapter navigation, keyboard skip link, month selection and metric detail.
2. Source/data review, the conflict fixture, saving rows and reading those edits in the report.
3. Full screen and return retain saved data in the same tab.
4. Report description/grouping, local presets, downloaded CSV/XLSX contents and the print handoff.
5. A report snapshot in a clean browser context and a malformed-link error.
6. Obras search, double-click editing, save and reload persistence.
7. Sample-analysis choices producing definition JSON and reset to review.
8. Copying the complete data-flow JSON, changing it, importing and saving locally.
9. Reset restores sample rows; unknown API calls and cross-origin fetches receive local errors.
10. Guide navigation and page containment at 390px width.
11. A seeded incorrect amount, an incorrect save that does not advance the case, and a correct save followed by report loading and actual CSV download.
12. Keyboard and pointer split resizing; opening notes preserves dirty cells; closing notes returns focus to its trigger.
13. Source/data tab switching on mobile preserves unsaved edits. Guided progress survives reload; exiting the tour preserves saved data.
14. One report filter-navigation button in the compact view and decimal delay formatting without floating-point residue.

The overview, adjustable document comparison, completed report, contextual notes and mobile captures were visually reviewed. `check.mjs`, `interactions.mjs` and `journey.mjs` regenerate screenshots and evidence under the ignored `artifacts/` directory. The final static build, type check and scoped lint passed after the report viewport integration.

## Limits

The print test checks the document sent to `window.print` and subsequent cleanup. It does not automate the operating system's print dialog. The static demo does not exercise production authentication, OCR, storage, row reconciliation or writeback services. The guide's source still depends on parent application folders. Full-application lint/build and publication are outside this validation scope.

FigJam synchronization remains pending because the Figma MCP quota was exhausted. [FIGJAM_UPDATE.md](FIGJAM_UPDATE.md) records the affected boards, flow and screenshot updates.

## Operations visual pass

The Operations redesign passed the static build, type check, scoped ESLint, `check:ui` and the complete `portfolio:check` against port 4176. The combined browser run includes all seven entry views, the ten existing interaction groups, the correction-to-export case and the new Operations check. There were no console errors, HTTP failures or external/backend requests in the checked guide journeys.

The new check verifies month selection, KPI and project-metric details, Escape dismissal, click/focus behavior, 390px page containment, a 620px component inside a 1440px viewport, mobile disclosure positioning and the project drilldown. The shared 150ms disclosure was also inspected at normal speed and 10% playback; the main browser checks use reduced motion. The document splitter test now waits for the observable ARIA value after pointer movement instead of reading it before React has rendered the update.

See [OPERATIONS_DESIGN.md](OPERATIONS_DESIGN.md) for the reference, visual decisions and review boundaries. The shared Popover owns portal stacking; no local z-index was introduced. Production queries and domain calculations were not changed or revalidated in this visual pass.

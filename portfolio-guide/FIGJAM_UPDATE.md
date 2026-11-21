# Pending visual documentation

Date: 2026-09-07
Implementation status: local static guide, not committed or deployed.

Product OS and Journeys 04 were inspected during implementation. The subsequent request to inspect the screenshots board returned: "You've reached the Figma MCP tool call limit on the Starter plan." No board was modified in this change. This is a tool quota limit, not a requested approval or a reason to change the implementation.

The visual-demo pass rechecked Product OS and received the same quota error. Add the guided case, split workspace, compact report controls and mobile navigation to the pending updates below.

The Operations presentation pass also received the Starter-plan quota error on Product OS `0:1`. Its pending update includes a continuous canvas, unboxed KPIs, full-width monthly policy chart, works/activity below, compact review rows and portaled metric details. Add these to Product OS, the operations/insurance section of [Journeys 02](https://www.figma.com/board/8dX4sV8kJYDwf1qa1jY5zb), and the screenshots board. Use `operations-open-desktop.png`, `operations-open-mobile.png`, `operations-narrow-container.png`, `operations-mobile-tooltip.png` and `guide-operations-open.png` after validation. No board was updated in this pass.

## Updates to apply when access is available

| Board                                                                                   | Current reference                               | Required update                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Product OS](https://www.figma.com/board/NDzN30GN3koTteiTdkgV3P)                        | Root `0:1`; existing shared-UI section `45:173` | Add a portfolio-guide entry linked to the six modules. Record local validation, date, no commit and no deployment. Keep public-source preparation in proposed work.                        |
| [Journeys 04 / Plataforma y Acceso](https://www.figma.com/board/ySjUIomuoMG00LNK0sKajF) | Root `0:1`; access section `9:418`              | Add a visitor journey without account creation. Overview → Operations → Obras → Document review → Report. Branch to Data-flow and Sample setup. Mark storage and backend boundaries below. |
| [Screenshots actuales](https://www.figma.com/board/mC50ck1vEmJzOvrdW9s9AU)              | Root `0:1`; inspection blocked by quota         | Add the sanitized guide overview, document review, report and mobile captures from `artifacts/`. Inspect current placement before creating a new section.                                  |

The journey should show:

- A visitor chooses a chapter, reads its task and engineering notes, and opens the real component with fictional data.
- The guided case seeds a May amount of ARS 17,000,000 against an ARS 18,000,000 source. Opening the certificate, saving the correct value, viewing the report and exporting a file advance separate steps. Free exploration remains available.
- Source and editable rows appear side by side using DocumentPreview and FormTable. The divider supports dragging and arrow keys. On narrow screens, source/data tabs retain unsaved edits. Saving updates the subsequent report.
- Contextual design notes open above the workspace without remounting it and return focus on close. Mobile visitors choose all chapters through a labeled selector and previous/next links.
- The conflict fixture explains ambiguous continuity; no reconciliation service is run.
- Report controls use a single compact navigation and update the paper, local presets and exports. A snapshot link reconstructs example rows in another browser. Print replaces the production PDF service.
- Data-flow import/save stays in component state. Sample analysis begins at review and outputs local definition JSON. No OCR or folder provisioning runs.
- Reset clears guide-owned state. Unsupported services return an explicit local error. The policy-register link explains the scope of the selected tour.

Use the generated screenshots only after the browser checks pass. `check.mjs` and `interactions.mjs` recreate them. Suggested captures are `overview.png`, `guide-operations.png`, `guide-document-review.png`, `reports.png` and `guide-mobile.png`. Preserve the existing boards and place the new section after inspecting the current content bounds.

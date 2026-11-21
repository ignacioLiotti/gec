# Síntesis engineering field guide

A navigable portfolio guide in English, with the original Spanish product components and fictional data. The six chapters connect an operational decision to a reviewed document and a usable report, then explain configuration and architecture.

## Run locally

Use Node 22.12+ and the repository's npm lockfile. From the repository root:

```sh
npm ci
npm run portfolio:dev
```

Open **http://127.0.0.1:4175**. No environment file, Supabase instance, tenant account or AI provider is needed. Vite is an explicit development dependency; the guide adds no production dependency.

```sh
npm run portfolio:typecheck
npm run portfolio:build
npm run portfolio:preview
```

The build creates `portfolio-guide/dist/`. Preview serves it at **http://127.0.0.1:4176**. The output is a static site with relative assets and hash navigation, so a static host can serve it from a subdirectory. Serving the built directory over HTTP is required; opening `index.html` as a local file is unsupported.

This directory imports source from the parent application. The **build output** is independent; copying only the guide's **source folder** into another repository is not sufficient. No deployment or repository publication is included in this change.

## The tour

Choose **Start the 3-minute tour** to restore the fictional example and follow one certificate. May starts at ARS 17,000,000 in the extracted rows, while the source says ARS 18,000,000. Open the document, correct and save that amount, open its report, then export CSV or Excel. Progress follows actual saves and exports; an incorrect saved amount does not complete the correction. This discrepancy is seeded sample data, not an OCR run.

The chapter workspace uses the available viewport. **Design & code** opens contextual decisions, demo boundaries and the actual local persistence code without remounting the screen. The document comparison uses an adjustable split on desktop and source/data tabs on narrow screens; switching tabs preserves unsaved edits. A chapter selector and previous/next links provide mobile navigation. The report demo uses one control navigation for document, filters, columns, style and presets.

| Chapter            | Real component                                    | Available interaction                                                 |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| Operations         | `OperationalWorkspace`                            | Month details, metric definitions, project links                      |
| Obras table        | `FormTable` with the obras configuration          | Search, filters, typed edits, dirty state, local save                 |
| Document review    | `DocumentPreview`, `FormTable`, `DocumentSheet` | Adjustable comparison, row editing, download, selectable continuity conflict |
| Report workshop    | `ReportPage`                                      | Paper preview, grouping, columns, totals, presets, CSV/XLSX and print |
| Data-flow          | `DataFlowPageClient`                              | Result dependencies, full configuration, JSON import and local save   |
| Sample-based setup | `SampleAnalysisCard`                              | Field selection, adaptive questions, generated definition JSON        |

The first four chapters form the short presentation. Data-flow and sample setup provide a deeper engineering discussion. Each chapter has a small task, the product decision, implementation path and tradeoff. Engineering notes describe lineage, configuration ownership and writeback authority, with references to the existing ADRs.

Use **Full screen** for dense interfaces. Document comparison uses source/data tabs below 900px of available container width and an adjustable split above it. The guide adapts to narrow screens; this does not imply that every dense product editor has been redesigned for mobile.

Full screen opens in the same tab and provides **Back to guide**, preserving saved rows and presets throughout the tour.

## What is local

- Obras saves rows in this tab's `sessionStorage`. Dashboard metrics remain a fixed, internally consistent snapshot of the included obras.
- Document review has one editable table beside the source. Its saved rows feed the report. Monthly amount, accumulated amount and progress remain independent reviewed fields; editing one does not invent new values for the others.
- Reports save presets in this tab's storage. CSV and XLSX files use the edited rows. The PDF action opens the browser print dialog instead of the production PDF service. The local XLSX adapter exports one data sheet.
- Share links encode the current local rows, report settings and an example expiry in the URL. A fresh browser can reconstruct the report. The expiry is checked in the client, not enforced by a server. These links have no access control or revocation, and resetting the guide does not invalidate an existing link.
- Data-flow edits live in the mounted component and reset on reload. They do not recompute official obra fields. The setup chapter starts with precomputed analysis and returns configuration JSON. Replacing the sample is disabled because no analysis service is connected.
- The policy register is outside this selection; its dashboard link explains that boundary. All project drilldowns lead to the Torre Madero document example.
- **Reset data** restores guide rows, presets and table/report preferences without clearing unrelated browser storage. Closing the browser tab clears saved rows and presets; some view preferences use `localStorage` until reset.

Unknown `/api/` requests and cross-origin fetches receive an explicit local error. Same-origin assets use the browser's normal fetch. The adapter is installed only by `portfolio-guide/main.tsx`; product routes, authentication, tenant access and server endpoints are unchanged. The HTML also limits network sources through a Content Security Policy.

## Structure

```text
main.tsx          providers, lazy product entries and error boundary
guide.tsx         chapter workspace, guided case and design notes
guide-content.tsx overview and architecture reading
chapters.ts       English tour and implementation notes
screens/          small compositions importing product components
fixtures.ts       fictional obras, operational snapshot, data-flow config
sample-data.ts    reviewed certificates and precomputed sample analysis
runtime/          static navigation, local API, print and XLSX adapters
public/           fictional source certificate and favicon
check.mjs         rendering, assets, console and network smoke checks
interactions.mjs  browser journey and export-content checks
journey.mjs       guided correction, focus, resizing and mobile edit continuity
```

Framework aliases are confined to the Vite build. The sample-analysis component adds optional initial review data and a sample-replacement capability; existing callers retain the default upload flow. See [ADR 0036](../docs/adr/0036-static-portfolio-guide-with-product-components.md) for the boundary and alternatives.

## Verification

With the dev server running:

```sh
npm run portfolio:check
```

The browser scripts use the installed Chrome channel by default. Set `GUIDE_BROWSER=msedge` to use Edge. They launch a clean profile and record screenshots, errors, requests and downloaded artifacts under the ignored `artifacts/` directory.

To test the static build, start `portfolio:preview` and set `GUIDE_URL=http://127.0.0.1:4176` before running `portfolio:check`. The checks cover guide navigation, keyboard access, source/data review, saved rows in reports, actual CSV/XLSX contents, presets, report links in a fresh context, setup, data-flow import, reset and narrow guide layout. The print check verifies the browser print handoff and cleanup, not the operating system's print dialog.

Preparation proposals are in [OPEN_SOURCE.md](OPEN_SOURCE.md). The exact FigJam documentation gap is recorded in [FIGJAM_UPDATE.md](FIGJAM_UPDATE.md).

The latest checked behavior and its limits are recorded in [VALIDATION.md](VALIDATION.md).

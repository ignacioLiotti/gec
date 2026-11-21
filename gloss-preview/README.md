# Síntesis, Gloss comparison

Five separate previews based on the current product screens. They use fictional data and session-local interactions. Existing routes, shared components, authentication and tenant APIs are untouched.

The generation preview was structurally redesigned on 2026-10-15. It now uses one structured composer, an expandable context summary, a totals and completeness rail, and a read-only review sheet before creating a local HTML example. The earlier editable-paper and Documento/Formulario layouts are removed. Line items support keyboard entry, duplication, deletion and undo; saved drafts restore through the sidebar and obra selector. Design decisions and current task handles are in `generation-redesign/`.

The redesign's checks, browser flows and capture limitations are recorded in `generation-redesign/runtime.json`. `composer.png`, `review.png` and `mobile.png` are static renders of the running page's DOM and styles. They document the proposal; the standalone HTML is the interactive artifact.

From the repository root:

```powershell
node node_modules/vite/bin/vite.js --config gloss-preview/vite.config.ts
```

Open http://127.0.0.1:4180. Navigation preserves local edits until reload or **Restablecer**.

```powershell
node node_modules/typescript/bin/tsc --project gloss-preview/tsconfig.json
node node_modules/vite/bin/vite.js build --config gloss-preview/vite.config.ts
node node_modules/vite/bin/vite.js preview --config gloss-preview/vite.config.ts
```

The build is in `dist/`; the static preview uses port 4181. No dependencies were added. The Vite entry isolates its environment and uses a restrictive content security policy. Fonts are embedded from the local Gloss reference.

After building, `node gloss-preview/package-preview.mjs` produces `sintesis-gloss-preview.html`, with its JavaScript, CSS and fonts embedded. It is a standalone comparison artifact. Generated documents inside the preview are rendered HTML examples awaiting review; the preview does not produce tenant PDFs or persist files to storage.

| Preview            | Product reference                               | Local route                          |
| ------------------ | ----------------------------------------------- | ------------------------------------ |
| Panel de Control   | `app/dashboard/page.tsx`, `Home`                | `#/dashboard`                        |
| Tus Obras          | `app/excel/desktop-excel-page-full.tsx`         | `#/excel`                            |
| General            | `app/excel/[obraId]/tabs/general-tab.tsx`       | `#/excel/obra-24?tab=general`        |
| Documentos New     | `app/excel/[obraId]/tabs/documents-new-tab.tsx` | `#/excel/obra-24?tab=documentos-new` |
| Generar documentos | `app/document-generation/page-client.tsx`       | `#/document-generation`              |

The Gloss adaptation uses paper surfaces, Newsreader headings, Schibsted Grotesk controls, restrained shadows and vermilion emphasis. The small muted text uses the accessible adapted color from the extraction. Status colors retain their meaning. Tables and business documents keep their domain layout. Reduced motion removes animation and transitions.

Implementation decisions and write boundaries are in `implementation-contract.md`. Delegation handles and the Opus API rate-limit fallback are in `task-ledger.json`.

The main Product OS, Journey 01 and Journey 03 FigJam boards were inspected read-only. This is a local design proposal. No board was changed or marked shipped. If the design is adopted, update those journeys and the Screenshots board with the final product implementation and its verified status.

For the generation redesign specifically, Journey 03 still needs the proposed context → composer → review sheet → pending-review result branch and its before/after screenshots. The Product OS and Screenshots boards also need the adopted proposal linked when product implementation is authorized. This local preview is not a shipped product change.

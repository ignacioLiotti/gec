# Documents & File Manager

tags: #documents #storage #files #ocr #aps #viewer

## Overview

The Documents tab in each obra provides a **file tree browser** backed by Supabase Storage. Documents are organized in folders (mirroring the obra's default folder structure) and can trigger OCR extraction when uploaded to OCR-enabled folders.

---

## Storage Architecture

- **Bucket:** `obra-documents` (Supabase Storage)
- **Path pattern:** `{tenant_id}/{obra_id}/{folder_path}/{filename}`
- Folders are virtual (paths in storage, not DB rows)
- Folder structure comes from admin-configured defaults

---

## File Manager Component

`app/excel/[obraId]/tabs/file-manager/file-manager.tsx`

**Features:**
- Tree view of all folders for the obra
- Upload files to specific folders
- Download / delete files
- Preview PDF files inline
- View OCR extraction results per document
- Link documents to obra tablas

**Events:**
- Listens to `obra:documents-refresh` custom browser event
- Emitted by Quick Actions after each step completes
- Triggers re-fetch of document tree + OCR links

---

## Document Tree API

`GET /api/obras/[id]/documents-tree`
- Returns hierarchical folder+file structure
- Includes OCR metadata per document
- Includes linked tabla rows per document

## Document Trash and Purge

`POST /api/obras/[id]/documents/deletes`
- Sends a file or folder to the document trash for a 30-day recovery window
- Files remain in Storage while recoverable and are hidden by active `obra_document_deletes` rows

`DELETE /api/obras/[id]/documents/deletes`
- Permanently purges a trash-history entry for users with `documents:purge`
- Removes the physical Storage object(s) from `obra-documents`
- Cleans known document-derived records: upload tracking, OCR processing rows, and extracted rows linked by `data.__docPath`
- Purging a restored history item also removes it from the live obra folder and decrements storage usage when the file still exists

---

---

## Document Trash and Purge

`POST /api/obras/[id]/documents/deletes`
- Sends a file or folder to the document trash for a 30-day recovery window
- Files remain in Storage while recoverable and are hidden by active `obra_document_deletes` rows

`DELETE /api/obras/[id]/documents/deletes`
- Permanently purges a trash-history entry for users with `documents:purge`
- Removes the physical Storage object(s) from `obra-documents`
- Cleans known document-derived records: upload tracking, OCR processing rows, and extracted rows linked by `data.__docPath`
- Purging a restored history item also removes it from the live obra folder and decrements storage usage when the file still exists

---

## OCR Links

`GET /api/obras/[id]/tablas/ocr-links`
- Returns which documents are linked to which tablas
- Used to show "extracted data" alongside a document

---

## Document AI Context for Generation

`POST /api/document-generation/assist`
- Uses the selected obra, folder, document type and template to find compatible extracted `obra_tabla_rows`
- Hydrates missing template fields from existing extracted rows
- Preserves manual values already entered by the operator
- Stores evidence in `input_data.__documentAi` with source row, tabla, lineage key, extraction id and source document metadata when available
- Keeps final PDF generation deterministic through the existing document-generation renderer

## Generated Document Deletion

`DELETE /api/document-generation/generated/[id]`
- Permanently deletes a generated document only when the authenticated user is its creator
- Removes the generated PDF, upload/OCR tracking, and extraction rows linked through `data.__docPath`; any matching trash entry is marked purged
- Retains the reusable source draft
- Is separate from the recoverable obra document-trash flow

## Generated Purchase-Order Filenames

- New purchase-order PDFs default to the configured document/order number as the complete filename (for example, `52.pdf`)
- An explicit filename supplied by the request or rendered from a template `fileNamePattern` still takes precedence
- Storage collisions retain the existing numeric suffix behavior (for example, `52 (2).pdf`)

## Document AI Report Workspace

`/document-ai`
- Accepts a natural-language administrative request and desired output type
- Persists `document_ai_runs`, `document_ai_sources` and `document_ai_outputs`
- Retrieves extracted rows and indexed chunks for the selected obra
- Parses natural-language intent with Gemini when `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` is configured; defaults to `gemini-2.5-flash` via `DOCUMENT_AI_GEMINI_INTENT_MODEL`
- Normalizes progress certificates, resolves certificate continuity and detects conflicts
- For certificate + purchase-order prompts, normalizes certificates as monthly income and purchase orders as monthly expenses, builds a double-bar chart (`ingreso_certificado` vs `gasto_total`), and includes category-level expense tables when source rows expose category and amount fields
- Purchase-order reconciliation counts each OC number once, uses `Total Orden` as the official order amount, leaves orders without an order date outside the monthly chart, and lists them separately for data-quality review
- Builds a `ReportComposition` JSON before rendering any file, then turns it into a `ReportLayoutPlan` so PDF/HTML reports can choose visual blocks based on the request and retrieved data
- Financial reconciliation reports use a visual layout with cover summary, KPI cards, double-bar chart, monthly narrative, certificate evolution, category matrix, dated OC consolidation, undated OC exceptions, methodology and evidence appendix
- Exposes a web preview at `GET /api/document-ai/runs/[id]/preview` so operators can inspect the generated report in the browser before downloading PDF/PPTX/DOCX/XLSX files
- Renders HTML summaries/dashboards, PDF, PPTX, DOCX and XLSX outputs
- Does not invent missing purchase-order amounts: rows without total amount or quantity + unit price are excluded from expense totals and surfaced as warnings

Supporting APIs:

- `POST /api/document-ai/runs`
- `GET /api/document-ai/runs`
- `GET /api/document-ai/runs/[id]`
- `POST /api/document-ai/runs/[id]/render`
- `GET /api/document-ai/runs/[id]/preview`
- `GET /api/document-ai/runs/[id]/download`
- `POST /api/document-ai/index/rebuild`

---

## PDF Viewer

`components/viewer/pdf-viewer-core.tsx`
- Renders PDF documents inline using browser PDF rendering
- `components/viewer/enhanced-document-viewer.tsx` — wraps with toolbar, zoom, page nav

---

## Autodesk Platform Services (APS) — 3D Models

APS integration enables viewing of BIM/3D model files (`.rvt`, `.dwg`, etc.).

### Flow
```
User uploads 3D model file
    ↓
POST /api/aps/upload → uploads to APS storage
    ↓
APS processes/translates model
    ↓
GET /api/aps/status/[urn] → poll until ready
    ↓
GET /api/aps/models → list available models
    ↓
GET /api/aps/token → get viewer access token
    ↓
3D viewer renders model in browser
```

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/aps/token` | Get APS access token for viewer |
| POST | `/api/aps/upload` | Upload model to APS |
| GET | `/api/aps/status` | Check translation status |
| GET | `/api/aps/models` | List translated models |

---

## Document Extraction Cleanup

`POST /api/obras/[id]/extracted-data/cleanup`
- Removes orphaned OCR extraction records
- Run as maintenance task

---

## OCR Templates

Admin configures OCR extraction templates at `/admin/obra-defaults`:
- `app/admin/obra-defaults/_components/OcrTemplateConfigurator.tsx`
- Defines what AI should extract from documents in specific folders
- Templates link folder types to target tablas

See: [[18 - OCR Pipeline]]

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[05 - Tablas (Data Tables)]]
- [[06 - Excel View]]
- [[18 - OCR Pipeline]]
- [[11 - Quick Actions]]

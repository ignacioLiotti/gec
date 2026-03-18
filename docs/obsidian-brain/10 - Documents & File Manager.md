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

---

## OCR Links

`GET /api/obras/[id]/tablas/ocr-links`
- Returns which documents are linked to which tablas
- Used to show "extracted data" alongside a document

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

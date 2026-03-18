# Excel View (Obra Workspace)

tags: #excel #workspace #obra #tabs #ui

## Overview

The Excel View (`/excel/[obraId]`) is the **main workspace** for each obra. It's called "Excel" because it presents a spreadsheet-like interface for managing all obra data through tabbed panels.

---

## Entry Point

`app/excel/[obraId]/page.tsx`

**Server-side:**
1. Verifies auth + resolves tenant
2. Loads obra metadata
3. Loads obra defaults (folder templates, quick actions)
4. Loads obra tablas (schema + columns)
5. Renders `ExcelPageTabs` component

**Header:**
- `components/excel-obra-name.tsx` — editable obra name in page header
- `components/excel-page-tabs.tsx` — tab navigation component

---

## Tab Structure

Tabs are defined dynamically based on:
1. Static tabs (always present)
2. Dynamic tabs for each obra tabla

```
General Tab
  ↓
[Dynamic Tabla Tabs] (one per obra tabla)
  ↓
Documents Tab
  ↓
Materials Tab
  ↓
Flujo Tab
  ↓
Memoria Tab
  ↓
Modelos 3D Tab (if APS enabled)
```

Tab state → URL param `?tab=documents` (browser back/forward works)

---

## Tab Details

### General Tab (`app/excel/[obraId]/tabs/general-tab.tsx`)
- Obra metadata form (editable fields: name, client, budget, dates, etc.)
- Uses `FormTable` with `obras-detalle` config
- **Quick Actions Panel** (bottom-right float): tenant-configured shortcuts

### Dynamic Tabla Tabs
- One tab per tabla in the obra
- Each renders `FormTable` with the tabla's dynamic schema
- Columns are user-defined; rows are stored in `obra_tabla_rows`
- Supports: add row, edit cell, delete row, import (OCR/CSV), export

### Documents Tab (`app/excel/[obraId]/tabs/file-manager/file-manager.tsx`)
- File tree mirroring Supabase storage folder structure
- Upload files per folder
- View OCR extraction results per document
- Listens to `obra:documents-refresh` custom event for live refresh after Quick Actions

### Materials Tab
- Lists material orders for the obra
- Orders created via OCR import or manually
- Shows: supplier, requester, items (qty, unit, material, price)

### Flujo Tab (`app/excel/[obraId]/tabs/flujo-tab.tsx` if exists)
- Workflow/automation configuration per obra
- Define what happens on completion events

### Memoria Tab
- Rich text notes area for the obra
- API: `GET/PATCH /api/obras/[id]/memoria`

### Modelos 3D Tab
- Autodesk Platform Services viewer
- Upload → APS processing → View 3D model
- Uses `components/viewer/enhanced-document-viewer.tsx`

---

## Form Table Component (`components/form-table/`)

The `FormTable` is the **UI workhorse** of the application — a configurable, editable spreadsheet-like table.

### Files
```
components/form-table/
  form-table.tsx         Main component
  table-cell.tsx         Individual cell rendering + editing
  table-body.tsx         Row rendering
  cell-renderers.tsx     Type-specific display (currency, date, boolean, etc.)
  cell-suggestions.ts    Autocomplete suggestions for cells
  types.ts               Column/config type definitions
  context.tsx            React context for table state
  dirty-tracking.ts      Tracks unsaved changes
  persistence.ts         Column width/visibility persistence (localStorage)
  filter-components.tsx  Column filter dropdowns
  table-utils.ts         Helper functions
  configs/
    obras-detalle.tsx    Column config for obras list
    certificados.tsx     Column config for certificates
```

### Column Config (`types.ts`)
```typescript
type ColumnConfig = {
  key: string;
  label: string;
  dataType: "text" | "number" | "currency" | "boolean" | "date";
  editable?: boolean;
  width?: number;
  formula?: string;
  hidden?: boolean;
  filterType?: "text" | "select" | "date-range";
}
```

### Cell Editing Flow
1. User clicks cell → enters edit mode
2. Input rendered per data type (text input, number, date picker, checkbox)
3. `cell-suggestions.ts` provides autocomplete for text fields
4. On blur/enter → saves to server via React Query mutation
5. `dirty-tracking.ts` tracks pending saves (shows unsaved indicator)

### Features
- Column resizing (persisted to localStorage)
- Column visibility toggle (`data-table/column-visibility-menu.tsx`)
- Sortable rows (dnd-kit sortable)
- Row selection + bulk actions
- Filters per column
- Export to Excel/CSV

---

## Quick Prefetch

`lib/use-prefetch-obra.ts` — prefetches obra data on hover over sidebar links so transitions feel instant.

---

## Excel Grid Component

`components/excel-grid.tsx` — a lighter grid component (vs full FormTable) for readonly/preview contexts.

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[05 - Tablas (Data Tables)]]
- [[10 - Documents & File Manager]]
- [[11 - Quick Actions]]
- [[12 - Workflow & Flujo System]]

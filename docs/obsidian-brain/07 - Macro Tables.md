# Macro Tables

tags: #macro-tables #reporting #aggregation #cross-obra

## What are Macro Tables?

**Macro Tables** are **cross-obra aggregations** — they pull rows from multiple obra tablas into a single unified view. Think of them as "pivot reports" that let admins see data across all obras in one place.

Example use case: "Show me all material orders across every active project in one table."

---

## Architecture

```
MacroTable (admin-configured)
    → has N sources (obra tablas)
    → has M columns (mapped from source fields OR custom)
    → resolves rows from all sources at query time
    → allows per-row custom value overrides
```

---

## Data Model (`lib/macro-tables.ts`)

```typescript
type MacroTable = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;  // includes sourceMode config
  sources?: MacroTableSource[];
  columns?: MacroTableColumn[];
}

type MacroTableSource = {
  id: string;
  macroTableId: string;
  obraTablaId: string;       // which obra tabla feeds this source
  position: number;
  // joined:
  obraTabla?: { id, name, obraId, obraName }
}

type MacroTableColumn = {
  id: string;
  macroTableId: string;
  columnType: 'source' | 'custom' | 'computed';
  sourceFieldKey: string | null;  // maps to obra tabla fieldKey
  label: string;
  dataType: MacroTableDataType;
  position: number;
  config: Record<string, unknown>;
}

type MacroTableRow = {
  id: string;                // source_row_id from obra_tabla_rows
  _sourceTablaId: string;
  _sourceTablaName: string;
  _obraId: string;
  _obraName: string;
  [fieldKey: string]: unknown;  // actual row data
}
```

---

## Source Selection (`lib/macro-table-source-selection.ts`)

The most complex part of macro tables. Sources can be added in two modes:

### Manual Mode
- Admin explicitly selects which obra tablas to include
- Stored in `macro_table_sources` DB table

### Template Mode
- Admin specifies a "template tabla" (an `obra_default_tabla`)
- All obras that have a tabla derived from that template are auto-included
- New obras added later → automatically appear in the macro table

**Template Matching Logic:**
```typescript
matchesMacroTemplateName(tableName, templateName)
// Normalizes: removes diacritics, lowercase, trim
// Matches: exact, base-name suffix (after separators like " · ", " - ", " | ")
```

**`resolveMacroSourceTablas()`:**
1. Get explicit sources
2. If template mode: find all obra tablas matching template by ID or name
3. Deduplicate
4. Return final source list

---

## Column Types

| Type | Description |
|------|-------------|
| `source` | Mapped from a source tabla's fieldKey |
| `custom` | Custom value per-row (overrides), stored in `macro_table_custom_values` |
| `computed` | Formula-derived (planned) |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/macro-tables` | List macro tables |
| POST | `/api/macro-tables` | Create macro table |
| GET | `/api/macro-tables/[id]` | Get macro table with sources + columns |
| PATCH | `/api/macro-tables/[id]` | Update macro table |
| DELETE | `/api/macro-tables/[id]` | Delete macro table |
| GET | `/api/macro-tables/[id]/rows` | Get aggregated rows (all sources) |
| PATCH | `/api/macro-tables/[id]/rows` | Update custom values |
| GET | `/api/macro-tables/[id]/sidebar` | Get sidebar config for this table |
| GET | `/api/macro-tables/templates` | List available template tablas |
| GET | `/api/sidebar-macro-tables` | Get tables enabled for sidebar |

---

## Admin Configuration (`/admin/macro-tables`)

**Creating a macro table:**
1. Go to `/admin/macro-tables/new`
2. Name + description
3. Choose source mode (manual/template)
4. If template: pick a default tabla template → all matching obra tablas auto-included
5. Map columns from source fields
6. Enable in sidebar (optional)

**Editing columns (`/admin/macro-tables/[id]`):**
- `app/admin/macro-tables/[id]/page.tsx`
- `app/admin/macro-tables/use-column-resize.ts` — resizable column headers
- `app/admin/macro-tables/column-preview.ts` — live column preview

**Filtering (`lib/macro-table-filters.ts`):**
- Filter rows by any column value
- Date range filters
- Text search

---

## Sidebar Integration

`/api/sidebar-macro-tables` — returns macro tables that the admin has enabled for sidebar display.

In `components/app-sidebar.tsx`, these appear as a collapsible "Macro" section:
```
▼ Macro
  ├── Table A
  ├── Table B
  └── + New (admin only)
```

---

## Macro View (`/macro` and `/macro/[id]`)

`app/macro/page.tsx` — lists all available macro tables for the tenant.

Each macro table rendered via `FormTable` with its resolved columns and aggregated rows from all sources.

---

## Related Notes

- [[05 - Tablas (Data Tables)]]
- [[04 - Obras (Construction Projects)]]
- [[17 - Reports System]]
- [[03 - Routing & Navigation]]

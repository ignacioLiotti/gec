# Tablas (Data Tables)

tags: #tablas #schema #data #ocr #import

## What are Tablas?

**Tablas** are per-obra structured data tables with **dynamic schemas** (columns defined per tabla). Each obra can have multiple tablas, each serving a different data collection purpose (e.g., "Contratos", "Facturas", "Avance mensual").

Tablas are the core data primitive — macro tables aggregate across them, OCR imports populate them, quick actions step through them.

---

## Tabla Schema

### Column Types (`lib/tablas.ts`)
```typescript
TABLA_DATA_TYPES = ["text", "number", "currency", "boolean", "date"]
```

### Column Definition
```typescript
type TablaSchemaColumn = {
  id?: string | null;        // stable DB id (for rename tracking)
  fieldKey: string;          // normalized key used in row data
  dataType: TablaColumnDataType;
  config?: {
    formula?: string;        // intra-row formula: "[col_a] / [col_b] * 100"
    [key: string]: unknown;
  };
}
```

### Row Data
```typescript
// Stored as JSONB in obra_tabla_rows.data
{
  col_monto: 15000,
  col_fecha: "2024-03-15",
  col_descripcion: "Hormigón",
  __computed_porcentaje: 75.5  // formula-computed fields prefixed __
}
```

---

## Key Logic (lib/tablas.ts)

### Field Key Normalization
```typescript
normalizeFieldKey("Monto Total") → "monto_total"
normalizeFolderName("Contratos 2024") → "contratos-2024"
```

### Date Parsing (Flexible)
`parseFlexibleDateValue()` handles:
- ISO: `2024-03-15`
- D/M/Y: `15/03/24`, `15.3.2024`
- Spanish: `15 de marzo de 2024`, `marzo 2024`
- English: `March 15, 2024`

`parseLooseDateInput()` — tolerates partial dates (infers year from context)

### Number Parsing (Localized)
`parseLocalizedNumber()` handles:
- `1.500,00` (European: dot-thousands, comma-decimal)
- `1,500.00` (US: comma-thousands, dot-decimal)
- `(1500)` (accounting negatives)
- `+1500`, `-1500`

### Formula Evaluation
```typescript
evaluateTablaFormula("[avance] / [plan] * 100", rowValues)
// Replaces [fieldKey] refs, evaluates arithmetic
// Only allows: 0-9 + - * / ( ) . ,
// Uses Function() with strict mode
```

### Schema Migration (`remapTablaRowDataToSchema`)
When columns are renamed/reordered, existing row data is remapped:
- Tracks column IDs to handle renamed fieldKeys
- Coerces values to new types
- Re-evaluates formulas

---

## Tabla API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras/[id]/tablas` | List all tablas for obra |
| POST | `/api/obras/[id]/tablas` | Create new tabla |
| GET | `/api/obras/[id]/tablas/[tablaId]` | Get tabla schema |
| PATCH | `/api/obras/[id]/tablas/[tablaId]` | Update schema/settings |
| DELETE | `/api/obras/[id]/tablas/[tablaId]` | Delete tabla |
| GET | `/api/obras/[id]/tablas/[tablaId]/rows` | Get rows |
| POST | `/api/obras/[id]/tablas/[tablaId]/rows` | Add row |
| PATCH | `/api/obras/[id]/tablas/[tablaId]/rows` | Bulk update rows |

### Import Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `.../import/ocr` | Import via AI OCR from document |
| POST | `.../import/csv` | Import from CSV file |
| POST | `../tablas/import/ocr-multi` | Multi-tabla OCR import |
| POST | `../tablas/import/spreadsheet-multi` | Multi-tabla spreadsheet import |

---

## OCR Import Flow

```
User uploads document to OCR-enabled folder
    ↓
POST /api/obras/[id]/tablas/[tablaId]/import/ocr
    ↓
Claude AI (vision) reads document with MATERIALS_OCR_PROMPT
    ↓
AI returns structured JSON matching tabla schema
    ↓
normalizeNumericString() + parseFlexibleDateValue() clean values
    ↓
Rows inserted into obra_tabla_rows
    ↓
lib/ai-pricing.ts tracks token usage → saved to expenses table
```

**OCR Prompt for materials:**
> "Extraé una orden de compra de materiales en formato JSON... items: cantidad, unidad, material, precioUnitario. Detectá y normalizá números con separador decimal coma."

---

## Spreadsheet Import Flow

```
User uploads Excel/CSV
    ↓
lib/spreadsheet-preview-summary.ts — parses headers, previews data
lib/excel-preview.ts — renders preview table
    ↓
Column mapping UI (app/certexampleplayground/ for certs)
    ↓
POST /api/obras/[id]/tablas/[tablaId]/import/csv
    ↓
Rows inserted, values coerced to column types
```

---

## Tabla Signals & Findings

### Signals (`/api/obras/[id]/signals/`)
- Computed KPIs derived from tabla data
- Recomputed on demand: `/api/obras/[id]/signals/recompute`

### Findings (`/api/obras/[id]/findings/`)
- AI-evaluated assessments of obra data
- `POST .../evaluate` — runs evaluation rules against obra state

---

## Spreadsheet Presets (PMC)

For obras with `spreadsheet_template: "certificado"` setting, 3 tablas are auto-created:

### PMC Resumen (Certificate Summary)
Columns: `periodo`, `nro_certificado`, `fecha_certificacion`, `monto_certificado`, `avance_fisico_acumulado_pct`, `monto_acumulado`, `n_expediente`

### PMC Items (Item Breakdown)
Columns: `item_code`, `descripcion`, `incidencia_pct`, `monto_rubro`, `avance_anterior_pct`, `avance_periodo_pct`, `avance_acumulado_pct`, `monto_anterior`, `monto_presente`, `monto_acumulado`

### Curva Plan (Investment Curve)
Columns: `periodo`, `avance_mensual_pct`, `avance_acumulado_pct`

These presets come with keyword mappings for auto-column detection from spreadsheets. The `certexampleplayground` page tests this import flow.

---

## Default Tablas (from Admin)

Admin configures default tabla templates at `/admin/obra-defaults`.
When obra is created → `applyObraDefaults()` copies template columns to new obra tablas.

Each default tabla has:
- `name` — display name
- `folder_path` — which storage folder triggers OCR into this tabla
- `is_ocr` — whether this tabla accepts OCR imports
- `data_input_method` — `"ocr"` | `"manual"` | `"both"`
- Column schema (same `TablaSchemaColumn[]`)

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[06 - Excel View]]
- [[07 - Macro Tables]]
- [[11 - Quick Actions]]
- [[18 - OCR Pipeline]]
- [[26 - Key Libraries & Utilities]]

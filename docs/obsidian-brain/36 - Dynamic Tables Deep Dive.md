# Dynamic Tables Deep Dive

tags: #tablas #database #schema #ocr

## Overview

The dynamic table system (`obra_tablas`) is the core data layer for per-obra structured data. Unlike fixed-schema tables, these have user-defined columns stored in metadata tables and flexible JSONB row data. This is the foundation for OCR imports, PMC workflows, and macro table aggregation.

---

## Schema Architecture (migration 0048)

```
obra_tablas          ← Table definition (name, source type, settings)
  └── obra_tabla_columns   ← Column schema (field_key, label, data_type, config)
  └── obra_tabla_rows      ← Actual data ({field_key: value} JSONB)

obra_default_tablas  ← Tenant-level templates
  └── obra_default_tabla_columns ← Template column schema
```

### obra_tablas
```sql
CREATE TABLE public.obra_tablas (
  id UUID PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('manual', 'csv', 'ocr')),
  settings JSONB NOT NULL DEFAULT '{}',
  UNIQUE (obra_id, name)
);
```

`settings` JSONB stores table-level config:
- `ocr_template_id` — which OCR template to use
- `linked_folder_path` — auto-process uploads from this folder
- `extraction_schema` — field mappings for OCR
- `preset` — predefined layout (`resumen`, `items`, `curva_plan`)

### obra_tabla_columns
```sql
CREATE TABLE public.obra_tabla_columns (
  id UUID PRIMARY KEY,
  tabla_id UUID NOT NULL REFERENCES obra_tablas(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,     -- e.g. "avance_mensual_pct"
  label TEXT NOT NULL,         -- e.g. "Avance Mensual %"
  data_type TEXT,              -- 'text' | 'number' | 'date' | 'boolean' | 'formula'
  position INTEGER,            -- Display order
  required BOOLEAN DEFAULT false,
  config JSONB,                -- Validation rules, defaults, formula expression
  UNIQUE (tabla_id, field_key)
);
```

`config` JSONB examples:
```json
{ "formula": "=avance_acumulado_pct - lag(avance_acumulado_pct)" }
{ "default": 0, "min": 0, "max": 100 }
{ "format": "currency", "currency": "ARS" }
```

### obra_tabla_rows
```sql
CREATE TABLE public.obra_tabla_rows (
  id UUID PRIMARY KEY,
  tabla_id UUID NOT NULL REFERENCES obra_tablas(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  source TEXT,        -- 'manual' | 'csv' | 'ocr' | 'import'
  position INTEGER,   -- Row order within table
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Rows are **schema-agnostic** — `data` stores whatever keys the columns define:
```json
{
  "mes": "Enero 2024",
  "avance_mensual_pct": "5,3",
  "avance_acumulado_pct": "12,8",
  "monto_certificado": "1.250.000"
}
```

Values stored as strings (raw from OCR/CSV). Parsing happens at read time via `lib/tablas.ts`.

---

## Tenant Default Templates (migration 0049)

Tenants can configure default tables that are automatically created when a new obra is created:

```sql
CREATE TABLE public.obra_default_tablas (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT,
  ocr_template_id UUID REFERENCES public.ocr_templates(id),
  linked_folder_path TEXT,   -- "ordenes-de-compra"
  UNIQUE (tenant_id, name)
);

CREATE TABLE public.obra_default_tabla_columns (
  id UUID PRIMARY KEY,
  default_tabla_id UUID REFERENCES obra_default_tablas(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT,
  position INTEGER,
  config JSONB
);
```

**Default sync:** When `syncDefaultExtractionSchema()` is called, it propagates the default column schema to all existing obras' matching tables (without overwriting manually customized ones).

---

## Data Types

| data_type | What it stores | Parsing |
|-----------|---------------|---------|
| `text` | Plain string | Identity |
| `number` | European-formatted number | `parseLocalizedNumber()` strips `.` thousand sep, replaces `,` decimal |
| `date` | Date string (multiple formats) | `parseFlexibleDateValue()` tries YYYY-MM, dd/mm/yyyy, Spanish literal |
| `boolean` | Any truthy value | Checks against `['true','si','sí','yes','1']` |
| `formula` | Computed from other columns | `evaluateTablaFormula()` — Excel-like simple expressions |
| `currency` | Numeric with display format | Same as number, rendered with currency symbol |

---

## RLS Policies

Both individual and default tables use the same pattern:

```sql
-- obra_tablas: member access via obra FK chain
CREATE POLICY "tabla_tenant_isolation" ON obra_tablas
  FOR ALL USING (
    obra_id IN (
      SELECT id FROM obras WHERE tenant_id IN (
        SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
      )
    )
  );

-- obra_tabla_rows: same chain, one level deeper
CREATE POLICY "row_tenant_isolation" ON obra_tabla_rows
  FOR ALL USING (
    tabla_id IN (
      SELECT id FROM obra_tablas WHERE obra_id IN (
        SELECT id FROM obras WHERE tenant_id IN (
          SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
        )
      )
    )
  );
```

Performance note: 3-level subquery chain — can be slow for large datasets. Optimized by indexes on `obra_tablas(obra_id)` and `obras(tenant_id)`.

---

## OCR Integration Chain

```
obra_default_folders (path: "ordenes-de-compra")
    ↓ linked_folder_path
obra_default_tablas (name: "Órdenes de Compra", source_type: "ocr")
    ↓ ocr_template_id
ocr_templates (extraction regions, field mappings)
    ↓ used by
/api/obras/[id]/tablas/[tablaId]/ocr
    ↓
GPT-4o-mini (generateObject) → structured extraction
    ↓
obra_tabla_rows (data: {field_key: value})
```

---

## PMC Preset Tables

Three tables are created automatically for obras using the PMC workflow:

| Preset | Name | Purpose |
|--------|------|---------|
| `resumen` | Resumen PMC | Period totals, contract amounts |
| `items` | Items PMC | Line-item breakdown of work packages |
| `curva_plan` | Curva Plan | Month-by-month planned vs actual % |

These are seeded from `lib/tablas.ts` constants and auto-created on obra initialization if the tenant has PMC configured.

---

## Audit Logging (migrations 0083-0086)

Full audit trails on:
- `obra_tablas` — table created/updated/deleted
- `obra_tabla_columns` — schema changes
- `obra_tabla_rows` — every row insert/update/delete

The audit trigger uses the multi-level FK resolution:
```sql
-- For obra_tabla_rows: resolves tenant_id via FK chain
IF fk_table = 'obra_tablas' THEN
  SELECT o.tenant_id INTO tenant
  FROM public.obra_tablas ot
  JOIN public.obras o ON o.id = ot.obra_id
  WHERE ot.id = fk_value LIMIT 1;
END IF;
```

---

## Macro Table Connection

`obra_tablas` rows are the source data for [[07 - Macro Tables]]:
- `macro_table_sources` references specific `obra_tabla_id` values
- Column mappings use `source_field_key` matching `obra_tabla_columns.field_key`
- Custom values in macro tables overlay without modifying source rows

---

## Related Notes

- [[05 - Tablas (Data Tables)]]
- [[07 - Macro Tables]]
- [[18 - OCR Pipeline]]
- [[29 - Signals, Findings & Reporting Engine]]
- [[28 - Database Migrations]]

# OCR Pipeline

tags: #ocr #ai #extraction

## Overview

The OCR pipeline uses **Claude AI (vision model)** to extract structured data from uploaded documents (PDFs, images). Extracted data is stored in obra tablas, making paper documents searchable and reportable.

---

## How It Works

```
Admin configures OCR folder template (/admin/obra-defaults)
    ↓ sets: which folder triggers OCR, which tabla receives data, what to extract
    ↓
User uploads document to OCR-enabled folder
    ↓
File stored in Supabase Storage (obra-documents bucket)
    ↓
POST /api/obras/[id]/tablas/[tablaId]/import/ocr
    ↓
AI Vision API called:
  - GENERAL TABLAS: OpenAI GPT-4o-mini via Vercel AI SDK `generateObject()`
    → Dynamically builds Zod schema from tabla columns
    → Temperature: 0.1 (precise, deterministic)
  - MATERIALS OCR: Google Gemini 2.5 Flash (vision)
    → Uses MATERIALS_OCR_PROMPT
    → Returns { nroOrden, solicitante, gestor, proveedor, items[] }
    ↓
AI returns JSON matching tabla column schema
    ↓
lib/tablas.ts normalizes:
  - Numbers: normalizeNumericString() (handles European comma-decimal)
  - Dates: parseFlexibleDateValue() (handles Spanish/English formats)
  - Values coerced to column data types
    ↓
Rows inserted into obra_tabla_rows
    ↓
Document linked to tabla (ocr_links record)
    ↓
lib/ai-pricing.ts records: model used, input/output tokens, cost estimate
    ↓
Usage added to tenant_expenses
```

---

## OCR Templates

Admin configures per-folder extraction templates at `/admin/obra-defaults`:

`app/admin/obra-defaults/_components/OcrTemplateConfigurator.tsx`

**Template fields:**
- `folder_path` — which folder this applies to (e.g., "facturas")
- `target_tabla_name` — which tabla receives extracted data
- `extraction_schema` — JSON schema describing what to extract
- `custom_prompt` — additional instructions for the AI
- `data_input_method` — `"ocr"` | `"manual"` | `"both"`

**Default Schema Sync:**
When admin changes the default extraction schema, it can be synced across all existing obras that share that default.
`POST /api/obra-defaults/apply` — applies defaults to all existing obras

---

## OCR Playground (`/api/ocr-playground`)

Admin-facing endpoint for testing OCR extraction without creating real data:
- Upload a test document
- Choose a schema
- See what the AI would extract
- Tweak prompt/schema without affecting production data

Also: `app/certexampleplayground/` — similar playground for certificate imports specifically.

---

## AI Pricing Tracking (`lib/ai-pricing.ts`)

Every OCR call is tracked:

```typescript
type AIUsageRecord = {
  model: string;             // e.g., "claude-3-5-sonnet-20241022"
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  feature: string;           // "ocr-tabla" | "ocr-materials"
  obra_id: string;
  tenant_id: string;
}
```

Saved to `tenant_expenses` table → viewable at `/admin/expenses`.

---

## Multi-Document OCR

`POST /api/obras/[id]/tablas/import/ocr-multi`

Processes multiple documents in a single API call:
- Accepts array of document references
- Processes each in parallel (rate-limited)
- Returns combined extraction results

---

## OCR Links

`obra_ocr_links` table:
- Links each extracted row back to the source document
- Used by Documents tab to show "this document was extracted here"
- API: `GET /api/obras/[id]/tablas/ocr-links`

---

## Spreadsheet Multi-Import

`POST /api/obras/[id]/tablas/import/spreadsheet-multi`

Non-OCR path: import multiple tablas from a structured spreadsheet (e.g., an Excel file with multiple sheets).

`lib/spreadsheet-preview-summary.ts` — generates summary of what would be imported before committing.

---

## Related Notes

- [[05 - Tablas (Data Tables)]]
- [[10 - Documents & File Manager]]
- [[09 - Materials & Orders]]
- [[22 - Expenses & Usage Tracking]]
- [[19 - Admin Panel]]

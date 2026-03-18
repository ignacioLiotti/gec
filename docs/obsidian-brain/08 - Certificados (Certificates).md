# Certificados (Certificates)

tags: #certificates #financial #billing

## What are Certificados?

**Certificados** are billing certificates associated with obras. They track the financial certification lifecycle:

```
Work done → Certificate issued → Invoice raised → Payment collected
```

Each certificate belongs to an obra and tracks progress through the billing cycle.

---

## Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `obra_id` | UUID | Parent obra |
| `tenant_id` | UUID | Owning tenant |
| `numero` | text | Certificate number |
| `fecha` | date | Certificate date |
| `monto` | currency | Certificate amount |
| `facturado` | boolean/amount | Invoice status/amount |
| `cobrado` | boolean/amount | Payment collection status |
| `periodo` | text | Billing period |
| `notas` | text | Notes |

---

## UI

### Certificates Page (`/certificados`)
- `FormTable` with `certificados` config (`components/form-table/configs/certificados.tsx`)
- Shows all certificates across all obras (filtered by tenant)
- Editable inline: mark as invoiced, mark as collected
- Sorting, filtering by obra, date range, status

### Per-Obra Certificates (`/api/obras/[id]/certificates`)
- Certificate view filtered to a specific obra

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/certificados` | List all certificates |
| POST | `/api/certificados` | Create certificate |
| GET | `/api/certificados/[id]` | Get single certificate |
| PATCH | `/api/certificados/[id]` | Update certificate |
| DELETE | `/api/certificados/[id]` | Delete certificate |
| GET | `/api/obras/[id]/certificates` | Certificates for specific obra |

---

## Import

`app/certexampleplayground/` — development playground for testing certificate import from Excel spreadsheets.

Components:
- `dropzone.tsx` — file upload
- `column-mapping.tsx` — map spreadsheet columns to certificate fields
- `data-preview-table.tsx` — preview parsed data
- `sheet-raw-preview.tsx` — raw spreadsheet view
- `target-table-section.tsx` — target column display

Libraries:
- `_lib/excel-parser.ts` — Excel file parsing
- `_lib/column-matcher.ts` — auto-matches column headers by similarity

---

## Reports Integration

Certificate data feeds into:
- Macro tables (if configured to pull certificate data)
- Report system (`components/report/configs/certificados.ts`)
- Financial KPIs on Dashboard

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[17 - Reports System]]
- [[07 - Macro Tables]]

# Reports System

tags: #reports #export #sharing #pdf

## Overview

The reporting system provides configurable data reports that can be:
- Viewed in-app with filtering and sorting
- Exported to Excel/CSV or PDF
- Shared via public token links (no auth required for viewing)

---

## Report Architecture

```
components/report/
  report-page.tsx         — main report page component
  report-table.tsx        — data table within report
  share-report-client.tsx — share link UI
  types.ts                — ReportConfig, ReportColumn types
  index.ts                — exports
  configs/
    obras.ts              — obras report configuration
    certificados.ts       — certificados report configuration
  builders/
    macro-report-config.ts  — builds config from macro table
    ocr-report-config.ts    — builds config from OCR data
```

---

## Report Config

```typescript
type ReportConfig = {
  title: string;
  description?: string;
  columns: ReportColumn[];
  defaultFilters?: FilterDef[];
  defaultSort?: SortDef;
  exportable?: boolean;
}

type ReportColumn = {
  key: string;
  label: string;
  dataType: "text" | "number" | "currency" | "date" | "boolean";
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}
```

---

## Built-in Report Types

### Obras Report (`configs/obras.ts`)
- All obras for the tenant
- Columns: name, client, budget, certified, invoiced, progress, status, dates
- Filters: status, date range, client search

### Certificados Report (`configs/certificados.ts`)
- All certificates across obras
- Columns: obra, number, date, amount, invoiced, collected
- Filters: obra, date range, payment status

### Macro Table Reports (`builders/macro-report-config.ts`)
- Dynamically built from a MacroTable's column config
- Each macro table can be exported as a report

### OCR Reports (`builders/ocr-report-config.ts`)
- Report built from OCR extraction results
- Useful for reviewing extracted data quality

---

## Report API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/templates` | List available report templates |
| GET/POST | `/api/reports/presets` | Save/load filter presets |
| POST | `/api/reports/share` | Generate share token |

---

## Shared Reports (`/r/[token]`)

`app/r/[token]/page.tsx`

**Flow:**
1. Admin clicks "Share" on a report view
2. `POST /api/reports/share` → generates a signed token
3. Token stored in DB with: report type, filters, expiry
4. Share URL: `https://app.com/r/{token}`
5. Anyone with link can view the report (no login required)
6. Report rendered read-only with stored filter state

---

## PDF Export (`/api/pdf-render`)

`POST /api/pdf-render`

- Accepts HTML + CSS
- Renders via headless browser (or server-side rendering)
- Returns PDF binary
- Used for: obra reports, certificate summaries

`lib/pdf/generate-pdf.ts` — PDF generation utility
`lib/pdf/print-styles.ts` — CSS for print/PDF layout

---

## Excel/CSV Export

`lib/report/export.ts` — client-side export to CSV
`lib/report/export-xlsx-server.ts` — server-side export to XLSX

FormTable columns marked `exportable: true` appear in export.

---

## Reporting Defaults (`lib/reporting/`)

```
lib/reporting/
  index.ts       — reporting service functions
  defaults.ts    — default column configs
  types.ts       — ReportingConfig types
```

---

## Related Notes

- [[07 - Macro Tables]]
- [[08 - Certificados (Certificates)]]
- [[04 - Obras (Construction Projects)]]

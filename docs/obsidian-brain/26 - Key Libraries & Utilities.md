# Key Libraries & Utilities

tags: #libraries #utilities #code #reference

## lib/tablas.ts — The Data Parsing Engine

The most important utility file. Used everywhere data enters or leaves the system.

### Exports

| Function | Purpose |
|----------|---------|
| `normalizeFieldKey(str)` | `"Monto Total" → "monto_total"` |
| `normalizeFolderName(str)` | `"Contratos 2024" → "contratos-2024"` |
| `normalizeFolderPath(str)` | Normalize full folder path |
| `normalizeNumericString(str)` | Handles EU/US number formats |
| `parseLocalizedNumber(val)` | Parse number from any locale string |
| `parseFlexibleDateValue(val)` | Parse date from any format (ISO, DMY, Spanish) |
| `parseLooseDateInput(str)` | Lenient date parse (infers missing parts) |
| `formatDateAsDmy(date)` | `Date → "31/03/2024"` |
| `formatDateAsIso(date)` | `Date → "2024-03-31"` |
| `coerceValueForType(type, val)` | Coerce raw value to TablaColumnDataType |
| `evaluateTablaFormula(formula, row)` | Evaluate `[col_a] / [col_b] * 100` |
| `remapTablaRowDataToSchema(...)` | Migrate row data when schema changes |
| `ensureTablaDataType(str)` | Validate/default data type string |
| `defaultValueForType(type)` | Default value per type (`0`, `false`, `""`) |
| `MATERIALS_OCR_PROMPT` | System prompt for material OCR |

### Constants
```typescript
TABLA_DATA_TYPES = ["text", "number", "currency", "boolean", "date"]
```

---

## lib/macro-tables.ts — Macro Table Types

```typescript
// Types:
MacroTable, MacroTableSource, MacroTableColumn
MacroTableRow, MacroTableCustomValue

// Functions:
mapColumnToResponse(record)     // DB row → API type
mapSourceToResponse(record)     // DB row → API type
mapMacroTableToResponse(record) // DB row → API type
ensureMacroDataType(str)        // validate data type
normalizeFieldKey(key)          // lowercase+normalize key
```

---

## lib/macro-table-source-selection.ts — Template Source Resolution

```typescript
// Key function:
resolveMacroSourceTablas({ settings, explicitSourceTablas, candidateTablas })
  → MacroSourceTablaRecord[]

// Helpers:
normalizeMacroTemplateName(name)          // normalize for comparison
extractMacroTemplateBaseName(name)         // "Obra A · Avance" → "Avance"
matchesMacroTemplateName(tableName, tpl)   // fuzzy name match
buildMacroSourceSelectionSettings(...)     // parse settings JSONB to typed struct
```

---

## lib/macro-table-filters.ts — Row Filtering

Provides filter functions for macro table row data:
- Text search (case-insensitive)
- Date range filters
- Numeric range filters
- Multi-select filters

---

## lib/tenant-selection.ts — Tenant Resolution

```typescript
resolveTenantMembership(memberships, options)
  → { tenantId, activeMembership, memberships }

// Constants:
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"
ACTIVE_TENANT_COOKIE = "active_tenant_id"
```

---

## lib/route-access.ts — Permission Config

```typescript
ROUTE_ACCESS_CONFIG: RouteAccessConfig[]
getRouteAccessConfig(path)
isRouteProtected(path)
matchesRoute(pattern, path)  // supports [dynamic] segments
```

---

## lib/notifications/engine.ts — Notification Engine

```typescript
defineRule(eventType, { recipients, effects })
emitEvent(eventType, ctx)
expandEffectsForEvent(eventType, ctx)
getRegistryForDebug()
```

---

## lib/ai-pricing.ts — AI Cost Tracking

```typescript
estimateCost(model, inputTokens, outputTokens) → number
MODEL_PRICING  // pricing table per model
```

---

## lib/spreadsheet-preview-summary.ts — Spreadsheet Parsing

Parses Excel/CSV files for import preview:
- Detects headers
- Shows row count, column list
- Identifies likely data types per column

---

## lib/excel-preview.ts

Renders spreadsheet data as HTML preview table before import.

---

## lib/main-table-columns.ts — Obras Column Definitions

All available columns for the main obras table, including:
- Field key, label, data type
- Whether sortable/filterable
- Default visibility

---

## lib/report/

```typescript
// export.ts
exportToCsv(data, columns, filename)
exportToXlsx(data, columns, filename)  // client-side

// export-xlsx-server.ts
generateXlsx(data, columns)  // server-side, returns Buffer
```

---

## utils/supabase/

```typescript
// server.ts — for server components, route handlers, server actions
createClient()  // reads cookies for auth session

// client.ts — for client components
createClient()  // browser-side Supabase client

// admin.ts — service role (bypasses RLS), use carefully
createAdminClient()
```

---

## lib/utils.ts

```typescript
cn(...classes)  // clsx + tailwind-merge
```

---

## hooks/

```typescript
// use-data-grid.tsx — grid state management (selection, sorting)
// use-debounced-callback.ts — debounce utility hook
// use-mobile.ts — responsive breakpoint detection
// use-callback-ref.ts — stable callback ref
```

---

## lib/compose-refs.ts

```typescript
composeRefs(...refs)  // merge multiple React refs
```

---

## utils/date.ts

Date formatting utilities for the UI.

---

## lib/query-client-provider.tsx

```typescript
// Wraps app in TanStack React Query provider
// Configured with:
//   staleTime: 30s
//   retry: 1
//   refetchOnWindowFocus: false
```

---

## lib/use-prefetch-obra.ts

```typescript
usePrefetchObra(obraId)
// Prefetches obra data on hover so navigation feels instant
// Uses React Query's prefetchQuery
```

---

## Related Notes

- [[05 - Tablas (Data Tables)]]
- [[07 - Macro Tables]]
- [[02 - Multi-Tenancy & Auth]]
- [[01 - Architecture Overview]]

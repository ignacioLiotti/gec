# Signals, Findings & Reporting Engine

tags: #reporting #signals #findings #analytics

## Overview

Beyond the user-facing report UI, the app has a server-side **reporting engine** (`lib/reporting/`) that computes:
- **Signals** — computed KPI snapshots per obra per period
- **Findings** — rule-based evaluations flagging issues or milestones
- **Snapshots** — historical performance data stored over time

This powers the dashboard analytics and PMC (Presupuesto-Medición-Certificado) flow.

---

## Signals (`/api/obras/[id]/signals`)

**What they are:** Computed numeric KPIs derived from obra tabla data, aggregated per period.

**Examples:**
- `avance_fisico` — physical progress % from PMC Items tabla
- `avance_financiero` — financial progress from certificates
- `delta_plazo` — schedule deviation (elapsed vs planned)
- `monto_certificado_periodo` — certified amount this period

**API:**
```
GET /api/obras/[id]/signals?period=2024-03
```
Returns a `SignalsSnapshot` object with computed values.

**Recompute:**
```
POST /api/obras/[id]/signals/recompute
```
Forces fresh computation from raw tabla data. Result cached to `obra_signal_logs`.

**DB:** `obra_signal_logs` table (migration 0078)
```
obra_signal_logs
  id, obra_id, tenant_id
  period_key     — "2024-03" or similar
  signals (JSONB) — { kpi_name: value, ... }
  computed_at
```

---

## Findings (`/api/obras/[id]/findings`)

**What they are:** Rule-based evaluations that flag issues, risks, or completion milestones on an obra.

**API:**
```
GET /api/obras/[id]/findings?period=2024-03
POST /api/obras/[id]/findings/evaluate
```

**Evaluate endpoint:** Runs all defined rules against current obra state and stores results.

**DB:** `obra_findings` table (migration 0077)
```
obra_findings
  id, obra_id, tenant_id
  period_key
  rule_id        — which rule triggered
  severity       — "info" | "warn" | "critical"
  message
  data (JSONB)   — context for the finding
  evaluated_at
```

---

## Obra Rules (`/api/obras/[id]/rules`)

Returns the set of evaluation rules applicable to an obra. Rules are tenant-configurable and determine what findings get triggered.

---

## Reporting Library (`lib/reporting/`)

```
lib/reporting/
  index.ts       — 1600+ lines: all parsing, inference, and evaluation logic
  types.ts       — RuleConfig, SignalRow, FindingRow, ReportTable types
  defaults.ts    — DEFAULT_RULE_CONFIG + getDefaultRuleConfig() factory
```

### Public API
```typescript
getRuleConfig(obraId)                  // merged stored + inferred config
getDefaultRuleConfig()                 // default template
saveRuleConfig(obraId, config)         // persist to obra_rule_config
getSignalsSnapshot(obraId, periodKey?) // fetch computed signals
listFindings(obraId, periodKey?)       // fetch findings
evaluateFindings(obraId, periodKey?)   // trigger recalculation
getObraTables(obraId)                  // available tables for mapping
```

### Data Parsing (LATAM-Aware)

All data from tablas is stored as raw strings (from OCR/CSV). The engine parses at evaluation time:

```typescript
// European number format: "1.234,56" → 1234.56
parseNumber("1.234,56")   // → 1234.56
parseNumber("5,3")        // → 5.3

// Multi-format dates, LATAM-first
parseDate("01/03/2024")   // → 2024-03-01 (March 1st, not January 3rd)
parseDate("15 de marzo de 2024")  // Spanish literal month names
parseDate("2024-03")      // ISO year-month

// Spanish boolean values
parseBool("si")  // → true
parseBool("sí")  // → true
parseBool("yes") // → true
parseBool("no")  // → false
parseBool("inactivo") // → false

// "Mes N" nomenclature for curve tables
getCurveMonthNumber("Mes 3")  // → 3
```

Spanish month names supported in `parseDate()`: enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre.

### Rule Configuration (`RuleConfig`)

5 detection rule packs, each independently toggleable:

| Pack | What it detects |
|------|----------------|
| `curve` | Deviation between actual progress and planned curve |
| `unpaidCerts` | Certificates invoiced but not yet paid past vencimiento |
| `inactivity` | Obra with no data updates in N months |
| `monthlyMissingCert` | Missing certificate for a billing period |
| `stageStalled` | PMC flow stuck at same stage too long |

**Default thresholds:** curve warn@10%, critical@20%; all others at "warn".

### Inference System

The engine auto-detects rule config from existing tabla structures — no manual mapping needed for standard setups:

```typescript
// Looks for columns named "periodo", "avance_mensual_pct", "avance_acumulado_pct"
// Looks for tables named "Curva Plan" or "Resumen PMC"
// → Infers planTableId, resumenTableId, actualPctColumnKey
// → Merges with stored config (stored overrides inferred)
inferCurveTableIds(obraTables)
loadObraRuleInference(obraId)
mergeRuleConfig(stored, inferred)  // stored keys win
```

---

## Reporting Snapshots (migration 0077)

`obra_reporting_snapshots` table stores point-in-time snapshots of obra state for:
- Period-over-period comparisons
- Historical trend charts
- PMC flow state tracking

---

## PMC Flow Connection

The PMC (Presupuesto-Medición-Certificado) flow in `lib/engine/` uses signals as inputs:
- Certification period data → signals computation
- Signals → findings evaluation
- Findings → flow state transitions

The lab playground at `app/lab/pmc/` visualizes this pipeline.

---

## Engine Flow Lock (migration 0074)

`acquire_flow_lock(flow_id, lock_key)` RPC — distributed locking for flow state transitions.
Prevents concurrent updates to the same flow state (optimistic concurrency).

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[05 - Tablas (Data Tables)]]
- [[17 - Reports System]]
- [[28 - Database Migrations]]

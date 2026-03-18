# Flow Engine (PMC State Machine)

tags: #engine #pmc #workflow #state-machine

## Overview

The Flow Engine is an **event-sourced state machine** for orchestrating complex multi-step construction workflows. Currently implemented as an MVP on the `engine-mvp` branch, it powers the PMC (Presupuesto → Medición → Certificado) flow.

> **Status:** `engine-mvp` branch — not yet merged to main. Lab pages gated with `notFound()` in production.

---

## Directory Structure

```
lib/engine/
├── index.ts                    # Public API exports
├── core/
│   ├── types.ts                # All type definitions
│   ├── definition.ts           # Flow definition resolver
│   ├── evaluator.ts            # State machine logic
│   ├── planner.ts              # Job planning (auto steps)
│   └── validators.ts           # Definition validation
├── adapters/
│   ├── db.ts                   # Supabase DB adapter
│   └── storage.ts              # Storage adapter
├── flows/
│   └── presupuesto-medicion-certificado.flow.json
└── runtime/
    ├── runtime.ts              # Main engine runtime
    ├── idempotency.ts          # Deduplication
    └── locks.ts                # Distributed locking

app/api/flows/
├── state/route.ts              # GET flow state
├── action/route.ts             # POST action
├── events/route.ts             # GET events
└── definition/route.ts         # Validate/set definition

app/lab/pmc/                    # Interactive playground (dev only)
app/lab/flow-builder/           # Visual definition builder (dev only)
```

---

## Core Type Definitions

```typescript
type FlowStepType = "input" | "generate";
type FlowStepMode = "human_input" | "auto";
type FlowStepStateStatus = "blocked" | "ready" | "running" | "done" | "failed";

interface FlowStepDefinition {
  id: string;            // e.g. "budget_base", "measurement", "certificate"
  type: FlowStepType;
  required?: boolean;
  requires?: string[];   // Step IDs that must be done first
  outputs?: string[];    // Expected output keys
  docKinds?: string[];   // Document types accepted
  mode?: FlowStepMode;   // "human_input" = waits for user; "auto" = runs automatically
}

interface FlowDefinition {
  id: string;
  name: string;
  runKey: "period";      // Always period-based currently
  steps: FlowStepDefinition[];
}

interface FlowStepState {
  id?: string;
  runId: string;
  stepId: string;
  status: FlowStepStateStatus;
  reason?: string | Record<string, unknown> | null;
  inputs?: Record<string, unknown> | null;
  outputs?: Record<string, unknown> | null;
  updatedAt?: string;
}

interface EngineEvent {
  type: string;
  payload?: Record<string, unknown> | null;
  dedupeKey?: string | null;   // Idempotency key
  runId?: string | null;
  period?: string | null;
}
```

---

## The PMC Flow Definition

```json
{
  "id": "pmc_v1",
  "name": "Presupuesto -> Medicion -> Certificado",
  "runKey": "period",
  "steps": [
    {
      "id": "budget_base",
      "type": "input",
      "required": true,
      "docKinds": ["budget_excel", "budget_pdf_extracted"]
    },
    {
      "id": "measurement",
      "type": "generate",
      "requires": ["budget_base"],
      "outputs": ["measurement_table"],
      "mode": "human_input"
    },
    {
      "id": "certificate",
      "type": "generate",
      "requires": ["measurement"],
      "outputs": ["certificate_pdf", "certificate_xlsx"],
      "mode": "auto"
    }
  ]
}
```

**Flow Logic:**
```
budget_base (input, required)
  → User provides budget document
  ↓
measurement (generate, human_input)
  → Only unlocked after budget_base is done
  → Requires human data entry
  ↓
certificate (generate, auto)
  → Automatically runs when measurement is complete
  → Generates XLSX + PDF certificate
```

---

## State Machine Logic (evaluator.ts)

```typescript
function evaluateFlow({ definition, currentStates, availableInputs }): EvaluateResult
```

**State Transition Rules:**

| Current Status | Rule | New Status |
|---------------|------|-----------|
| `done`, `failed`, `running` | Terminal — never change | Same |
| `input` step | Input available | `done` |
| `input` step | No input | `blocked` or `ready` |
| `generate` step | All `requires` are `done` | `ready` |
| `generate` step | Some `requires` not done | `blocked` |

**Output:** Updated `FlowStepState[]` + `PlannedJob[]` for auto steps that are now ready.

---

## Job Planning (planner.ts)

For `generate` steps with `mode: "auto"` that reach `ready` status, a job is planned:

```typescript
// certificate step reaches ready → PlannedJob:
{
  type: "generate_certificate",
  stepId: "certificate",
  runId: "...",
  payload: { ... measurement outputs ... }
}
```

---

## Runtime API

### evaluate(obraId, period?, context?)
The core function. Full sequence:
1. Load/create flow instance for obra
2. Get/create flow run for period
3. Get existing step states
4. **Auto-detect budget** (scans OCR tables + storage folders)
5. Apply `measurement.submitted` events
6. Derive available inputs
7. Run state machine evaluator
8. Plan jobs for auto-ready steps
9. Upsert step states
10. Insert `job.planned` events
11. Returns updated flow state

### emitEvent(obraId, event, context?)
Emit an event to the flow:
1. Create flow instance if missing
2. Create flow run for period if missing
3. Build deduplication key (SHA256 of type+runId+payload)
4. INSERT with UNIQUE constraint on dedupe_key
5. Returns null if duplicate

### getFlowState(obraId, period?, context?)
Read current state without evaluating. Returns empty state if no run exists.

---

## Budget Auto-Detection

The runtime automatically detects if a budget document exists for an obra:

```typescript
// Scans in order:
1. OCR tablas by keyword matching
2. Completed OCR documents
3. Pending OCR documents
4. Storage directories by keyword

// Returns:
{
  status: "found" | "missing" | "ocr_pending",
  source: "ocr" | "storage"
}
```

---

## Database Schema

### flow_instance
```sql
obra_id UUID (UNIQUE with flow_definition_id)
flow_definition_id TEXT
definition_json JSONB   -- snapshot of definition at creation
lock_token TEXT
lock_expires_at TIMESTAMPTZ
```

### flow_run
```sql
instance_id UUID (UNIQUE with period)
period TEXT             -- "YYYY-MM"
status TEXT             -- 'active' | 'archived'
```

### flow_step_state
```sql
run_id UUID (UNIQUE with step_id)
step_id TEXT
status TEXT             -- blocked/ready/running/done/failed
reason JSONB
inputs_json JSONB
outputs_json JSONB
```

### flow_event
```sql
obra_id UUID
run_id UUID
type TEXT
payload_json JSONB
dedupe_key TEXT UNIQUE  -- prevents duplicate events
```

---

## API Routes

### GET /api/flows/state?obraId=&period=
Returns full flow state with derived actions:
```json
{
  "obraId": "...",
  "period": "2024-12",
  "definitionId": "pmc_v1",
  "steps": [...],
  "actions": ["mark_budget_base", "submit_measurement"],
  "plannedJobs": []
}
```

**Available actions derived from state:**
- `mark_budget_base` — if budget_base ≠ done
- `submit_measurement` — if measurement = ready
- `generate_certificate` — if certificate = ready

### POST /api/flows/action
```json
{
  "obraId": "...",
  "period": "2024-12",
  "action": "mark_budget_base",
  "payload": {}
}
```
Emits the corresponding event, re-evaluates, returns updated state.

### GET /api/flows/events?obraId=&limit=
Returns ordered event log for debugging.

### POST /api/flows/definition
Validates or sets a custom flow definition for an obra.

---

## Distributed Locking (locks.ts)

Prevents concurrent `evaluate()` calls on the same flow instance:

```typescript
async function withFlowLock(supabase, instanceId, fn, options?) {
  const lockToken = randomUUID();
  const acquired = await acquireFlowLock(supabase, instanceId, 30, lockToken);
  if (!acquired) throw new Error("flow_lock_unavailable");
  try {
    return await fn();
  } finally {
    await releaseFlowLock(supabase, instanceId, lockToken);
  }
}
```

Uses the `acquire_flow_lock()` Supabase RPC (migration 0074):
```sql
UPDATE flow_instance
SET lock_token = p_lock_token, lock_expires_at = now() + interval '30 seconds'
WHERE id = p_instance_id
  AND (lock_expires_at IS NULL OR lock_expires_at < now());
GET DIAGNOSTICS v_updated = ROW_COUNT;
RETURN v_updated > 0;
```

---

## Lab Playground

`app/lab/pmc/` — Development-only interactive flow debugger:

| Hook | Purpose |
|------|---------|
| `useFlowState` | GET flow state, 30s staleTime |
| `useFlowAction` | POST action mutation, invalidates query |
| `useFlowEvents` | GET event log |
| `useObrasSearch` | Obra search for combobox |

Components: `pmc-header`, `obra-combobox`, `period-input`, `flow-stepper`, `step-card`, `measurement-sheet`, `measurement-table`, `period-comparison`, `outputs-section`, `debug-section`

---

## Idempotency

SHA256-based deduplication prevents duplicate events:
```typescript
function buildDedupeKey(event: EngineEvent): string {
  if (event.dedupeKey) return event.dedupeKey;
  return sha256(`${event.type}:${event.runId ?? 'global'}:${stableJson(event.payload)}`);
}
```

`flow_event.dedupe_key` has a UNIQUE constraint — inserting the same event twice silently fails.

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[05 - Tablas (Data Tables)]]
- [[08 - Certificados (Certificates)]]
- [[04 - Obras (Construction Projects)]]
- [[29 - Signals, Findings & Reporting Engine]]
- [[28 - Database Migrations]]

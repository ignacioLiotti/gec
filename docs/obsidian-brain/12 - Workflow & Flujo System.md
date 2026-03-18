# Workflow & Flujo System

tags: #workflow #automation #flujo #scheduling

## Overview

The app has two related but distinct "workflow" concepts:

1. **Flujo** (per-obra automation) — user-configured actions triggered by obra events
2. **Internal Workflow Engine** — server-side async job system for emails, notifications, reminders

---

## Internal Workflow Engine: `workflow` package

The workflow system uses the **`workflow` npm package** (v4.0.1-beta.3) — a Vercel-backed durable workflow runtime. It provides:
- Durable, long-running workflows that survive server restarts
- `sleep()` for time-based waits (can sleep days/weeks)
- `"use step"` boundaries with automatic retry on failure
- Workflow cancellation via `runId`

This is **not** Temporal.io — it is a separate framework using directive-based syntax specific to this package.

### Directive-Based API
```typescript
// lib/notifications/workflows.ts
export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
  "use workflow";            // marks this function as a durable workflow

  for (const eff of effects) {
    if (eff.when && eff.when !== "now") {
      await sleep(new Date(eff.when));  // durable sleep until delivery time
    }

    if (eff.channel === "in-app") {
      ("use step");          // marks this block as a retryable step
      await insertNotificationEdge({ ... });
    } else if (eff.channel === "email") {
      ("use step");
      await sendSimpleEmailEdge({ ... });
    }
  }
}

// Step functions use workflow/fetch (not regular fetch) for durability
async function insertNotificationEdge(row) {
  "use step";
  const response = await workflowFetch(supabaseRpcUrl, { ... });
}
```

### Workflow Definitions
```
workflows/
  obra-complete.ts      — runs when obra is marked complete (initial + follow-up emails)
  document-reminder.ts  — runs for document due-date reminders (sleep until 09:00 day before)
  test-email.ts         — immediate and 5-minute-delayed test workflows
```

### Usage Pattern
```typescript
import { start } from "workflow/api";

// Start a workflow
const run = await start(deliverEffectsWorkflow, [effects]);
// run.runId — track + cancel later

// Cancel a running workflow
import { getRun } from "workflow/api";
await getRun(runId).cancel();
```

---

## Obra Completion Workflow (`workflows/obra-complete.ts`)

Triggers when `completed_at` is set on an obra:

```
obra_complete event
    ↓
Get obra details + recipients
    ↓
lib/workflow/email.ts → send completion email via Resend
lib/workflow/notifications.ts → create in-app notification
lib/workflow/flujo-executions.ts → execute configured flujo steps
    ↓
Calendar event created for completion
    ↓
Recipient list from /api/obra-recipients
```

---

## Flujo (Per-Obra Automation Config)

The "Flujo" tab in each obra lets users configure what happens on specific events:

### Events
- `obra.complete` — obra marked as done
- `documento.due` — document due date reached
- `certificado.issued` — certificate issued

### Actions (Effects)
- Send email to recipient list
- Create calendar event
- Send in-app notification
- Schedule offset reminder (e.g., "3 days before due")

### API
`POST /api/flujo-actions` — triggers a configured flujo action

### DB
`flujo_executions` table tracks execution history.

---

## Scheduling System

`app/api/schedules/dispatch/route.ts` — dispatcher for scheduled workflows

`app/api/jobs/run/route.ts` — run a specific job by ID

Used for:
- Deferred notifications ("send tomorrow at 9am")
- Recurring reminders
- Document due-date reminders

---

## Workflow Cancellation

`lib/workflow/cancel.ts` — cancels in-flight workflow runs
Used when user unschedules a reminder before it fires.

---

## Flujo Executions (`lib/workflow/flujo-executions.ts`)

Tracks which obra+event combinations have fired workflows, preventing duplicate sends.

---

## Document Reminder Workflow (`workflows/document-reminder.ts`)

```
Pendiente with due_date
    ↓
/api/schedules/dispatch creates schedule entries
    ↓
Scheduler fires at: -7d, -3d, -1d, 0d (due date)
    ↓
POST /api/doc-reminders
    ↓
document-reminder workflow runs
    ↓
In-app notification + email to obra responsible parties
```

---

## Test Endpoint

`/api/workflow-test` — admin-only endpoint to trigger test workflow runs during development.

---

## Related Notes

- [[13 - Notifications Engine]]
- [[14 - Calendar & Events]]
- [[15 - Document Reminders & Pendientes]]
- [[04 - Obras (Construction Projects)]]

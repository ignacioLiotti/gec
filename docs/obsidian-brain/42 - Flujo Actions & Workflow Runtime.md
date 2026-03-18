# Flujo Actions & Workflow Runtime

tags: #workflow #flujo #notifications #scheduling

## Overview

Flujo Actions are tenant-configured automations that trigger when an obra reaches 100% completion. Each action can send in-app notifications, emails, or create calendar events — either immediately or at a scheduled future time. Execution is handled by the durable `workflow` package runtime.

---

## End-to-End Flow

```
obra.porcentaje updated to 100%
    ↓
PUT /api/obras/[id] → handleObraCompletionTransitions()
    ↓
emitEvent("obra.completed") → immediate notification
    ↓
executeFlujoActions(obraId, userId, tenantId)
    ↓
For each enabled obra_flujo_action:
    ├── Calculate executeAt (based on timing_mode)
    ├── Resolve recipients
    ├── INSERT obra_flujo_executions (status='pending')
    ├── emitEvent("flujo.action.triggered", { executeAt, executionId })
    └── Store workflow_run_id from emitEvent
    ↓
deliverEffectsWorkflow runs (async, durable)
    ├── sleep until executeAt
    ├── INSERT notification (in-app)
    ├── POST to Resend (email)
    └── UPDATE obra_flujo_executions.status = 'completed'
```

---

## obra_flujo_actions Schema

```sql
CREATE TABLE obra_flujo_actions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  obra_id UUID NOT NULL REFERENCES obras(id),

  action_type TEXT CHECK (action_type IN ('email', 'calendar_event')),
  timing_mode TEXT CHECK (timing_mode IN ('immediate', 'offset', 'scheduled')),

  -- For offset mode
  offset_value INTEGER,   -- e.g., 5
  offset_unit TEXT,       -- 'minutes' | 'hours' | 'days' | 'weeks' | 'months'

  -- For scheduled mode
  scheduled_date TIMESTAMPTZ,

  title TEXT NOT NULL,
  message TEXT,

  recipient_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  notification_types TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at, updated_at TIMESTAMPTZ
);
```

### Timing Modes

| Mode | executeAt calculation |
|------|----------------------|
| `immediate` | `now()` |
| `offset` | `now() + (offsetValue × offsetUnit)` at obra completion |
| `scheduled` | `scheduled_date` literal timestamp |

---

## Execution Tracking

```sql
CREATE TABLE obra_flujo_executions (
  id UUID PRIMARY KEY,
  flujo_action_id UUID REFERENCES obra_flujo_actions(id),
  obra_id UUID,
  recipient_user_id UUID,
  scheduled_for TIMESTAMPTZ,    -- when delivery will happen
  notification_types TEXT[],
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  workflow_run_id TEXT,          -- stored for cancellation
  executed_at TIMESTAMPTZ,
  updated_at, created_at TIMESTAMPTZ
);
```

---

## The deliverEffectsWorkflow

```typescript
// lib/notifications/workflows.ts
export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
  "use workflow";

  const executionId = effects[0]?.ctx?.executionId;

  try {
    for (const eff of effects) {
      if (eff.shouldSend === false) continue;

      // Sleep until delivery time
      if (eff.when && eff.when !== "now") {
        const target = new Date(eff.when);
        if (target > new Date()) {
          await sleep(target);  // durable sleep — survives restarts
        }
      }

      if (eff.channel === "in-app") {
        ("use step");
        await insertNotificationEdge({
          user_id: eff.recipientId,
          tenant_id: eff.ctx?.tenantId,
          title: eff.title,
          body: eff.body,
          type: eff.type,
          action_url: eff.actionUrl,
        });
      } else if (eff.channel === "email") {
        ("use step");
        await sendSimpleEmailEdge({
          to: eff.recipientEmail,
          subject: eff.subject,
          html: eff.html,
        });
      }
    }

    // Mark execution complete
    if (executionId) {
      await markFlujoExecutionStatusEdge({ id: executionId, status: "completed" });
    }
  } catch (error) {
    if (executionId) {
      await markFlujoExecutionStatusEdge({
        id: executionId,
        status: "failed",
        errorMessage: error.message
      });
    }
    throw error;
  }
}
```

---

## Durable Step Functions

All step functions use `"use step"` for automatic retry and use `workflowFetch` (not regular `fetch`):

### insertNotificationEdge (`lib/workflow/notifications.ts`)
Calls the `workflow_insert_notification()` Supabase RPC (SECURITY DEFINER, bypasses RLS):
```typescript
await workflowFetch(`${supabaseUrl}/rest/v1/rpc/workflow_insert_notification`, {
  method: "POST",
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  body: JSON.stringify({ payload: row }),
});
```

### sendSimpleEmailEdge (`lib/workflow/email.ts`)
Calls Resend API:
```typescript
await workflowFetch(RESEND_API_BASE, {
  method: "POST",
  headers: { Authorization: `Bearer ${resendKey}` },
  body: JSON.stringify({ from, to, subject, html }),
});
```

### markFlujoExecutionStatusEdge (`lib/workflow/flujo-executions.ts`)
Updates `obra_flujo_executions` status via Supabase REST:
```typescript
await workflowFetch(`${supabaseUrl}/rest/v1/obra_flujo_executions?id=eq.${id}`, {
  method: "PATCH",
  body: JSON.stringify({ status, error_message, executed_at, updated_at }),
});
```

---

## Workflow Cancellation

When a flujo action is updated (rescheduled or deleted):
1. Old pending executions are deleted from DB
2. Old workflows are cancelled via `getRun(runId).cancel()`
3. New executions are created with new timing

```typescript
// lib/workflow/cancel.ts
export async function cancelWorkflowRun(runId: string): Promise<boolean> {
  try {
    const run = getRun(runId);
    await run.cancel();
    return true;
  } catch (error) {
    console.warn("[workflow/cancel] failed to cancel", { runId, error });
    return false;
  }
}
```

---

## Notification Rule System

Flujo actions are processed via the notification rule engine in `lib/notifications/engine.ts`:

```typescript
// lib/notifications/rules.ts
defineRule("flujo.action.triggered", {
  recipients: async (ctx) => ctx.recipientId ? [ctx.recipientId] : [],
  effects: [
    {
      channel: "in-app",
      shouldSend: (ctx) => !ctx.notificationTypes.length || ctx.notificationTypes.includes("in_app"),
      when: (ctx) => ctx.executeAt ? new Date(ctx.executeAt) : "now",
      title: (ctx) => ctx.title,
      body: (ctx) => ctx.message,
      actionUrl: (ctx) => ctx.obraId ? `/excel/${ctx.obraId}` : null,
    },
    {
      channel: "email",
      shouldSend: (ctx) => ctx.notificationTypes?.includes("email"),
      when: (ctx) => ctx.executeAt ? new Date(ctx.executeAt) : "now",
      subject: (ctx) => ctx.title,
      html: (ctx) => `<p>${ctx.message}</p>`,
    },
  ],
});
```

---

## Other Registered Workflow Rules

| Rule | Trigger | Channels | Timing |
|------|---------|---------|--------|
| `obra.completed` | obra porcentaje → 100% | in-app + optional email | immediate |
| `document.reminder.requested` | pendiente due_date approaches | in-app + email | 09:00 the day before |
| `flujo.action.triggered` | flujo action fires | in-app + email | configurable delay |
| `custom.in_app` | ad-hoc admin trigger | in-app | immediate |
| `custom.in_app.role` | ad-hoc role-based | in-app | immediate |

---

## Workflow Files

```
lib/notifications/
  engine.ts          ← emitEvent(), defineRule(), expandEffectsForEvent()
  rules.ts           ← all rule definitions
  workflows.ts       ← deliverEffectsWorkflow (main workflow)
  api.ts             ← convenience helpers

lib/workflow/
  notifications.ts   ← insertNotificationEdge (step)
  email.ts           ← sendSimpleEmailEdge (step)
  flujo-executions.ts ← markFlujoExecutionStatusEdge (step)
  cancel.ts          ← cancelWorkflowRun

workflows/
  obra-complete.ts   ← obra completion workflow
  document-reminder.ts ← pendiente reminder workflow
  test-email.ts      ← dev test workflow
```

---

## Fallback Mode (Workflows Disabled)

When `WORKFLOWS_DISABLED=true`:
- Notifications are inserted directly to DB (no workflow/sleep)
- Scheduled notifications (future dates) are **lost** — they fire immediately or not at all
- Controlled via env vars:
  - `WORKFLOWS_ENABLED` — force enable
  - `WORKFLOWS_DISABLED` — force disable

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[13 - Notifications Engine]]
- [[04 - Obras (Construction Projects)]]
- [[15 - Document Reminders & Pendientes]]
- [[32 - Environment Variables & Config]]

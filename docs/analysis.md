# Notification Flow Analysis

## Quick Summary
- **Workflow Engine**: Uses @workflow library for durable async tasks
- **Rule-based Events**: Central dispatch via engine.ts with registered rules
- **Three Paths on Obra Completion**: Emit event, execute flujo actions, schedule reminders
- **Cron Dispatch**: /api/schedules/dispatch processes queued reminders

## Key Files
- `lib/notifications/engine.ts` - Event registry and dispatcher
- `lib/notifications/workflows.ts` - Durable workflow execution
- `lib/notifications/rules.ts` - Event rules (obra.completed, document.reminder.requested)
- `app/api/obras/route.ts` - Completion detection and trigger point
- `app/api/schedules/dispatch/route.ts` - Cron endpoint for reminder dispatch
- `app/api/flujo-actions/route.ts` - Flujo action CRUD
- `app/api/doc-reminders/route.ts` - Document reminder scheduling

## Architecture

### Core Components

**engine.ts - Rule-Based Event System**
- `defineRule(eventType, rule)` - Register rules
- `emitEvent(eventType, ctx)` - Dispatch events
- `expandEffectsForEvent()` - Generate per-recipient notifications

**workflows.ts - Durable Delivery**
- `deliverEffectsWorkflow(effects)` - Executes scheduled tasks
- Supports sleep() for future delivery
- Uses Resend API for emails
- Inserts to notifications table for in-app

**rules.ts - Defined Rules**
- `obra.completed`: In-app now + Email 2min later
- `document.reminder.requested`: In-app day before at 09:00

## Database Tables

| Table | Purpose |
|-------|---------|
| `notifications` | Store all notifications (in-app + email records) |
| `obra_flujo_actions` | Define actions triggered on obra completion |
| `obra_flujo_executions` | Track execution history |
| `obra_pendientes` | Pending documents/tasks per obra |
| `pendiente_schedules` | Queue of reminders to be dispatched |

## Flow: Obra Completion (100%)

1. **User updates percentage to 100% in Excel UI**
2. **PUT /api/obras** processes update

3. **Three Parallel Actions:**

   **A. Emit "obra.completed" event**
   - Build context (tenantId, actorId, obra, followUpAt)
   - Lookup rule, get recipients, expand effects
   - If production + workflows enabled:
     - `start(deliverEffectsWorkflow, [effects])`
     - Workflow: sleep if needed, then insert/send
   - Else (dev): Direct insertion fallback

   **B. Execute flujo actions**
   - Query obra_flujo_actions WHERE obra_id AND enabled=true
   - For each: Calculate timing, insert notifications, record execution
   - Executes synchronously during API call
   - Email notifications marked with type "flujo_email" but not sent (TODO)

   **C. Schedule pendiente reminders**
   - Query pendientes with due_mode='after_completion'
   - For each: Create 4 schedule entries (due_7d, due_3d, due_1d, due_today)
   - Upsert into pendiente_schedules

4. **Later - Cron Dispatch**
   - External cron calls `/api/schedules/dispatch`
   - Loads due pendiente_schedules (processed_at IS NULL)
   - Bulk inserts notifications
   - Marks processed_at = now()

## Notification Types

| Type | When | Channel | Delivery Method |
|------|------|---------|-----------------|
| In-app (obra.completed) | Now | In-app | Insert to notifications |
| Email (obra.completed) | 2min or followUpAt | Email | Resend API via workflow |
| In-app (flujo_email/calendar) | Immediate/offset/scheduled | In-app | Direct insert |
| Email (flujo_*_email) | Immediate/offset/scheduled | Email | Queued but not sent (TODO) |
| In-app (reminder) | Due date - 7/3/1 days or today | In-app | Cron dispatch |

## Key Functions Responsibility

**PUT /api/obras**
- Entry point for obra updates
- Detects completion (100%)
- Orchestrates all three notification paths
- Returns immediately (async delivery via workflows)

**emitEvent()**
- Looks up rule in registry
- Resolves recipients
- Expands effects to per-recipient format
- Delegates to workflow engine or fallback

**deliverEffectsWorkflow()**
- Durable execution with sleep support
- Actually delivers notifications/emails
- Uses admin client to bypass RLS
- Survives function restarts

**executeFlujoActions()**
- Executes immediately during obra update
- Synchronous insertion of notifications
- Records execution status
- Email delivery not implemented

**/api/schedules/dispatch**
- Called by external cron
- Batch processes due reminders
- Bulk inserts 1000+ notifications at once
- Marks processed to prevent duplicates

## Dependencies Between Components

```
PUT /api/obras (triggers)
  → emitEvent("obra.completed") 
    → lookupRule(registry)
    → rule.recipients(ctx)
    → getUserEmailById()
    → expandEffectsForEvent()
    → start(deliverEffectsWorkflow) [prod] or direct insert [dev]

  → executeFlujoActions()
    → query obra_flujo_actions
    → insert notifications
    → record executions

  → Schedule pendientes
    → query obra_pendientes
    → upsert pendiente_schedules

Later:
  Cron → /api/schedules/dispatch
    → load pendiente_schedules
    → bulk insert notifications
    → mark processed
```

## Environment Configuration

```
NODE_ENV=production          # Enables workflows
WORKFLOWS_DISABLED=0         # 1 to disable (force dev mode)
SUPABASE_SERVICE_ROLE_KEY   # For admin client
RESEND_API_KEY              # Email sending
RESEND_FROM_EMAIL           # Sender email
CRON_SECRET                 # Cron auth
```

## Known Issues

1. **Flujo action emails not sent**
   - Queued as notifications but no consumer sends them
   - Location: app/api/obras/route.ts:197 (TODO comment)

2. **Missing tenant_id in schedule dispatch**
   - Sets tenant_id=null for all dispatched notifications
   - Should fetch from obra.tenant_id
   - Location: app/api/schedules/dispatch/route.ts:37

3. **Synchronous flujo execution**
   - Could slow down PUT /api/obras if many actions
   - Should be async job

4. **No retry logic**
   - Failed emails/notifications lost
   - Single attempt only

5. **No event audit trail**
   - Can't debug missing notifications
   - Only final state recorded

## Data Flow Example

```
obra.porcentaje = 100

PUT /api/obras
  ├─ Insert in-app notification: "Obra completada" ✓
  ├─ Queue email: "Seguimiento" (2min later)
  ├─ Query flujo_actions (if any)
  │   └─ Insert notifications for each action
  └─ Create 4 schedule entries for pendientes:
     ├─ pendiente_schedules.due_7d -> run_at = due - 7 days
     ├─ pendiente_schedules.due_3d -> run_at = due - 3 days
     ├─ pendiente_schedules.due_1d -> run_at = due - 1 day
     └─ pendiente_schedules.due_today -> run_at = due date

[2 minutes later if workflow enabled]
  deliverEffectsWorkflow
  └─ Send email via Resend

[Later, when cron runs]
  /api/schedules/dispatch
  ├─ Find all schedules where run_at <= now
  ├─ Build notifications from context
  └─ Bulk insert to notifications table
     └─ Users see reminders in notification bell
```

## Testing Points

1. Test obra completion:
   - PUT /api/obras with porcentaje: 100
   - Check notifications table for in-app message
   - Check Resend logs for email (2min later)

2. Test flujo actions:
   - Create flujo action via POST /api/flujo-actions
   - Complete obra
   - Check notifications table for flujo_email type entries

3. Test schedules:
   - Create pendiente with due_mode='after_completion'
   - Complete obra
   - Check pendiente_schedules for 4 entries
   - Manually call GET /api/schedules/dispatch
   - Check notifications for reminder entries

4. Test rules:
   - Call emitEvent directly in code
   - Call POST /api/notifications/emit (dev mode)
   - Check registry via getRegistryForDebug()


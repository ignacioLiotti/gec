# Notification/Pendientes (Pending Items) System - Complete Documentation

## System Overview

This codebase implements a comprehensive notification system with support for:
- Real-time in-app notifications
- Email notifications with scheduling
- Document reminder tracking
- Obra (construction project) completion notifications
- Multi-tenant support with row-level security

The system uses a **rule-based event engine** with **background workflows** for asynchronous delivery.

---

## 1. DATABASE SCHEMA

### 1.1 Main Notification Table

**File**: `/home/user/gec/supabase/migrations/0012_notifications_table.sql`

```sql
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text,
    type text NOT NULL DEFAULT 'info',          -- 'info', 'warning', 'success', 'reminder'
    action_url text,                             -- URL to navigate to on click
    data jsonb NOT NULL DEFAULT '{}'::jsonb,    -- Flexible payload storage
    read_at timestamptz,                         -- NULL means unread
    created_at timestamptz NOT NULL DEFAULT now()
);
```

**Key Indexes**:
- `notifications_user_id_created_at_idx` - For fast retrieval by user and time
- `notifications_user_id_unread_idx` - For unread notifications queries

**Row-Level Security**:
- Users can only access their own notifications
- Tenant scoping for multi-tenant isolation

### 1.2 Related Tables

**Obras Table** (with notification configuration):
- `on_finish_first_message` - Custom message for obra completion
- `on_finish_second_message` - Custom follow-up message
- `on_finish_second_send_at` - Scheduled time for follow-up notification
- `porcentaje` - Completion percentage (triggers notification at 100%)

**User & Tenant Tables**:
- `auth.users` - Supabase auth users
- `tenants` - Organization/workspace
- `memberships` - User-to-tenant association with roles
- `profiles` - User profile information

### 1.3 Database Relationships

```
auth.users (1) ──── (many) notifications
              └──── (many) memberships
                        │
                        └──── (1) tenants ──── (many) obras
                                    │
                                    └──── (many) notifications
```

---

## 2. BACKEND ARCHITECTURE

### 2.1 Event Engine System

**File**: `/home/user/gec/lib/notifications/engine.ts`

Core types:
```typescript
type EventContext = {
  tenantId?: string | null;
  actorId?: string | null;           // User who triggered event
  [k: string]: any;                  // Custom event-specific data
};

type EffectDef = {
  channel: "in-app" | "email";
  when: "now" | Date | ((ctx) => Date | "now");  // Schedule timing
  title?: (ctx) => string;
  body?: (ctx) => string | null;
  subject?: (ctx) => string;         // For email
  html?: (ctx) => string;            // For email
  actionUrl?: (ctx) => string;
  data?: (ctx) => any;
  type?: string;                     // notification type
};

type Rule = {
  recipients: (ctx) => Promise<string[]>;  // Returns user_ids to notify
  effects: EffectDef[];                    // What to send and when
};
```

**Key Functions**:
- `defineRule(eventType, rule)` - Register a new rule
- `emitEvent(eventType, ctx)` - Emit an event that triggers rules
- `getRegistryForDebug()` - Debug helper

**Flow**:
1. Event emitted with context data
2. System finds matching rule
3. Rule determines recipients
4. Effects are "expanded" - user emails fetched for each recipient
5. Effects sent to workflow engine for delivery

### 2.2 Notification Rules

**File**: `/home/user/gec/lib/notifications/rules.ts`

#### Rule 1: Obra Completion Notification

```typescript
defineRule("obra.completed", {
  recipients: (ctx) => [ctx.actorId],  // Notify the user who completed it
  effects: [
    {
      channel: "in-app",
      when: "now",
      title: "Obra completada",
      body: "La obra \"[name]\" alcanzó el 100%.",
      actionUrl: "/excel/[obraId]",
      type: "success",
    },
    {
      channel: "email",
      when: (ctx) => new Date(ctx.followUpAt || Date.now() + 2 * 60 * 1000),
      subject: "Seguimiento: [obra-name]",
      html: "<p>Recordatorio: la obra <strong>[name]</strong> fue completada recientemente.</p>",
    }
  ]
});
```

**Triggered by**: `/api/obras` PUT request when porcentaje goes from <100 to 100

#### Rule 2: Document Reminder Notification

```typescript
defineRule("document.reminder.requested", {
  recipients: (ctx) => [ctx.notifyUserId],
  effects: [
    {
      channel: "in-app",
      when: (ctx) => {
        const due = new Date(ctx.dueDate);
        const dayBefore = new Date(due - 24*60*60*1000);
        dayBefore.setHours(9, 0, 0, 0);  // 9 AM day before
        return dayBefore;
      },
      title: "Recordatorio: [docName] pendiente",
      body: "Mañana vence el documento de \"[obraName]\".",
      actionUrl: "/excel/[obraId]",
      type: "reminder",
    }
  ]
});
```

**Triggered by**: `/api/doc-reminders` POST request when user schedules a reminder

### 2.3 Notification Delivery Workflow

**File**: `/home/user/gec/lib/notifications/workflows.ts`

```typescript
export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
  "use workflow";  // Durable workflow marker
  
  for (const eff of effects) {
    const at = typeof eff.when === "function" ? eff.when(eff.ctx) : eff.when;
    
    // Wait if scheduled for future
    if (at && at !== "now") {
      await sleep(new Date(at));
    }
    
    // Deliver based on channel
    if (eff.channel === "in-app") {
      "use step";  // Durable step marker
      await supabase.from("notifications").insert({
        user_id: eff.recipientId,
        tenant_id: eff.ctx?.tenantId ?? null,
        title: eff.title?.(eff.ctx) ?? "",
        body: eff.body?.(eff.ctx) ?? null,
        type: eff.type ?? "info",
        action_url: eff.actionUrl?.(eff.ctx) ?? null,
        data: eff.data?.(eff.ctx) ?? {},
      });
    } else if (eff.channel === "email") {
      "use step";
      // Send via Resend email service
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: eff.recipientEmail,
        subject: eff.subject?.(eff.ctx) ?? "Notificación",
        html: eff.html?.(eff.ctx) ?? "...",
      });
    }
  }
}
```

**Key Features**:
- Uses Workflow SDK for durable execution
- `"use workflow"` - Marks durable workflow (survives restarts)
- `"use step"` - Marks durable step (idempotent atomic operation)
- `await sleep()` - Schedules future delivery
- Handles both in-app and email channels

### 2.4 API Endpoints

#### POST `/api/notifications/emit`

**Purpose**: Generic event emission endpoint for testing/triggering events

```typescript
// Request body
{
  type: "obra.completed" | "document.reminder.requested",
  ctx: {
    // Event-specific context
    tenantId?: string,
    actorId?: string,
    obra?: { id: string, name: string, percentage: number },
    followUpAt?: string,  // ISO timestamp
    documentName?: string,
    dueDate?: string,
    notifyUserId?: string,
    // ... other fields
  }
}
```

**Response**: `{ ok: true }`

#### POST `/api/doc-reminders`

**Purpose**: Schedule a document reminder notification

```typescript
// Request body
{
  obraId: string (required),
  documentName: string (required),
  dueDate: string (required, "YYYY-MM-DD" or ISO),
  obraName?: string,
  notifyUserId?: string  // Current user
}
```

**Processing**:
1. Validates required fields
2. Emits "document.reminder.requested" event
3. Workflow calculates reminder time (day before at 9 AM)
4. Creates notification in database at scheduled time

#### PUT `/api/obras`

**Purpose**: Upload/update obra data (from Excel typically)

**Key Logic**:
```typescript
// Detect newly completed obras
const newlyCompleted = payload.filter(
  obra => obra.porcentaje === 100 && 
          existingPercentage < 100
);

// For each newly completed obra
for (const obra of newlyCompleted) {
  await emitEvent("obra.completed", {
    tenantId,
    actorId: user.id,
    obra: {
      id: obra.id,
      name: obra.name,
      percentage: 100
    },
    followUpAt: obra.on_finish_second_send_at
  });
}
```

---

## 3. STATE FLOW & LIFECYCLE

### 3.1 Obra Completion Flow

```
Excel Data Update
       │
       ▼
PUT /api/obras
       │
       ├─ Upsert obras in database
       │
       ├─ Detect porcentaje: <100 → 100
       │
       ▼
emitEvent("obra.completed", {
  actorId: user.id,
  obra: {...},
  followUpAt: scheduled_time
})
       │
       ▼
Rule registry: find "obra.completed" rule
       │
       ├─ Recipients: [actorId]
       │
       ├─ Fetch user email via getUserEmailById()
       │
       ▼
Expand effects: 2 effects × 1 recipient = 2 expanded effects
       │
       ├─ Effect 1 (In-app, immediate)
       ├─ Effect 2 (Email, scheduled)
       │
       ▼
start(deliverEffectsWorkflow, [expandedEffects])
       │
       ├─ Effect 1: INSERT into notifications (immediately)
       │              notification.read_at = null (unread)
       │
       └─ Effect 2: sleep(followUpAt)
                     → send email via Resend
```

### 3.2 Document Reminder Flow

```
User schedules reminder in Excel page
       │
       ▼
POST /api/doc-reminders
{
  obraId: "...",
  documentName: "Póliza",
  dueDate: "2025-12-31",
  notifyUserId: "..."
}
       │
       ▼
emitEvent("document.reminder.requested", {
  obraId, obraName, documentName, dueDate, notifyUserId
})
       │
       ▼
Rule registry: find "document.reminder.requested" rule
       │
       ├─ Recipients: [notifyUserId]
       │
       ├─ Calculate reminder time:
       │  └─ due_date - 24 hours
       │  └─ set time to 09:00:00 local
       │
       ▼
Expand effects: 1 effect × 1 recipient = 1 expanded effect
       │
       ▼
start(deliverEffectsWorkflow, [expandedEffect])
       │
       ├─ Wait until reminderAt timestamp
       │
       ▼
INSERT into notifications:
  title: "Recordatorio: Póliza pendiente"
  body: "Mañana vence el documento de \"Obra Name\"."
  action_url: "/excel/obraId"
  read_at: null (unread)
  created_at: now
```

### 3.3 Notification State Lifecycle

```
Notification Record States:
─────────────────────────

1. CREATED (unread)
   read_at: NULL
   │
   ├─ User can click in UI to navigate to action_url
   │
   ▼
2. READ
   read_at: <timestamp when user opened notifications>
   │
   ├─ Notification remains in database indefinitely
   │ (can be deleted by user)
   │
   ▼
3. DELETED (user action)
   Removed from notifications table

Unread Count Query:
   WHERE read_at IS NULL
   GROUP BY user_id
```

---

## 4. FRONTEND INTEGRATION

### 4.1 Notification Display Component

**File**: `/home/user/gec/components/auth/user-menu.tsx`

**Features**:
- Displays notification bell with unread count badge
- Opens dialog showing up to 50 most recent notifications
- Shows demo notifications when no real data
- Supports navigation via action_url

**Key States**:
```typescript
type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;  // 'info', 'warning', 'success', 'reminder'
  created_at: string;  // ISO timestamp
  read_at: string | null;  // null = unread
  action_url: string | null;
};
```

**Rendering**:
- Unread indicator (orange dot) beside each unread notification
- Timestamp shown in local timezone
- "View details" link if action_url exists
- Types can be styled differently (info, warning, success, reminder)

**Data Flow**:
```
1. User clicks notification icon in header
2. Dialog opens, dialogOpen = true
3. useEffect triggers if !isAuthed is false
4. Fetch from notifications table:
   SELECT id, title, body, type, created_at, read_at, action_url
   WHERE user_id = currentUserId
   ORDER BY created_at DESC
   LIMIT 50
5. Display in scrollable list
6. User clicks action_url to navigate
```

### 4.2 Pending Documents (Pendientes) Component

**File**: `/home/user/gec/app/excel/[obraId]/page.tsx`

**Features**:
- Tracks up to 3 pending documents per obra
- Each document has: name, póliza, dueDate, done (checkbox)
- Schedule reminders for due dates
- Local state management (not persisted in DB)

**State Structure**:
```typescript
type PendingDoc = {
  id: string;              // Local ID (doc-1, doc-2, doc-3)
  name: string;            // Document name
  poliza: string;          // Policy/reference number
  dueDate: string;         // Date in format "YYYY-MM-DD"
  done: boolean;           // Checkbox state
};
```

**Key Interactions**:
```typescript
// When user enters a due date and clicks to confirm:
const scheduleReminderForDoc = async (doc: PendingDoc) => {
  if (!obraId || !doc.dueDate) return;
  
  const res = await fetch("/api/doc-reminders", {
    method: "POST",
    body: JSON.stringify({
      obraId,
      obraName: null,
      documentName: doc.name || "Documento",
      dueDate: doc.dueDate,
      notifyUserId: currentUserId,
    })
  });
  // Triggers reminder workflow
};
```

**UI Notes**:
- Pendientes tab only visible when porcentaje >= 100 (obra complete)
- Documents form is for tracking/planning, not persistent storage
- Reminders are scheduled via API, not stored with documents

### 4.3 Notifications Testing Page

**File**: `/home/user/gec/app/dev/notifications-playground/page.tsx`

**Purpose**: Manual testing of notification events

**Features**:
- Emit "obra.completed" events with custom parameters
- Schedule "document.reminder.requested" events
- Test immediate vs. delayed notifications
- Test in-app vs. email delivery

**Example Usage**:
```
1. Fill in Obra ID, name, actor user_id
2. Set follow-up delay in minutes
3. Click "Emitir evento"
4. System emits obra.completed
5. Can see in-app notification immediately
6. Follow-up email sent after delay
```

---

## 5. BACKGROUND JOBS & WORKFLOW ENGINE

### 5.1 Workflow SDK Integration

**Package**: `workflow` (^4.0.1-beta.3)

**Concepts**:
- `"use workflow"` - Declares durable workflow function
- `"use step"` - Declares durable, idempotent step
- `await sleep(date | duration)` - Schedule execution for future time
- `start(workflowFn, args)` - Queue workflow execution

**Key Advantage**: Workflows survive process restarts, resuming at last step.

### 5.2 Active Workflows

#### Workflow 1: deliverEffectsWorkflow

**File**: `/home/user/gec/lib/notifications/workflows.ts`

**Responsibility**: 
- Execute notification delivery effects
- Handle scheduling and timing
- Insert to DB or send emails

**Execution Flow**:
```
for each effect:
  ├─ Calculate when: "now" or future Date
  ├─ If future: await sleep(when)
  └─ If in-app: 
  │   "use step"
  │   INSERT notification
  └─ If email:
      "use step"
      send via Resend
```

#### Workflow 2: sendDocumentReminderWorkflow

**File**: `/home/user/gec/workflows/document-reminder.ts`

**Responsibility**:
- Calculate reminder date (day before due date at 9 AM)
- Wait until that time
- Create notification

**Code**:
```typescript
export async function sendDocumentReminderWorkflow(
  params: DocumentReminderParams
) {
  "use workflow";
  
  const reminderAt = computeReminderDate(params.dueDate);
  
  // Wait until day before at 9 AM (or 2 min if past)
  if (!reminderAt || reminderAt.getTime() <= Date.now()) {
    await sleep("2m");
  } else {
    await sleep(reminderAt);
  }
  
  // Create notification via "use step"
  await createNotification(params);
  
  return { success: true };
}
```

#### Workflow 3: sendObraCompletionWorkflow

**File**: `/home/user/gec/workflows/obra-complete.ts`

**Responsibility**:
- Send initial completion email
- Wait for follow-up time
- Send follow-up email

**Code**:
```typescript
export async function sendObraCompletionWorkflow(params: WorkflowParams) {
  "use workflow";
  
  await sendInitialEmail(params);           // "use step"
  await waitForFollowUp(params.followUpSendAt);  // sleep()
  await sendFollowUpEmail(params);          // "use step"
  
  return { success: true };
}
```

### 5.3 Scheduling & Persistence

**How Scheduling Works**:
1. Event emitted with context
2. Rule determines effects and recipients
3. For each effect:
   - Calculate `when` time
   - If future: `await sleep(date)` pauses execution
   - Workflow engine persists state
4. At scheduled time, resume and execute delivery
5. Database updated with notification record

**Reliability**:
- `"use step"` ensures each DB insert is idempotent
- If process crashes during sleep, resumes on restart
- Workflow state persisted in external store

---

## 6. CONFIGURATION & CUSTOMIZATION

### 6.1 Obra-Specific Configuration

These fields in the `obras` table allow per-obra customization:

```
on_finish_first_message: string
  └─ Custom message for immediate notification

on_finish_second_message: string
  └─ Custom message for follow-up notification

on_finish_second_send_at: timestamptz
  └─ When to send follow-up (overrides default 2 minutes)
```

**Example**:
```json
{
  "designacion_y_ubicacion": "Puente on Ruta 5",
  "porcentaje": 100,
  "on_finish_first_message": "¡Obra completada!",
  "on_finish_second_message": "Recordatorio: verificar documentación final",
  "on_finish_second_send_at": "2025-12-21T17:00:00Z"
}
```

### 6.2 Adding New Rules

To add a new notification rule:

```typescript
// In lib/notifications/rules.ts

defineRule("custom.event.type", {
  recipients: async (ctx) => {
    // Determine who gets notified
    return [userId1, userId2, ...];
  },
  effects: [
    {
      channel: "in-app",
      when: "now",  // or Date, or (ctx) => Date
      title: (ctx) => `Title: ${ctx.someField}`,
      body: (ctx) => `Body: ${ctx.otherField}`,
      actionUrl: (ctx) => `/path/${ctx.id}`,
      type: "info",  // info, warning, success, reminder
    },
    // ... more effects (email, etc.)
  ]
});
```

Then emit via API or code:
```typescript
await emitEvent("custom.event.type", {
  tenantId: "...",
  actorId: "...",
  someField: "value",
  // ... custom context
});
```

---

## 7. MULTI-TENANT SUPPORT

### 7.1 Tenant Isolation

**Notification Records**:
- Store `tenant_id` on each notification
- RLS policy ensures users only see notifications where `user_id = auth.uid()`
- Tenant scoping is additional safety layer

**Obras Filtering**:
- PUT `/api/obras` filters by `tenant_id`
- Events carry `tenantId` in context
- Notifications created with `tenant_id` for audit trail

### 7.2 User Membership

**Flow**:
1. User authenticates
2. Get `tenantId` from `memberships` table
3. Pass to API for obra queries and event emission
4. Notifications automatically scoped to user

---

## 8. EXAMPLE: COMPLETE USER JOURNEY

### Scenario: Excel Upload with Obra Completion

**Step 1: User uploads Excel file**
```
PUT /api/obras
{
  detalleObras: [
    { n: 1, porcentaje: 95, ... },
    { n: 2, porcentaje: 100, ... }  // Newly completed!
  ]
}
```

**Step 2: Backend detects completion**
```typescript
newlyCompleted = [{n: 2, porcentaje: 100, ...}]

emitEvent("obra.completed", {
  tenantId: "...",
  actorId: "user-123",
  obra: {
    id: "obra-uuid",
    name: "Puente Ruta 5",
    percentage: 100
  },
  followUpAt: "2025-12-21T17:00:00Z"
})
```

**Step 3: Rule engine processes event**
```
Rule "obra.completed" matches
Recipients: ["user-123"]
Fetch email: "user@example.com"

Expand effects:
  ├─ In-app effect for user-123 (immediate)
  └─ Email effect for user@example.com (scheduled)
```

**Step 4: Workflow delivers effects**
```
Effect 1: immediate
  INSERT notifications:
    user_id: "user-123"
    title: "Obra completada"
    body: "La obra \"Puente Ruta 5\" alcanzó el 100%."
    type: "success"
    created_at: now()
    read_at: null

Effect 2: at followUpAt
  await sleep(2025-12-21T17:00:00Z)
  send email via Resend to user@example.com
```

**Step 5: User sees notification**
```
1. User opens app
2. Clicks notification icon (shows unread count badge)
3. Dialog opens showing recent notifications
4. Sees "Obra completada" with orange indicator
5. Clicks title to navigate to /excel/obra-uuid
6. read_at timestamp updated (optional - not implemented in UI)
```

---

## 9. IMPORTANT IMPLEMENTATION DETAILS

### 9.1 Recipient Resolution

```typescript
// engine.ts
const expanded = await Promise.all(
  recipientIds.map(async (userId) => ({
    userId,
    email: await getUserEmailById(userId),
  }))
);
```

**Key Point**: User email fetched from `auth.users` via Supabase Admin client

### 9.2 Context Propagation

```typescript
// Context flows through entire pipeline:
// 1. Emitted from PUT /api/obras
// 2. Matched against rules
// 3. Passed to recipients function
// 4. Passed to each effect function (title, body, html, etc.)
// 5. Available in workflow context
```

### 9.3 Error Handling

**Workflow errors**:
```typescript
// Graceful degradation - don't crash on email failure
if (!resendKey || !fromEmail || !eff.recipientEmail) {
  continue;  // Skip email if config incomplete
}
```

**API errors**:
```typescript
try {
  await emitEvent(...);
  return NextResponse.json({ ok: true });
} catch (e) {
  return NextResponse.json({ error: "failed" }, { status: 500 });
}
```

### 9.4 Email Service

**Provider**: Resend (resend.com)

**Configuration**:
- `RESEND_API_KEY` - API key
- `RESEND_FROM_EMAIL` - From address (e.g., "noreply@example.com")

**HTML Templates**:
- Using `@react-email/components` for email templates
- Custom HTML generated in effect functions

---

## 10. DEBUGGING & MONITORING

### 10.1 Testing Interface

**URL**: `/app/dev/notifications-playground`

**Features**:
- Manual event emission
- Test both notification types
- Observe immediate vs. scheduled delivery

### 10.2 Debug Helpers

```typescript
// Get registered rules for debugging
const registry = getRegistryForDebug();
console.log(registry);  // Map of eventType -> Rule
```

### 10.3 Logging

**Key log points** in `/api/obras`:
```
Obras PUT: start (tenantId, userId, email)
Obras PUT: parsed payload (count)
Obras PUT: computed newlyCompleted (count, items)
Obras PUT: emitting event obra.completed (n, obraId)
Obras PUT: event emitted
Obras PUT: failed to emit event (error)
```

---

## 11. SECURITY CONSIDERATIONS

### 11.1 Row-Level Security (RLS)

```sql
-- Users can only read their own notifications
CREATE POLICY "read own notifications" ON notifications
FOR SELECT USING (user_id = auth.uid());

-- Users can only insert notifications for themselves
CREATE POLICY "insert own notifications" ON notifications
FOR INSERT WITH CHECK (user_id = auth.uid());
```

### 11.2 Admin Client Usage

- Notifications inserted via **Supabase Admin client** (bypasses RLS)
- Only for system-generated notifications (secure)
- Email lookups also use admin client

### 11.3 Input Validation

```typescript
// Document reminder endpoint validates:
if (!obraId || !documentName || !dueDate) {
  return error 400
}

// Obras endpoint validates schema:
const parsingResult = obrasFormSchema.safeParse(body);
if (!parsingResult.success) {
  return error with details
}
```

---

## 12. FUTURE ENHANCEMENTS

### Potential Improvements:
1. **Mark as read**: Add endpoint to update notification `read_at`
2. **Delete notifications**: Allow users to dismiss notifications
3. **Notification preferences**: Let users choose channels (email/in-app)
4. **More event types**: Certificates, materials, team assignments
5. **Real-time updates**: WebSocket/SSE for live notification count
6. **Notification history**: Dashboard showing notification patterns
7. **Batch operations**: Handle multiple obra completions efficiently
8. **Localization**: Spanish/English template support
9. **Custom schedules**: User-defined reminder times per obra
10. **Analytics**: Track notification open rates and engagement

---

## 13. FILE REFERENCE SUMMARY

```
DATABASE SCHEMA:
  supabase/migrations/0001_base_schema.sql       (tenants, users, memberships)
  supabase/migrations/0008_obras_table.sql       (obras table)
  supabase/migrations/0010_obras_finish_config.sql (notification config columns)
  supabase/migrations/0012_notifications_table.sql (main notifications table)

BACKEND LOGIC:
  lib/notifications/engine.ts                    (event system)
  lib/notifications/rules.ts                     (notification rules)
  lib/notifications/workflows.ts                 (delivery workflow)
  lib/notifications/recipients.ts                (email lookup)

API ENDPOINTS:
  app/api/notifications/emit/route.ts            (generic event endpoint)
  app/api/doc-reminders/route.ts                 (schedule reminders)
  app/api/obras/route.ts                         (obra updates, triggers completion)

WORKFLOWS:
  workflows/document-reminder.ts                 (document reminder workflow)
  workflows/obra-complete.ts                     (obra completion workflow)

FRONTEND:
  components/auth/user-menu.tsx                  (notification display)
  app/excel/[obraId]/page.tsx                    (pending documents tracking)
  app/dev/notifications-playground/page.tsx      (testing interface)

UTILITIES:
  utils/supabase/admin.ts                        (admin client)
  utils/supabase/client.ts                       (browser client)
  utils/supabase/server.ts                       (server client)
```

---

## QUICK START: Adding a New Notification Type

1. **Define the rule** in `lib/notifications/rules.ts`:
```typescript
defineRule("your.event.type", {
  recipients: async (ctx) => [ctx.userId],
  effects: [{
    channel: "in-app",
    when: "now",
    title: (ctx) => `Title`,
    body: (ctx) => `Body`,
    type: "info"
  }]
});
```

2. **Emit from backend**:
```typescript
await emitEvent("your.event.type", { userId: "...", ... });
```

3. **User sees notification** in user menu (auto-fetched from DB)

4. **Optional: Custom routing** via `actionUrl` for navigation on click

---

**Last Updated**: 2025-11-11
**System Version**: 0.1.0
**Database**: Supabase (PostgreSQL)
**Frontend Framework**: Next.js 16, React 19
**Workflow Engine**: workflow@4.0.1-beta.3


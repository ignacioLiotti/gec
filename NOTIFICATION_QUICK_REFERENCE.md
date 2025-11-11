# Notification System - Quick Reference Guide

## File Locations

### Database Schema
- `/home/user/gec/supabase/migrations/0012_notifications_table.sql` - Main notifications table
- `/home/user/gec/supabase/migrations/0010_obras_finish_config.sql` - Obra completion config fields

### Backend Logic
- `/home/user/gec/lib/notifications/engine.ts` - Event registry and dispatcher
- `/home/user/gec/lib/notifications/rules.ts` - Notification rule definitions
- `/home/user/gec/lib/notifications/workflows.ts` - Delivery workflow (durable)
- `/home/user/gec/lib/notifications/recipients.ts` - Helper to fetch user emails

### API Endpoints
- `/home/user/gec/app/api/notifications/emit/route.ts` - Generic event emission
- `/home/user/gec/app/api/doc-reminders/route.ts` - Schedule document reminders
- `/home/user/gec/app/api/obras/route.ts` - Obra updates (triggers completion notifications)

### Frontend
- `/home/user/gec/components/auth/user-menu.tsx` - Notification bell and display
- `/home/user/gec/app/excel/[obraId]/page.tsx` - Pending documents tracking
- `/home/user/gec/app/dev/notifications-playground/page.tsx` - Testing interface

### Workflows
- `/home/user/gec/workflows/document-reminder.ts` - Scheduled document reminders
- `/home/user/gec/workflows/obra-complete.ts` - Obra completion email workflow

---

## Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
  id uuid,                      -- unique identifier
  user_id uuid,                 -- who gets the notification
  tenant_id uuid,               -- which organization
  title text,                   -- notification title
  body text,                    -- notification content
  type text,                    -- 'info', 'warning', 'success', 'reminder'
  action_url text,              -- URL to navigate to
  data jsonb,                   -- flexible extra data
  read_at timestamptz,          -- null = unread
  created_at timestamptz        -- when created
);
```

### Key Fields in Obras Table
```
porcentaje        -- 0-100% completion (100 = trigger notification)
on_finish_first_message     -- custom immediate message
on_finish_second_message    -- custom follow-up message
on_finish_second_send_at    -- when to send follow-up
```

---

## API Endpoints Quick Reference

### POST /api/notifications/emit
```javascript
// Emit any registered event
fetch("/api/notifications/emit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "obra.completed",  // or "document.reminder.requested"
    ctx: {
      tenantId: "...",
      actorId: "user-id",
      obra: { id: "...", name: "...", percentage: 100 },
      followUpAt: "2025-12-21T17:00:00Z"
    }
  })
})
```

### POST /api/doc-reminders
```javascript
// Schedule a document reminder
fetch("/api/doc-reminders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    obraId: "uuid",
    documentName: "Póliza",
    dueDate: "2025-12-31",      // YYYY-MM-DD or ISO
    notifyUserId: "user-id"
  })
})

// Result: Notification created day before at 9 AM
```

### PUT /api/obras
```javascript
// Upload obras (triggers completion notifications automatically)
fetch("/api/obras", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    detalleObras: [
      { n: 1, porcentaje: 100, ... }  // If <100→100, emits event
    ]
  })
})

// Auto-detects newly completed obras and emits "obra.completed" event
```

---

## Notification Rules

### Rule 1: Obra Completion
**Event Type**: `obra.completed`
**Triggered By**: PUT /api/obras when porcentaje reaches 100
**Recipients**: The user who uploaded the file (actorId)
**Effects**:
  1. In-app notification (immediate)
     - Title: "Obra completada"
     - Body: "La obra \"[name]\" alcanzó el 100%."
     - Type: "success"
     - Action: Navigate to /excel/[obraId]
  2. Email (scheduled, default 2 minutes or custom via on_finish_second_send_at)

### Rule 2: Document Reminder
**Event Type**: `document.reminder.requested`
**Triggered By**: POST /api/doc-reminders
**Recipients**: The specified notifyUserId
**Effects**:
  1. In-app notification (scheduled)
     - Time: Day before dueDate at 9 AM
     - Title: "Recordatorio: [docName] pendiente"
     - Body: "Mañana vence el documento de \"[obraName]\"."
     - Type: "reminder"
     - Action: Navigate to /excel/[obraId]

---

## How to Add a New Notification Type

### Step 1: Define the Rule
Edit `/home/user/gec/lib/notifications/rules.ts`:

```typescript
defineRule("your.event.type", {
  recipients: async (ctx) => {
    // Return array of user_ids to notify
    return [ctx.userId];
  },
  effects: [
    {
      channel: "in-app",              // or "email"
      when: "now",                     // or Date, or (ctx) => Date
      title: (ctx) => `Your Title`,
      body: (ctx) => `Your message`,
      actionUrl: (ctx) => `/path/${ctx.id}`,
      type: "info",                    // info, warning, success, reminder
    }
  ]
});
```

### Step 2: Emit the Event
From anywhere in your backend:

```typescript
import { emitEvent } from "@/lib/notifications/engine";

await emitEvent("your.event.type", {
  tenantId: "...",
  userId: "...",
  // ... any other context
});
```

### Step 3: Auto Display
The notification appears in user-menu.tsx notification bell automatically!

---

## Notification Lifecycle

```
1. CREATED (unread)
   └─ read_at = NULL
   └─ Notification appears in bell icon
   └─ Badge shows unread count

2. USER INTERACTION
   └─ Click notification → navigate via action_url
   └─ Click outside → stays unread (not implemented: mark read)

3. DELETED (optional)
   └─ Currently: user must clear in DB manually
   └─ Future: Add delete endpoint

Unread Count:
  WHERE user_id = auth.uid() AND read_at IS NULL
```

---

## Frontend Integration

### Display Notifications (user-menu.tsx)
```typescript
// Automatically fetches and displays
const { data } = await supabase
  .from("notifications")
  .select("id,title,body,type,created_at,read_at,action_url")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(50);

// Shows:
// - Orange dot for unread
// - Timestamp
// - "View details" link if action_url exists
```

### Track Pending Documents (excel page)
```typescript
type PendingDoc = {
  id: string;         // doc-1, doc-2, doc-3
  name: string;       // "Póliza"
  poliza: string;     // "ABC-123"
  dueDate: string;    // "2025-12-31"
  done: boolean;      // checkbox state
};

// When user sets dueDate:
const scheduleReminderForDoc = async (doc: PendingDoc) => {
  await fetch("/api/doc-reminders", {
    method: "POST",
    body: JSON.stringify({
      obraId,
      documentName: doc.name,
      dueDate: doc.dueDate,
      notifyUserId: currentUserId,
    })
  });
};
```

---

## Workflow Execution (Background Jobs)

### How Workflow Package Works
- `"use workflow"` - Marks durable function (survives restarts)
- `"use step"` - Marks idempotent atomic operation
- `await sleep(date)` - Schedule for future execution
- `start(fn, args)` - Queue workflow

### Example: Scheduled Email
```typescript
export async function deliverEffectsWorkflow(effects) {
  "use workflow";  // Durable
  
  for (const eff of effects) {
    if (eff.when !== "now") {
      await sleep(eff.when);  // Pauses execution until time arrives
    }
    
    if (eff.channel === "email") {
      "use step";  // Durable, idempotent
      await resend.emails.send({...});
    }
  }
}

// Usage:
start(deliverEffectsWorkflow, [effects]);
// Returns immediately, executes in background
// Survives if process restarts!
```

---

## Testing

### Using Notifications Playground
1. Navigate to `/app/dev/notifications-playground`
2. Fill in obra details
3. Click "Emitir evento" to send test notification
4. Check notification bell in top right
5. Verify scheduled emails arrive

### Testing Document Reminders
```javascript
// POST /api/doc-reminders with past due date
{
  obraId: "123",
  documentName: "Póliza",
  dueDate: "2025-01-01",  // Past date
  notifyUserId: "user-id"
}

// Result: Should create notification after ~2 min (fallback)
```

---

## Configuration

### Environment Variables
```
RESEND_API_KEY=re_xxxxx          # For sending emails
RESEND_FROM_EMAIL=noreply@...    # From address for emails
```

### Obra Customization
```json
{
  "on_finish_first_message": "Custom immediate message",
  "on_finish_second_message": "Custom follow-up message",
  "on_finish_second_send_at": "2025-12-21T17:00:00Z"
}
```

---

## Security Notes

### Row-Level Security (RLS)
- Users can only read their own notifications
- System uses Admin client for inserts (bypasses RLS)
- Tenant_id stored for audit/compliance

### Input Validation
- Document reminders validate required fields
- Obras endpoint validates schema with Zod
- Event context not validated (extensible)

---

## Debugging Tips

### View Registered Rules
```typescript
import { getRegistryForDebug } from "@/lib/notifications/engine";
const registry = getRegistryForDebug();
console.log(Array.from(registry.entries()));
```

### Check Database
```sql
-- Recent notifications for a user
SELECT * FROM notifications 
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 10;

-- Unread count
SELECT COUNT(*) as unread_count 
FROM notifications 
WHERE user_id = 'user-uuid' AND read_at IS NULL;
```

### Monitor Logs
Look for "Obras PUT: emitting event" in server logs to confirm events firing.

---

## Future Enhancements

### High Priority
- [ ] Mark notification as read endpoint
- [ ] Delete notification endpoint
- [ ] Notification preferences (channel selection)

### Medium Priority
- [ ] Real-time notifications (WebSocket/SSE)
- [ ] Notification templates/customization
- [ ] User notification history page
- [ ] Batch notification operations

### Nice to Have
- [ ] Analytics dashboard
- [ ] Notification scheduling UI
- [ ] Custom reminder times
- [ ] Multi-language support
- [ ] SMS notifications
- [ ] In-app message center

---

**System Version**: 0.1.0
**Last Updated**: 2025-11-11
**Package**: workflow@4.0.1-beta.3
**Database**: Supabase (PostgreSQL)

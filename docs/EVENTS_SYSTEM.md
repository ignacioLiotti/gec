# Generalized Events & Scheduler System

## Overview

The events system has been generalized from a simple notifications table to a flexible event/appointment scheduler that can handle various event types beyond just notifications.

## Architecture

### Database: `scheduled_events` Table

Replaces the old `notifications` table with a more flexible schema:

```sql
create table public.scheduled_events (
    id uuid primary key,
    tenant_id uuid references tenants(id),
    user_id uuid not null references users(id),
    event_type text not null,                -- e.g., 'NOTIFICATION', 'APPOINTMENT', 'MEETING', 'REMINDER'
    title text not null,
    description text,
    metadata jsonb default '{}',             -- flexible storage for event-specific data
    scheduled_at timestamptz not null,       -- when the event should be triggered
    delivered_at timestamptz,                -- when it was actually delivered (null = pending)
    status text default 'pending',           -- 'pending' | 'delivered' | 'cancelled'

    -- Backward compatibility fields for notifications
    notification_type text,                  -- 'info' | 'success' | 'warning' | 'reminder'
    action_url text,
    read_at timestamptz,

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
```

**Key Features:**
- Generic `event_type` field allows any type of event
- `metadata` jsonb field for flexible event-specific data (location, attendees, notes, etc.)
- `scheduled_at` for time-based delivery
- `status` tracking (pending, delivered, cancelled)
- Backward compatible with old notification fields

### Engine: No Structural Changes

The core notification engine (`lib/notifications/engine.ts`) remains the same:
- `emitEvent(eventType, ctx)` - main entry point
- `defineRule(eventType, rule)` - register event handlers
- Rule registry maps event types to delivery rules

### Event Types

Currently supported event types:

1. **NOTIFICATION** - In-app notifications (old behavior)
2. **APPOINTMENT** - Personal appointments
3. **MEETING** - Team meetings with multiple participants
4. **REMINDER** - Document/task reminders (old behavior)
5. **CUSTOM** - Any custom event type

### Rules Registry (`lib/notifications/rules.ts`)

Event rules define:
- **Recipients**: Who should receive the event
- **Effects**: What happens (in-app notification, email, etc.)
- **Timing**: When the effect should be delivered

Example rules:
- `obra.completed` - Notify when work is 100% complete
- `document.reminder.requested` - Schedule reminder day before due date
- `appointment.created` - Notify immediately and 1 day before
- `meeting.scheduled` - Notify participants immediately and 1 hour before

## API Endpoints

### Event Management: `/api/events`

**GET** - Retrieve events
```typescript
GET /api/events?type=APPOINTMENT&status=pending&limit=50
Response: { events: ScheduledEvent[] }
```

**POST** - Create event directly (bypasses rule engine)
```typescript
POST /api/events
Body: {
  event_type: "APPOINTMENT",
  title: "Doctor appointment",
  description: "Annual checkup",
  metadata: { location: "Hospital", notes: "Bring ID" },
  scheduled_at: "2025-12-01T10:00:00Z"
}
Response: { event: ScheduledEvent }
```

**PATCH** - Update event
```typescript
PATCH /api/events
Body: {
  id: "event-uuid",
  status: "cancelled",
  read_at: "2025-11-11T12:00:00Z"
}
Response: { event: ScheduledEvent }
```

**DELETE** - Delete event
```typescript
DELETE /api/events?id=event-uuid
Response: { success: true }
```

### Emit Event: `/api/notifications/emit`

Trigger rule-based events:
```typescript
POST /api/notifications/emit
Body: {
  type: "appointment.created",
  ctx: {
    userId: "user-uuid",
    appointmentId: "appt-uuid",
    title: "Consulta médica",
    appointmentAt: "2025-12-01T10:00:00Z",
    location: "Hospital Central",
    notes: "Traer documentación"
  }
}
```

## Frontend Components

### Notifications Bell (`components/auth/user-menu.tsx`)

- Shows in-app notifications (event_type = 'NOTIFICATION')
- Reads from `scheduled_events` table
- Displays unread count badge
- Maps new schema to old format for backward compatibility

### Appointments Page (`app/appointments/page.tsx`)

- Shows appointments and meetings (event_type IN ['APPOINTMENT', 'MEETING'])
- Grouped by date
- Filter by type (All, Appointments, Meetings)
- Cancel pending events
- Action buttons for event details

### Testing Playground (`app/dev/notifications-playground/page.tsx`)

Test all event types:
- Obra completed (notification)
- Document reminder (notification)
- Create appointment
- Schedule meeting

## Workflow Integration

The delivery workflow (`lib/notifications/workflows.ts`) handles scheduled delivery:

1. Effects are expanded for each recipient
2. Workflow sleeps until `scheduled_at` time
3. Events are inserted into `scheduled_events` table
4. Emails sent via Resend (if configured)

**Example Flow:**
```
emitEvent("appointment.created", ctx)
  → Rule looks up recipients
  → Expands effects for each recipient
  → Starts deliverEffectsWorkflow
    → Effect 1: Immediate notification (when: "now")
    → Effect 2: Reminder (when: 1 day before, sleep until then)
    → Effect 3: Email (when: 1 day before)
```

## Migration Path

The migration (`0015_scheduled_events.sql`) automatically:
1. Creates the new `scheduled_events` table
2. Migrates all existing notifications to the new table
3. Maps old fields to new schema
4. Preserves RLS policies for security

**Old notifications are kept as event_type = 'NOTIFICATION'**

## Usage Examples

### Creating an Appointment via Rule

```typescript
// Trigger the appointment.created rule
await emitEvent("appointment.created", {
  userId: "user-123",
  appointmentId: "appt-456",
  title: "Dentist appointment",
  appointmentAt: new Date("2025-12-15T14:00:00Z"),
  location: "Downtown Dental",
  notes: "Bring insurance card",
});
```

This will:
1. Create immediate notification
2. Schedule reminder for 1 day before at 9 AM
3. Send email reminder 1 day before

### Creating Event Directly

```typescript
// Direct creation without rules
const response = await fetch("/api/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event_type: "CUSTOM",
    title: "Team lunch",
    scheduled_at: new Date("2025-11-15T12:00:00Z"),
    metadata: { restaurant: "Italian Place", attendees: 5 },
  }),
});
```

### Querying Events

```typescript
// Get all pending appointments
const appointments = await fetch("/api/events?type=APPOINTMENT&status=pending");

// Get all events (notifications, appointments, meetings)
const allEvents = await fetch("/api/events?limit=100");
```

## Benefits

1. **Extensibility**: Easy to add new event types (birthdays, deadlines, etc.)
2. **Flexibility**: `metadata` field stores any event-specific data
3. **Unified System**: One table, one API for all event types
4. **Backward Compatible**: Old notifications still work
5. **Time-Based Delivery**: Workflow library handles scheduling
6. **Multi-Channel**: In-app and email delivery

## Future Enhancements

Potential additions:
- Recurring events (daily, weekly, monthly)
- Event participants/attendees management
- Event reminders at multiple intervals (1 week, 1 day, 1 hour)
- Calendar export (iCal format)
- Event categories/tags
- Event search and filtering
- Push notifications (mobile)

# Document Reminders & Pendientes

tags: #reminders #pendientes #scheduling #due-dates

## What are Pendientes?

**Pendientes** (pending items) are document-related tasks with due dates attached to an obra. They represent things that need to happen by a deadline — e.g., "Submit environmental report by March 31."

---

## Data Model

```
obra_pendientes
  id, obra_id, tenant_id
  title                    — task description
  due_date                 — deadline
  completed_at             — when resolved
  reminder_rules[]         — when to send reminders
  assigned_to[]            — user IDs responsible
```

### Reminder Rules
Each pendiente can have multiple reminder trigger points:
- `-7` days before due
- `-3` days before due
- `-1` day before due
- `0` (due date itself)

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras/[id]/pendientes` | List pendientes for obra |
| POST | `/api/obras/[id]/pendientes` | Create pendiente |
| PATCH | `/api/obras/[id]/pendientes` | Update pendiente |
| DELETE | `/api/obras/[id]/pendientes` | Delete pendiente |

---

## Reminder Scheduling Flow

```
Pendiente created with due_date + reminder_rules
    ↓
POST /api/events/reminders (creates schedule entries)
    ↓
DB: pendiente_schedules table stores when to fire
    ↓
POST /api/schedules/dispatch (runs periodically, e.g. every hour)
    ↓ finds due schedule entries
    ↓
POST /api/doc-reminders (fires individual reminder)
    ↓
workflows/document-reminder.ts runs:
  - Creates in-app notification for assigned users
  - Sends email reminder
  - Creates calendar event marker
```

---

## Document Reminder Workflow (`workflows/document-reminder.ts`)

Receives context:
- `pendienteId` — which pendiente
- `obraId`, `obraName`
- `dueDate`, `daysUntilDue`
- `assignedUsers[]`

Delivers:
- In-app notification: "Recordatorio: [title] vence en X días"
- Email: same content via Resend
- Optional calendar event creation

---

## Scheduling Cancellation

When a pendiente is deleted or completed:
- Outstanding schedule entries are cancelled
- `lib/workflow/cancel.ts` stops any in-flight reminder workflows

---

## Notifications Page

`/notifications` aggregates:
1. In-app notifications (unread)
2. Upcoming calendar events
3. Overdue/upcoming pendientes

Creating a unified "inbox" view for the user.

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[13 - Notifications Engine]]
- [[14 - Calendar & Events]]
- [[04 - Obras (Construction Projects)]]

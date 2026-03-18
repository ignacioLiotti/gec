# Calendar & Events

tags: #calendar #events #scheduling #drag-drop

## Overview

The app includes a **full-featured team calendar** for managing project-related events, deadlines, and notifications. Events can target specific users, roles, or the entire tenant.

---

## Calendar Component (`components/event-calendar/`)

A complete calendar built with React and dnd-kit for drag-and-drop.

```
components/event-calendar/
  event-calendar.tsx       — main component
  month-view.tsx           — monthly grid view
  week-view.tsx            — weekly time grid
  day-view.tsx             — single day view
  agenda-view.tsx          — list/agenda view
  event-item.tsx           — individual event display
  event-dialog.tsx         — create/edit event dialog
  event-view-dialog.tsx    — read-only event detail
  events-popup.tsx         — overflow events popup (+3 more)
  draggable-event.tsx      — dnd-kit draggable wrapper
  droppable-cell.tsx       — dnd-kit drop target (time slot)
  calendar-dnd-context.tsx — drag-and-drop context provider
  hooks/
    use-current-time-indicator.ts — moving "current time" line
    use-event-visibility.ts       — show/hide events logic
  types.ts                 — CalendarEvent type
  utils.ts                 — date helpers
  constants.ts             — hour labels, etc.
```

### Views
- **Month** — traditional monthly grid, click day to see events
- **Week** — hourly time columns per day, drag events between slots
- **Day** — single day with hour grid
- **Agenda** — chronological list of upcoming events

### Drag and Drop
- Events are draggable within week/day views
- Drop on a different time slot → updates event time
- Uses dnd-kit (`calendar-dnd-context.tsx` wraps views)

---

## Event Data Model

```typescript
type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string;
  // Audience targeting:
  targetType: "me" | "user" | "role" | "tenant";
  targetId?: string;       // user_id or role_id if targeted
  tenantId: string;
  createdBy: string;       // user_id
  obraId?: string;         // linked obra (optional)
}
```

---

## Event API

`GET/POST /api/calendar-events`

**Query params for GET:**
- `?from=` — start date ISO
- `?to=` — end date ISO
- `?userId=` — filter by user

**Audience resolution:**
- `targetType: "me"` → only current user sees it
- `targetType: "user"` → specific user by targetId
- `targetType: "role"` → all users with that role
- `targetType: "tenant"` → entire tenant sees it

---

## Automated Event Creation

Events are created automatically by:

1. **Obra completion workflow** (`workflows/obra-complete.ts`)
   - Creates a completion milestone event

2. **Flujo actions** (obra automation)
   - Steps can create calendar events as effects

3. **Document reminders** (`lib/events/reminders.ts`)
   - Due dates from pendientes create calendar events

---

## Event Reminders (`lib/events/reminders.ts`)

`POST /api/events/reminders`

Converts pendiente due dates into calendar events and/or notification triggers.

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[13 - Notifications Engine]]
- [[15 - Document Reminders & Pendientes]]

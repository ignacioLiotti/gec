# Notifications Engine

tags: #notifications #realtime #email #engine

## Overview

The notifications system delivers **in-app notifications** (via Supabase Realtime) and **emails** (via Resend) based on domain events. It's a rule-based engine where each event type has defined recipients and effects.

---

## Architecture

```
lib/notifications/
  engine.ts       — core emitEvent(), defineRule(), expandEffects()
  rules.ts        — all event rules registered here
  workflows.ts    — deliverEffectsWorkflow (async delivery)
  recipients.ts   — getUserEmailById(), getUserIdsByRoleId()
  api.ts          — helper for API-layer notification triggers
```

---

## Engine Core (`lib/notifications/engine.ts`)

### defineRule
```typescript
defineRule("obra.complete", {
  recipients: async (ctx) => [ctx.actorId, ...adminIds],
  effects: [
    {
      channel: "in-app",
      when: "now",
      title: (ctx) => `Obra completada: ${ctx.obraName}`,
      body: (ctx) => `...`,
      type: "success",
      actionUrl: (ctx) => `/excel/${ctx.obraId}`,
    },
    {
      channel: "email",
      when: "now",
      subject: (ctx) => `[Completada] ${ctx.obraName}`,
      html: (ctx) => renderEmailTemplate(ctx),
    }
  ]
});
```

### emitEvent
```typescript
emitEvent("obra.complete", {
  tenantId: "...",
  actorId: userId,
  obraId: "...",
  obraName: "...",
})
```

**Flow:**
1. Look up rule for event type
2. Resolve recipient user IDs (supports `"roleid:{uuid}"` for role expansion)
3. For each recipient + effect: resolve all functions with context
4. Filter by `shouldSend()` guard
5. Start `deliverEffectsWorkflow` with serialized effects

---

## Effect Types

```typescript
type EffectDef = {
  channel: "in-app" | "email";
  when: "now" | Date | null | ((ctx) => Date | "now" | null);
  title?: (ctx) => string;
  body?: (ctx) => string | null;
  subject?: (ctx) => string | null;   // email only
  html?: (ctx) => string | null;      // email only
  actionUrl?: (ctx) => string | null;
  type?: string;                      // in-app: "success" | "reminder" | "info" | "workflow"
  shouldSend?: (ctx) => boolean;      // guard: skip delivery
  data?: (ctx) => any;                // extra data stored with notification
}
```

---

## Recipient Resolution

```typescript
// Direct user IDs:
recipients: async (ctx) => [ctx.actorId, someOtherUserId]

// Role-based (resolves all users with that role in tenant):
recipients: async (ctx) => ["roleid:uuid-of-role"]
```

Resolved via:
- `getUserEmailById(userId)` — gets email for in-app + email delivery
- `getUserIdsByRoleId({ roleId, tenantId })` — expands role to users

---

## Delivery Workflow

`lib/notifications/workflows.ts` → `deliverEffectsWorkflow`

For each effect:
- `channel: "in-app"` → insert into `notifications` table → Supabase Realtime pushes to client
- `channel: "email"` → Resend API call with HTML template

Scheduled effects (`when: Date`) → stored and delivered at the right time via scheduler.

---

## Client-Side Listener

`components/notifications/notifications-listener.tsx`

- Subscribes to Supabase Realtime on `notifications` table
- On new row: shows toast notification (sonner) + increments unread badge in sidebar
- Marks notifications as read when `/notifications` page is visited

---

## Notifications Page (`/notifications`)

- Lists all notifications for current user
- Merges: in-app notifications, calendar events, pending pendientes
- Mark as read / dismiss

---

## External Emit API

`POST /api/notifications/emit`

Allows **external systems** to emit notification events via signed HTTP requests:
- Verified with `lib/security/request-signing.ts`
- Requires valid `X-Signature` header
- Tenant secret used for HMAC signing

---

## Email Infrastructure

`lib/email/`
- `api.ts` — Resend client wrapper
- `invitations.ts` — invitation email template + send
- `obras.tsx` — obra-related email templates (React Email)
- `obras-simple.ts` — plain HTML email for obra events
- `templates/obra-completion.ts` — completion email

`emails/obra-completion.tsx` — React Email component for obra completion

---

## Related Notes

- [[12 - Workflow & Flujo System]]
- [[14 - Calendar & Events]]
- [[15 - Document Reminders & Pendientes]]
- [[21 - Tenant Secrets & Security]]

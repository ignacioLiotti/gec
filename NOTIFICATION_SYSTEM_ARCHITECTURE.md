================================================================================
NOTIFICATION SYSTEM - ARCHITECTURE DIAGRAM
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (User Interface)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐      ┌──────────────────────────────┐ │
│  │  components/auth/user-menu.tsx   │      │  app/excel/[obraId]/page.tsx │ │
│  │                                  │      │                              │ │
│  │  • Notification bell icon        │      │  • Pending documents tab     │ │
│  │  • Unread count badge           │      │  • Schedule reminders        │ │
│  │  • Notification list dialog      │      │  • Track deadlines           │ │
│  │  • Click to navigate            │      │  • Local state (3 slots)     │ │
│  │                                  │      │                              │ │
│  └──────────────┬───────────────────┘      └──────────────┬───────────────┘ │
│                 │                                         │                  │
│         FETCH on dialog open:                    POST /api/doc-reminders    │
│         GET FROM notifications                   when dueDate set:          │
│         WHERE user_id = current_user             └─────────────┬────────┘   │
│                 │                                              │            │
└─────────────────┼──────────────────────────────────────────────┼────────────┘
                  │                                              │
                  ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐      ┌──────────────────────────────┐ │
│  │  PUBLIC.NOTIFICATIONS            │      │  PUBLIC.OBRAS                │ │
│  │  ────────────────────────────────│      │  ──────────────────────────── │ │
│  │  id          uuid (PK)           │      │  id           uuid (PK)      │ │
│  │  user_id     uuid (FK→auth.users)│      │  tenant_id    uuid (FK)      │ │
│  │  tenant_id   uuid (FK→tenants)   │      │  n            integer        │ │
│  │  title       text                │      │  porcentaje   numeric (0-100)│ │
│  │  body        text                │      │  ...other obra fields...     │ │
│  │  type        text (info,warning) │      │  on_finish_first_message  ┐  │ │
│  │  action_url  text                │      │  on_finish_second_message │  │ │
│  │  data        jsonb               │      │  on_finish_second_send_at │  │ │
│  │  read_at     timestamptz (NULL=  │      │  ...                      │  │ │
│  │             unread)              │      │  porcentaje: 100 = TRIGGER│  │ │
│  │  created_at  timestamptz         │      │                           │  │ │
│  │  ────────────────────────────────│      │                           ▼  │ │
│  │  Indexes:                        │      └──────────────────────────────┘ │
│  │  • user_id, created_at DESC      │                                      │
│  │  • user_id, read_at              │      ┌──────────────────────────────┐ │
│  │                                  │      │  PUBLIC.TENANTS              │ │
│  │  RLS Policy:                     │      │  ────────────────────────────│ │
│  │  • user_id = auth.uid()          │      │  id       uuid (PK)          │ │
│  │  • Insert: via admin client      │      │  name     text (unique)      │ │
│  │                                  │      │  created_at timestamptz      │ │
│  └──────────────────────────────────┘      └──────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
         INSERT notification              Detect porcentaje
         (in-app or email)               change (Excel upload)
                 │                                 │
┌────────────────┴─────────────┐      ┌──────────┴──────────────┐
│   DELIVERY WORKFLOW           │      │   OBRAS ENDPOINT        │
│   (executeEffects)            │      │   (PUT /api/obras)      │
│   ──────────────────────────  │      │   ──────────────────────│
│ ┌────────────────────────────┐│      │ 1. Upsert obras data   │
│ │ deliverEffectsWorkflow()   ││      │ 2. Compare old vs new  │
│ │ "use workflow"             ││      │ 3. Detect porcentaje:  │
│ │ ────────────────────────── ││      │    <100 → 100          │
│ │                            ││      │ 4. For each completed: │
│ │ for (each effect) {        ││      │    emitEvent(          │
│ │   if (when = future) {     ││      │      "obra.completed"  │
│ │     await sleep(when)  ────┼┼──────┼─> ────────────────────┘
│ │   }                        ││      │
│ │                            ││      │ PAYLOAD EXAMPLE:
│ │   if (channel=in-app) {    ││      │ {
│ │     "use step"             ││      │   tenantId: "...",
│ │     INSERT notification    ││      │   actorId: user.id,
│ │   } else if (email) {      ││      │   obra: {
│ │     "use step"             ││      │     id: "...",
│ │     resend.emails.send()   ││      │     name: "...",
│ │   }                        ││      │     percentage: 100
│ │ }                          ││      │   },
│ │                            ││      │   followUpAt: "2025-..."
│ └────────────────────────────┘│      │ }
└──────────────────────────────┘│      │
         ▲                        │      └────────────────────────────┘
         │                        │
         │               TRIGGERED BY
         │
┌────────┴────────────────────────────────────────────────────────────────────┐
│                         EVENT ENGINE SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  lib/notifications/engine.ts - EVENT REGISTRY & DISPATCHER            │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │                                                                        │ │
│  │  const registry = Map<eventType, Rule>                                │ │
│  │                                                                        │ │
│  │  defineRule(eventType, rule) ─────────┬───────────────────────────┐  │ │
│  │    ↓ Registers rule in map            │                           │  │ │
│  │                                       ▼                           │  │ │
│  │  emitEvent(eventType, ctx)           Rule {                      │  │ │
│  │    ├─ Lookup rule in registry          recipients: (ctx) => []   │  │ │
│  │    ├─ Determine recipients             effects: [Effect, ...]    │  │ │
│  │    ├─ Fetch user emails                                          │  │ │
│  │    ├─ Expand effects for each          Effect {                  │  │
│  │    │  recipient                         channel: "in-app"|"email"│  │ │
│  │    ├─ Call start(deliverEffects...)    when: "now"|Date|(ctx)=>  │  │ │
│  │    └─ Return                           title: (ctx) => string    │  │ │
│  │                                        body: (ctx) => string     │  │ │
│  └────────────────────────────────────────────────────────────────────┘  │ │
│                                       │                                     │
│  ┌────────────────────────────────────┴─────────────────────────────────┐ │
│  │  lib/notifications/rules.ts - RULE DEFINITIONS                       │ │
│  │  ────────────────────────────────────────────────────────────────────│ │
│  │                                                                      │ │
│  │  Rule 1: "obra.completed"                                           │ │
│  │  ────────────────────────                                           │ │
│  │    Recipients: [actorId] (who triggered completion)                 │ │
│  │    Effects:                                                         │ │
│  │      ├─ In-app (immediate):                                         │ │
│  │      │  "Obra completada" → /excel/{obraId}                        │ │
│  │      └─ Email (scheduled):                                          │ │
│  │         Message in 2 min (or custom followUpAt)                     │ │
│  │                                                                      │ │
│  │  Rule 2: "document.reminder.requested"                              │ │
│  │  ──────────────────────────────────────                             │ │
│  │    Recipients: [notifyUserId]                                       │ │
│  │    Effects:                                                         │ │
│  │      └─ In-app (scheduled):                                         │ │
│  │         Day before dueDate at 9 AM                                  │ │
│  │         "Recordatorio: {docName} pendiente"                         │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                       │                                   │
│  ┌────────────────────────────────────┴──────────────────────────────┐  │
│  │  lib/notifications/recipients.ts - HELPER FUNCTIONS              │  │
│  │  ────────────────────────────────────────────────────────────────│  │
│  │                                                                  │  │
│  │  getUserEmailById(userId): Promise<string|null>                 │  │
│  │    ├─ Uses Supabase Admin client                                │  │
│  │    ├─ Fetches from auth.users                                   │  │
│  │    └─ Returns email or null                                     │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      API ENDPOINTS (Backend Routes)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  POST /api/notifications/emit                                               │
│  ─────────────────────────────                                              │
│    Purpose: Generic event emission (for testing/manual triggers)            │
│    Body: {                                                                   │
│      type: "obra.completed" | "document.reminder.requested",               │
│      ctx: { tenantId, actorId, obra, followUpAt, ... }                     │
│    }                                                                         │
│    Response: { ok: true }                                                    │
│    ├─ Validates event type                                                  │
│    ├─ Calls emitEvent(type, ctx)                                            │
│    └─ Returns result                                                        │
│                                                                              │
│  POST /api/doc-reminders                                                    │
│  ────────────────────────────                                               │
│    Purpose: Schedule document reminder notification                         │
│    Body: {                                                                   │
│      obraId: string (required),                                             │
│      documentName: string (required),                                       │
│      dueDate: string (YYYY-MM-DD or ISO),                                   │
│      obraName?: string,                                                     │
│      notifyUserId?: string                                                  │
│    }                                                                         │
│    Response: { ok: true }                                                    │
│    ├─ Validates required fields                                             │
│    ├─ Emits "document.reminder.requested" event                             │
│    └─ Workflow calculates reminder time (day before @ 9 AM)                 │
│                                                                              │
│  PUT /api/obras (TRIGGERS OBRA COMPLETION)                                  │
│  ───────────────                                                             │
│    Purpose: Upsert obra data (from Excel upload)                            │
│    Body: { detalleObras: [...] }                                            │
│    ├─ Upserts all obras in database                                         │
│    ├─ Detects: porcentaje < 100 → 100                                       │
│    └─ For each newly completed obra:                                        │
│       emitEvent("obra.completed", {                                         │
│         tenantId: ...,                                                      │
│         actorId: user.id,                                                   │
│         obra: { id, name, percentage: 100 },                                │
│         followUpAt: obra.on_finish_second_send_at                           │
│       })                                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│              DATA FLOW: OBRA COMPLETION NOTIFICATION (Full Journey)          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: User Action (Frontend)                                             │
│  ──────────────────────────────                                             │
│  User uploads Excel with porcentaje: 100 for an obra                        │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 2: API Validation & Upsert (Backend)                                  │
│  ──────────────────────────────────────────                                 │
│  PUT /api/obras                                                             │
│    1. Validate schema with Zod                                              │
│    2. Compare existing porcentaje vs new                                     │
│    3. Find newlyCompleted = (old < 100) AND (new = 100)                     │
│    4. Fetch obra details from DB (ID, name, custom messages)                │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 3: Event Emission (Engine)                                            │
│  ────────────────────────────────                                           │
│  for (obra of newlyCompleted) {                                             │
│    emitEvent("obra.completed", {                                            │
│      tenantId: string,                                                      │
│      actorId: user.id,                                                      │
│      obra: { id, name, percentage: 100 },                                   │
│      followUpAt: obra.on_finish_second_send_at || ISO date                  │
│    })                                                                        │
│  }                                                                           │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 4: Rule Matching (Event Registry)                                     │
│  ────────────────────────────────────────                                   │
│  const rule = registry.get("obra.completed")                                │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 5: Recipient Determination (Rule Logic)                               │
│  ──────────────────────────────────────────────                             │
│  recipients(ctx) => {                                                       │
│    return [ctx.actorId]  // Just the user who completed it                  │
│  }                                                                           │
│  Result: ["user-123"]                                                       │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 6: Email Lookup (Recipient Helper)                                    │
│  ──────────────────────────────────────────                                 │
│  for (userId of ["user-123"]) {                                             │
│    email = getUserEmailById(userId)                                         │
│      = fetch from auth.users via admin client                               │
│      = "user@example.com"                                                   │
│  }                                                                           │
│  Result: [{ userId: "user-123", email: "user@example.com" }]                │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 7: Effect Expansion (Personalization)                                 │
│  ─────────────────────────────────────────────                              │
│  Rule has 2 effects: in-app + email                                         │
│  For each recipient, expand effects:                                        │
│                                                                              │
│    Effect 1: In-app (immediate)                                             │
│    ─────────────────────────                                                │
│    {                                                                         │
│      channel: "in-app",                                                     │
│      when: "now",                                                           │
│      title: "Obra completada",                                              │
│      body: "La obra \"${ctx.obra.name}\" alcanzó el 100%.",                 │
│      actionUrl: "/excel/${ctx.obra.id}",                                    │
│      type: "success",                                                       │
│      recipientId: "user-123",                                               │
│      ctx: { ... }                                                           │
│    }                                                                         │
│                                                                              │
│    Effect 2: Email (scheduled)                                              │
│    ────────────────────────                                                 │
│    {                                                                         │
│      channel: "email",                                                      │
│      when: calculateSchedule(ctx.followUpAt),  // 2 min or custom           │
│      subject: "Seguimiento: ${ctx.obra.name}",                              │
│      html: "<p>Recordatorio: la obra ...",                                  │
│      recipientEmail: "user@example.com",                                    │
│      ctx: { ... }                                                           │
│    }                                                                         │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 8: Workflow Execution (Async Delivery)                                │
│  ──────────────────────────────────────────────                             │
│  start(deliverEffectsWorkflow, [expandedEffects])                           │
│                                                                              │
│    Effect 1 Execution (Immediate):                                          │
│    ──────────────────────────────                                           │
│    1. when = "now" → skip sleep                                             │
│    2. channel = "in-app" → "use step"                                       │
│    3. INSERT notifications (                                                │
│         user_id: "user-123",                                                │
│         title: "Obra completada",                                           │
│         body: "La obra \"Puente Ruta 5\" alcanzó el 100%.",                 │
│         type: "success",                                                    │
│         action_url: "/excel/uuid-123",                                      │
│         created_at: now(),                                                  │
│         read_at: null,  ← UNREAD                                            │
│         data: {}                                                            │
│       )                                                                      │
│                   │                                                         │
│    Effect 2 Execution (Scheduled):                                          │
│    ───────────────────────────────                                          │
│    1. when = future Date (2 min from now)                                   │
│    2. await sleep(futureDate)  ← Durable pause                              │
│    3. Resume after sleep expires                                            │
│    4. channel = "email" → "use step"                                        │
│    5. resend.emails.send({                                                  │
│         from: "noreply@example.com",                                        │
│         to: "user@example.com",                                             │
│         subject: "Seguimiento: Puente Ruta 5",                              │
│         html: "<p>Recordatorio: la obra ...",                               │
│       })                                                                     │
│                   │                                                         │
│                   ▼                                                         │
│  STEP 9: Frontend Display (User Sees Notification)                          │
│  ──────────────────────────────────────────────────                         │
│  1. User navigates to any page in app                                       │
│  2. User clicks bell icon in header (user-menu.tsx)                         │
│  3. useEffect triggers:                                                     │
│     SELECT id, title, body, type, created_at, read_at, action_url           │
│     FROM notifications                                                      │
│     WHERE user_id = auth.uid()                                              │
│     ORDER BY created_at DESC                                                │
│     LIMIT 50                                                                │
│  4. Dialog displays notification:                                           │
│     ┌─────────────────────────────────────────┐                            │
│     │ Obra completada                      [●] │  ← orange unread dot     │
│     │ La obra "Puente Ruta 5" alcanzó el 100%.│                            │
│     │ View details                             │  ← actionUrl click        │
│     │                              5 min ago    │  ← timestamp              │
│     └─────────────────────────────────────────┘                            │
│  5. User clicks "View details"                                              │
│     → Navigate to /excel/uuid-123                                           │
│     → Open obra details                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


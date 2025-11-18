import { emitEvent, type EventContext, type EffectDef, defineRule } from "./engine"
import "@/lib/notifications/rules"

export type NotificationChannel = "in-app" | "email"

export type InAppNotificationInput = {
  tenantId?: string | null
  userId: string
  title: string
  body?: string | null
  type?: string
  actionUrl?: string | null
  data?: Record<string, any>
  pendienteId?: string | null
  /**
   * When to deliver the notification.
   * - "now" (default)
   * - Date (absolute moment in time)
   */
  when?: "now" | Date
}

export type GroupNotificationInput = Omit<
  InAppNotificationInput,
  "userId"
> & {
  /**
   * Target all users that have a role with this key in the tenant.
   * This corresponds to roles.key in the database.
   */
  roleKey: string
}

/**
 * Emit a domain event that is handled by rule definitions.
 * This is the main entry point most server code should use.
 */
export async function emitDomainEvent<TCtx extends EventContext>(
  type: string,
  ctx: TCtx
): Promise<void> {
  await emitEvent(type, ctx)
}

/**
 * Ad‑hoc in‑app notification for a single user.
 * Implemented as a rule-backed event ("custom.in_app") so it flows
 * through the same workflow engine and delivery pipeline.
 */
export async function notifyInApp(input: InAppNotificationInput): Promise<void> {
  const when = input.when ?? "now"

  const ctx: EventContext = {
    tenantId: input.tenantId ?? null,
    actorId: null,
    userId: input.userId,
    title: input.title,
    body: input.body ?? null,
    type: input.type ?? "info",
    actionUrl: input.actionUrl ?? null,
    data: input.data ?? {},
    pendienteId: input.pendienteId ?? null,
    when,
  }

  await emitDomainEvent("custom.in_app", ctx)
}

/**
 * Ad‑hoc in‑app notification for all users in a tenant with a given role.
 * This uses a separate event type ("custom.in_app.role") so that
 * rule recipients can resolve membership by role server-side.
 */
export async function notifyInAppForRole(
  input: GroupNotificationInput
): Promise<void> {
  const when = input.when ?? "now"

  const ctx: EventContext = {
    tenantId: input.tenantId ?? null,
    actorId: null,
    roleKey: input.roleKey,
    title: input.title,
    body: input.body ?? null,
    type: input.type ?? "info",
    actionUrl: input.actionUrl ?? null,
    data: input.data ?? {},
    pendienteId: input.pendienteId ?? null,
    when,
  }

  await emitDomainEvent("custom.in_app.role", ctx)
}

// Register lightweight rules for the custom helper events.
// These are defined here (instead of rules.ts) so the API module is self-contained.

const customInAppRule: EffectDef = {
  channel: "in-app",
  when: (ctx) => ctx.when ?? "now",
  title: (ctx) => ctx.title ?? "",
  body: (ctx) => ctx.body ?? null,
  type: (ctx) => ctx.type ?? "info",
  actionUrl: (ctx) => ctx.actionUrl ?? null,
  data: (ctx) => ctx.data ?? {},
}

defineRule("custom.in_app", {
  recipients: async (ctx) => {
    const userId = ctx.userId as string | undefined
    return userId ? [userId] : []
  },
  effects: [customInAppRule],
})

defineRule("custom.in_app.role", {
  recipients: async (ctx) => {
    const roleKey = (ctx.roleKey ?? ctx.role) as string | undefined
    if (!roleKey) return []
    // Use a pseudo recipient ID; the engine will expand "role:<key>"
    // into concrete user IDs via roles + user_roles lookup.
    return [`role:${roleKey}`]
  },
  effects: [customInAppRule],
})



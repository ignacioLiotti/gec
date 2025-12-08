import { notifyInApp, notifyInAppForRole } from "@/lib/notifications/api"

export type ReminderChannels = ("in-app" | "email")[]

export type ScheduleOffset =
  | { type: "at-date" } // exactly at targetDate
  | { type: "days-before"; days: number }

export type ReminderTarget =
  | { type: "user"; userId: string }
  | { type: "role"; tenantId: string; roleKey: string }

export type CreateReminderInput = {
  targetDate: Date
  offsets: ScheduleOffset[]
  channels: ReminderChannels
  target: ReminderTarget
  title: string
  body?: string
  actionUrl?: string | null
  tenantId?: string | null
  data?: Record<string, any>
}

function computeWhen(targetDate: Date, offset: ScheduleOffset): Date {
  if (offset.type === "at-date") {
    return new Date(targetDate)
  }
  const d = new Date(targetDate)
  d.setDate(d.getDate() - offset.days)
  return d
}

/**
 * Lightweight helper to schedule reminder notifications for a given
 * target date, channels, and audience (single user or role).
 *
 * Internally this just calls the notification API with the right `when` dates,
 * so it stays stateless and can be invoked from any server context.
 */
export async function createReminder(input: CreateReminderInput): Promise<void> {
  const { targetDate, offsets, channels, target, title, body, actionUrl, tenantId, data } =
    input

  const whenDates = offsets.map((offset) => computeWhen(targetDate, offset))

  // For now, only in-app channel is implemented here; email can be added later
  if (channels.includes("in-app")) {
    await Promise.all(
      whenDates.map((when) => {
        if (target.type === "user") {
          return notifyInApp({
            tenantId: tenantId ?? null,
            userId: target.userId,
            title,
            body: body ?? null,
            actionUrl: actionUrl ?? null,
            data: {
              ...data,
              reminderTargetDate: targetDate.toISOString(),
            },
            when,
          })
        }

        // Role-targeted reminders expand to all members with that role in the tenant.
        return notifyInAppForRole({
          tenantId: target.tenantId,
          roleKey: target.roleKey,
          title,
          body: body ?? null,
          actionUrl: actionUrl ?? null,
          data: {
            ...data,
            reminderTargetDate: targetDate.toISOString(),
          },
          when,
        })
      })
    )
  }

  // Future: if you want email reminders, call `sendEmail` / template helpers here as well.
}



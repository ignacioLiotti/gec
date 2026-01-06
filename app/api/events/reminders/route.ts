import { NextResponse } from "next/server"
import { createClient as createServerRlsClient } from "@/utils/supabase/server"
import { createReminder } from "@/lib/events/reminders"
import { z } from "zod"
import { ApiValidationError, validateJsonBody } from "@/lib/http/validation"

const ReminderSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  date: z.string().min(1),
  audienceType: z.enum(["me", "role"]).default("me"),
  audienceRoleId: z.string().nullish(),
})

export async function POST(request: Request) {
  try {
    const { title, description, date, audienceType, audienceRoleId } =
      await validateJsonBody(request, ReminderSchema)
    const targetDate = new Date(date)
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date" },
        { status: 400 }
      )
    }

    const rls = await createServerRlsClient()
    const { data: me } = await rls.auth.getUser()
    const authedUserId = me.user?.id ?? null
    if (!authedUserId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: membership } = await rls
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", authedUserId)
      .limit(1)
      .maybeSingle()
    const tenantId = (membership as any)?.tenant_id ?? null

    const target =
      audienceType === "role" && tenantId && audienceRoleId
        ? {
            type: "role" as const,
            tenantId: tenantId as string,
            roleId: audienceRoleId as string,
          }
        : {
            type: "user" as const,
            userId: authedUserId,
          }

    await createReminder({
      targetDate,
      offsets: [{ type: "at-date" }],
      channels: ["in-app"],
      target,
      title,
      body: description ?? undefined,
      actionUrl: null,
      tenantId,
      data: {},
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error instanceof ApiValidationError) {
      return NextResponse.json(
        { error: error.message, issues: error.issues },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to create reminder event" },
      { status: 500 }
    )
  }
}



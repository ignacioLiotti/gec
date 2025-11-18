import { NextResponse } from "next/server"
import { createClient as createServerRlsClient } from "@/utils/supabase/server"
import { createReminder } from "@/lib/events/reminders"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title : ""
    const description =
      typeof body?.description === "string" ? body.description : null
    const dateStr = typeof body?.date === "string" ? body.date : null
    const audienceType =
      body?.audienceType === "role" ? "role" : ("me" as "me" | "role")
    const audienceRoleKey =
      typeof body?.audienceRole === "string" ? body.audienceRole : null

    if (!title || !dateStr) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const targetDate = new Date(dateStr)
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
      audienceType === "role" && tenantId && audienceRoleKey
        ? {
            type: "role" as const,
            tenantId: tenantId as string,
            roleKey: audienceRoleKey as string,
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
    return NextResponse.json(
      { error: error?.message ?? "Failed to create reminder event" },
      { status: 500 }
    )
  }
}



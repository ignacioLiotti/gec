import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createReminder } from "@/lib/events/reminders"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const description =
      typeof body?.description === "string" ? body.description : null
    const startStr = typeof body?.start === "string" ? body.start : null
    const endStr = typeof body?.end === "string" ? body.end : null
    const allDay = Boolean(body?.allDay)
    const audienceType =
      body?.audienceType === "role" || body?.audienceType === "user"
        ? (body.audienceType as "role" | "user")
        : ("me" as "me" | "role" | "user")
    const audienceRoleKey =
      typeof body?.audienceRoleKey === "string" ? body.audienceRoleKey : null
    const targetUserId =
      typeof body?.targetUserId === "string" ? body.targetUserId : null

    if (!title || !startStr || !endStr) {
      return NextResponse.json(
        { error: "Missing required fields: title, start, end" },
        { status: 400 }
      )
    }

    const startAt = new Date(startStr)
    const endAt = new Date(endStr)
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid start or end date" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Resolve tenant from membership
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { error: "Failed to resolve tenant" },
        { status: 500 }
      )
    }

    const tenantId = (membership as any)?.tenant_id as string | undefined
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant for user" },
        { status: 400 }
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from("calendar_events")
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        title,
        description,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        all_day: allDay,
        audience_type: audienceType,
        target_user_id: audienceType === "user" ? targetUserId : null,
        target_role_key: audienceType === "role" ? audienceRoleKey : null,
        deleted_at: null,
        deleted_by: null,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create calendar event" },
        { status: 500 }
      )
    }

    // Schedule an in-app reminder at the start time for the event's audience
    const targetDate = startAt
    let target:
      | { type: "user"; userId: string }
      | { type: "role"; tenantId: string; roleKey: string }

    if (audienceType === "user" && inserted.target_user_id) {
      target = { type: "user", userId: inserted.target_user_id as string }
    } else if (audienceType === "role" && inserted.target_role_key) {
      target = {
        type: "role",
        tenantId,
        roleKey: inserted.target_role_key as string,
      }
    } else {
      // Default: only the creator
      target = { type: "user", userId: user.id }
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
      data: {
        calendarEventId: inserted.id,
      },
    })

    return NextResponse.json({ event: inserted })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create calendar event" },
      { status: 500 }
    )
  }
}



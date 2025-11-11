import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";

/**
 * GET /api/events
 * Retrieve events for the current user
 * Query params:
 *   - type: Filter by event_type (e.g., 'APPOINTMENT', 'NOTIFICATION', 'MEETING')
 *   - status: Filter by status (e.g., 'pending', 'delivered', 'cancelled')
 *   - limit: Max number of events to return (default 50)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("type");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    let query = supabase
      .from("scheduled_events")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    console.error("GET /api/events error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/events
 * Create a new event directly (bypasses the rule engine)
 * Body:
 *   {
 *     event_type: string (required) - e.g., 'APPOINTMENT', 'MEETING', 'CUSTOM'
 *     title: string (required)
 *     description?: string
 *     metadata?: object
 *     scheduled_at: string (ISO date, required)
 *     notification_type?: string - for NOTIFICATION events
 *     action_url?: string
 *   }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      event_type,
      title,
      description,
      metadata,
      scheduled_at,
      notification_type,
      action_url,
      tenant_id,
    } = body;

    // Validation
    if (!event_type || typeof event_type !== "string") {
      return NextResponse.json({ error: "event_type is required" }, { status: 400 });
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (!scheduled_at || typeof scheduled_at !== "string") {
      return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 });
    }

    // Validate date
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled_at date" }, { status: 400 });
    }

    // Insert the event
    const { data, error } = await supabase
      .from("scheduled_events")
      .insert({
        user_id: user.id,
        tenant_id: tenant_id ?? null,
        event_type,
        title,
        description: description ?? null,
        metadata: metadata ?? {},
        scheduled_at: scheduledDate.toISOString(),
        notification_type: notification_type ?? null,
        action_url: action_url ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/events error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/events
 * Update an existing event
 * Body:
 *   {
 *     id: string (required)
 *     status?: 'pending' | 'delivered' | 'cancelled'
 *     read_at?: string (ISO date) or null
 *     description?: string
 *     scheduled_at?: string (ISO date)
 *   }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, read_at, description, scheduled_at } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, any> = {};

    if (status !== undefined) {
      if (!["pending", "delivered", "cancelled"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = status;
    }

    if (read_at !== undefined) {
      if (read_at === null) {
        updates.read_at = null;
      } else {
        const readDate = new Date(read_at);
        if (isNaN(readDate.getTime())) {
          return NextResponse.json({ error: "Invalid read_at date" }, { status: 400 });
        }
        updates.read_at = readDate.toISOString();
      }
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (scheduled_at !== undefined) {
      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid scheduled_at date" }, { status: 400 });
      }
      updates.scheduled_at = scheduledDate.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update the event (RLS ensures user can only update their own events)
    const { data, error } = await supabase
      .from("scheduled_events")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event: data });
  } catch (err) {
    console.error("PATCH /api/events error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/events
 * Delete an event
 * Query params:
 *   - id: Event ID to delete
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Delete the event (RLS ensures user can only delete their own events)
    const { error } = await supabase
      .from("scheduled_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/events error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

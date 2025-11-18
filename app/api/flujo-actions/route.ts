import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const obraId = searchParams.get("obraId");

		if (!obraId) {
			return NextResponse.json(
				{ error: "obraId is required" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		const { data: actions, error } = await supabase
			.from("obra_flujo_actions")
			.select("*")
			.eq("obra_id", obraId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Error fetching flujo actions:", error);
			return NextResponse.json(
				{ error: "Failed to fetch flujo actions" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ actions });
	} catch (error: any) {
		console.error("Error in GET /api/flujo-actions:", error);
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const {
			obraId,
			actionType,
			timingMode,
			offsetValue,
			offsetUnit,
			scheduledDate,
			title,
			message,
			recipientUserIds,
			notificationTypes,
		} = body;

		// Validation
		if (!obraId || !actionType || !timingMode || !title) {
			return NextResponse.json(
				{ error: "Missing required fields: obraId, actionType, timingMode, title" },
				{ status: 400 }
			);
		}

		if (!["email", "calendar_event"].includes(actionType)) {
			return NextResponse.json(
				{ error: "actionType must be 'email' or 'calendar_event'" },
				{ status: 400 }
			);
		}

		if (!["immediate", "offset", "scheduled"].includes(timingMode)) {
			return NextResponse.json(
				{ error: "timingMode must be 'immediate', 'offset', or 'scheduled'" },
				{ status: 400 }
			);
		}

		if (timingMode === "offset" && (!offsetValue || !offsetUnit)) {
			return NextResponse.json(
				{ error: "offsetValue and offsetUnit required for offset timing" },
				{ status: 400 }
			);
		}

		if (timingMode === "scheduled" && !scheduledDate) {
			return NextResponse.json(
				{ error: "scheduledDate required for scheduled timing" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		// Get current user and tenant
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Get tenant_id from obra
		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("tenant_id")
			.eq("id", obraId)
			.single();

		if (obraError || !obra) {
			return NextResponse.json(
				{ error: "Obra not found" },
				{ status: 404 }
			);
		}

		// Prepare recipients (always include current user)
		const recipients = Array.from(
			new Set([user.id, ...(recipientUserIds || [])])
		);

		// Prepare notification types (default to in_app if not specified)
		const notifTypes = notificationTypes && Array.isArray(notificationTypes) && notificationTypes.length > 0
			? notificationTypes
			: ["in_app"];

		// Insert the action
		const { data: action, error: insertError } = await supabase
			.from("obra_flujo_actions")
			.insert({
				tenant_id: obra.tenant_id,
				obra_id: obraId,
				action_type: actionType,
				timing_mode: timingMode,
				offset_value: offsetValue || null,
				offset_unit: offsetUnit || null,
				scheduled_date: scheduledDate || null,
				title,
				message: message || null,
				recipient_user_ids: recipients,
				notification_types: notifTypes,
				created_by: user.id,
			})
			.select()
			.single();

		if (insertError) {
			console.error("Error creating flujo action:", insertError);
			return NextResponse.json(
				{ error: "Failed to create flujo action" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ action });
	} catch (error: any) {
		console.error("Error in POST /api/flujo-actions:", error);
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function PUT(request: Request) {
	try {
		const body = await request.json();
		const {
			id,
			actionType,
			timingMode,
			offsetValue,
			offsetUnit,
			scheduledDate,
			title,
			message,
			recipientUserIds,
			notificationTypes,
			enabled,
		} = body;

		if (!id) {
			return NextResponse.json(
				{ error: "id is required" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		// Get current user
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Build update object
		const updates: any = { updated_at: new Date().toISOString() };
		if (actionType !== undefined) updates.action_type = actionType;
		if (timingMode !== undefined) updates.timing_mode = timingMode;
		if (offsetValue !== undefined) updates.offset_value = offsetValue;
		if (offsetUnit !== undefined) updates.offset_unit = offsetUnit;
		if (scheduledDate !== undefined) updates.scheduled_date = scheduledDate;
		if (title !== undefined) updates.title = title;
		if (message !== undefined) updates.message = message;
		if (enabled !== undefined) updates.enabled = enabled;

		// Update recipients (always include current user)
		if (recipientUserIds !== undefined) {
			updates.recipient_user_ids = Array.from(
				new Set([user.id, ...recipientUserIds])
			);
		}

		// Update notification types
		if (notificationTypes !== undefined && Array.isArray(notificationTypes)) {
			updates.notification_types = notificationTypes.length > 0
				? notificationTypes
				: ["in_app"];
		}

		const { data: action, error: updateError } = await supabase
			.from("obra_flujo_actions")
			.update(updates)
			.eq("id", id)
			.select()
			.single();

		if (updateError) {
			console.error("Error updating flujo action:", updateError);
			return NextResponse.json(
				{ error: "Failed to update flujo action" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ action });
	} catch (error: any) {
		console.error("Error in PUT /api/flujo-actions:", error);
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ error: "id is required" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		const { error: deleteError } = await supabase
			.from("obra_flujo_actions")
			.delete()
			.eq("id", id);

		if (deleteError) {
			console.error("Error deleting flujo action:", deleteError);
			return NextResponse.json(
				{ error: "Failed to delete flujo action" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error: any) {
		console.error("Error in DELETE /api/flujo-actions:", error);
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

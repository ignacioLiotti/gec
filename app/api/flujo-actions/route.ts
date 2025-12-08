import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import {
	ApiValidationError,
	validateJsonBody,
	validateSearchParams,
} from "@/lib/http/validation";

const FlujoActionsQuerySchema = z.object({
	obraId: z.string().uuid("obraId inválido"),
});

const FlujoActionsPayloadSchema = z
	.object({
		obraId: z.string().uuid(),
		actionType: z.enum(["email", "calendar_event"]),
		timingMode: z.enum(["immediate", "offset", "scheduled"]),
		offsetValue: z.coerce.number().int().positive().optional(),
		offsetUnit: z
			.enum(["minutes", "hours", "days", "weeks", "months"])
			.optional(),
		scheduledDate: z.string().min(1).optional(),
		title: z.string().min(1),
		message: z.string().nullish(),
		recipientUserIds: z.array(z.string().uuid()).optional(),
		notificationTypes: z.array(z.enum(["in_app", "email"])).optional(),
	})
	.superRefine((val, ctx) => {
		if (val.timingMode === "offset" && (!val.offsetValue || !val.offsetUnit)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "offsetValue y offsetUnit son obligatorios para offset",
				path: ["offsetValue"],
			});
		}
		if (val.timingMode === "scheduled" && !val.scheduledDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "scheduledDate es obligatorio para scheduled",
				path: ["scheduledDate"],
			});
		}
	});

const FlujoActionsUpdateSchema = z.object({
	id: z.string().uuid(),
	actionType: z.enum(["email", "calendar_event"]).optional(),
	timingMode: z.enum(["immediate", "offset", "scheduled"]).optional(),
	offsetValue: z.coerce.number().int().positive().optional(),
	offsetUnit: z
		.enum(["minutes", "hours", "days", "weeks", "months"])
		.optional(),
	scheduledDate: z.string().min(1).optional(),
	title: z.string().min(1).optional(),
	message: z.string().nullish().optional(),
	recipientUserIds: z.array(z.string().uuid()).optional(),
	notificationTypes: z.array(z.enum(["in_app", "email"])).optional(),
	enabled: z.boolean().optional(),
});

const FlujoActionsDeleteSchema = z.object({
	id: z.string().uuid(),
});

export async function GET(request: Request) {
	try {
		const { obraId } = validateSearchParams(
			new URL(request.url).searchParams,
			FlujoActionsQuerySchema
		);

		const supabase = await createClient();

		// Fetch flujo actions
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

		// Fetch ALL execution records for these actions (not just completed)
		const actionIds = actions?.map((a) => a.id) ?? [];
		const { data: executions } = await supabase
			.from("obra_flujo_executions")
			.select("flujo_action_id, executed_at, status, scheduled_for")
			.in("flujo_action_id", actionIds)
			.eq("obra_id", obraId)
			.order("executed_at", { ascending: false });

		// Group executions by action ID and determine overall status
		// An action is "completed" only when ALL its executions are completed
		const executionsByAction = new Map<string, Array<{
			status: string;
			executed_at: string | null;
			scheduled_for: string | null;
		}>>();

		for (const exec of executions ?? []) {
			const existing = executionsByAction.get(exec.flujo_action_id) ?? [];
			existing.push({
				status: exec.status,
				executed_at: exec.executed_at,
				scheduled_for: exec.scheduled_for,
			});
			executionsByAction.set(exec.flujo_action_id, existing);
		}

		// Merge execution status into actions
		const actionsWithExecution = actions?.map((action) => {
			const actionExecutions = executionsByAction.get(action.id);

			if (!actionExecutions || actionExecutions.length === 0) {
				// No executions - action was never triggered
				return { ...action, executed_at: null };
			}

			// Check if ALL executions are completed
			const allCompleted = actionExecutions.every((e) => e.status === "completed");
			const anyFailed = actionExecutions.some((e) => e.status === "failed");

			if (allCompleted) {
				// Find the latest executed_at timestamp
				const latestExecution = actionExecutions
					.filter((e) => e.executed_at)
					.sort((a, b) => new Date(b.executed_at!).getTime() - new Date(a.executed_at!).getTime())[0];
				return { ...action, executed_at: latestExecution?.executed_at ?? null };
			}

			// If any failed or still pending, action is not fully completed
			return { ...action, executed_at: null };
		});

		return NextResponse.json({ actions: actionsWithExecution });
	} catch (error: any) {
		console.error("Error in GET /api/flujo-actions:", error);
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
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
		} = await validateJsonBody(request, FlujoActionsPayloadSchema);

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
			.is("deleted_at", null)
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
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function PUT(request: Request) {
	try {
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
		} = await validateJsonBody(request, FlujoActionsUpdateSchema);

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
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	try {
		const { id } = validateSearchParams(
			new URL(request.url).searchParams,
			FlujoActionsDeleteSchema
		);

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
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Internal server error" },
			{ status: 500 }
		);
	}
}

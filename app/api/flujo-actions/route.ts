import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { emitEvent } from "@/lib/notifications/engine";
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
	offsetValue: z.coerce.number().int().positive().nullish(),
	offsetUnit: z
		.enum(["minutes", "hours", "days", "weeks", "months"])
		.nullish(),
	scheduledDate: z.string().min(1).nullish(),
	title: z.string().min(1).optional(),
	message: z.string().nullish(),
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
			.select("flujo_action_id, executed_at, status, scheduled_for, created_at")
			.in("flujo_action_id", actionIds)
			.eq("obra_id", obraId)
			.order("created_at", { ascending: true });

		// Group executions by action ID and determine overall status
		// An action is "completed" only when ALL its executions are completed
		const executionsByAction = new Map<string, Array<{
			status: string;
			executed_at: string | null;
			scheduled_for: string | null;
			created_at: string | null;
		}>>();

		for (const exec of executions ?? []) {
			const existing = executionsByAction.get(exec.flujo_action_id) ?? [];
			existing.push({
				status: exec.status,
				executed_at: exec.executed_at,
				scheduled_for: exec.scheduled_for,
				created_at: exec.created_at,
			});
			executionsByAction.set(exec.flujo_action_id, existing);
		}

		// Merge execution status into actions
		const actionsWithExecution = actions?.map((action) => {
			const actionExecutions = executionsByAction.get(action.id);

			if (!actionExecutions || actionExecutions.length === 0) {
				// No executions - action was never triggered
				return { ...action, executed_at: null, scheduled_for: null, triggered_at: null };
			}

			// Check if ALL executions are completed
			const allCompleted = actionExecutions.every((e) => e.status === "completed");

			// Get the earliest triggered_at (when obra reached 100%)
			const triggeredAt = actionExecutions
				.filter((e) => e.created_at)
				.sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())[0]?.created_at ?? null;

			// Get the latest scheduled_for (when notification will be delivered)
			const scheduledFor = actionExecutions
				.filter((e) => e.scheduled_for)
				.sort((a, b) => new Date(b.scheduled_for!).getTime() - new Date(a.scheduled_for!).getTime())[0]?.scheduled_for ?? null;

			if (allCompleted) {
				// Find the latest executed_at timestamp
				const latestExecution = actionExecutions
					.filter((e) => e.executed_at)
					.sort((a, b) => new Date(b.executed_at!).getTime() - new Date(a.executed_at!).getTime())[0];
				return {
					...action,
					executed_at: latestExecution?.executed_at ?? null,
					scheduled_for: scheduledFor,
					triggered_at: triggeredAt,
				};
			}

			// If any failed or still pending, action is not fully completed
			return {
				...action,
				executed_at: null,
				scheduled_for: scheduledFor,
				triggered_at: triggeredAt,
			};
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

		// Get tenant_id and porcentaje from obra
		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("tenant_id, porcentaje")
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

		// If obra is already at 100%, immediately trigger the action
		if (obra.porcentaje >= 100 && action) {
			const adminSupabase = createSupabaseAdminClient();
			const now = new Date();

			// Calculate executeAt based on timing settings
			let executeAt: Date | null = null;
			if (timingMode === "immediate") {
				executeAt = now;
			} else if (timingMode === "offset" && offsetValue) {
				switch (offsetUnit) {
					case "minutes":
						executeAt = new Date(now.getTime() + offsetValue * 60 * 1000);
						break;
					case "hours":
						executeAt = new Date(now.getTime() + offsetValue * 60 * 60 * 1000);
						break;
					case "days":
						executeAt = new Date(now.getTime() + offsetValue * 24 * 60 * 60 * 1000);
						break;
					case "weeks":
						executeAt = new Date(now.getTime() + offsetValue * 7 * 24 * 60 * 60 * 1000);
						break;
					case "months":
						executeAt = new Date(now);
						executeAt.setMonth(executeAt.getMonth() + offsetValue);
						break;
					default:
						executeAt = new Date(now.getTime() + offsetValue * 24 * 60 * 60 * 1000);
				}
			} else if (timingMode === "scheduled" && scheduledDate) {
				executeAt = new Date(scheduledDate);
				// If scheduled time is in the past, execute now
				if (executeAt.getTime() < now.getTime()) {
					executeAt = now;
				}
			}

			if (executeAt) {
				const scheduledFor = executeAt.toISOString();

				console.info("Triggering flujo action for already-completed obra", {
					actionId: action.id,
					obraId,
					scheduledFor,
				});

				// Create execution records and emit events for each recipient
				for (const recipientId of recipients) {
					// Create execution record
					const { data: execution, error: execError } = await adminSupabase
						.from("obra_flujo_executions")
						.insert({
							flujo_action_id: action.id,
							obra_id: obraId,
							recipient_user_id: recipientId,
							scheduled_for: scheduledFor,
							notification_types: notifTypes,
							status: "pending",
						})
						.select("id")
						.single();

					if (execError) {
						console.error("Failed to create execution for new action", {
							actionId: action.id,
							recipientId,
							error: execError,
						});
						continue;
					}

					// Emit workflow event
					try {
						await emitEvent("flujo.action.triggered", {
							tenantId: obra.tenant_id,
							actorId: user.id,
							recipientId,
							obraId,
							actionId: action.id,
							title,
							message: message || null,
							executeAt: scheduledFor,
							notificationTypes: notifTypes,
							executionId: execution?.id,
						});
						console.info("Flujo workflow emitted for new action on completed obra", {
							actionId: action.id,
							recipientId,
							scheduledFor,
						});
					} catch (eventError) {
						console.error("Failed to emit workflow for new action", {
							actionId: action.id,
							recipientId,
							error: eventError,
						});
					}
				}
			}
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
		const adminSupabase = createSupabaseAdminClient();

		// Get current user
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Check if timing is being changed - if so, we need to reschedule
		const timingChanged = timingMode !== undefined || offsetValue !== undefined ||
			offsetUnit !== undefined || scheduledDate !== undefined;

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

		// Update the action in database
		const { data: action, error: updateError } = await supabase
			.from("obra_flujo_actions")
			.update(updates)
			.eq("id", id)
			.select("*, obras!inner(tenant_id)")
			.single();

		if (updateError) {
			console.error("Error updating flujo action:", updateError);
			return NextResponse.json(
				{ error: "Failed to update flujo action" },
				{ status: 500 }
			);
		}

		// If timing changed, reschedule pending executions
		if (timingChanged && action) {
			// Fetch pending executions for this action
			const { data: pendingExecutions } = await adminSupabase
				.from("obra_flujo_executions")
				.select("id, created_at, recipient_user_id, notification_types")
				.eq("flujo_action_id", id)
				.eq("status", "pending");

			if (pendingExecutions && pendingExecutions.length > 0) {
				// Get the original trigger time (when obra reached 100%)
				const triggeredAt = new Date(pendingExecutions[0].created_at);

				// Calculate new executeAt based on the NEW timing settings
				// but relative to the ORIGINAL trigger time
				let newExecuteAt: Date | null = null;
				const finalTimingMode = action.timing_mode;
				const finalOffsetValue = action.offset_value || 0;
				const finalOffsetUnit = action.offset_unit || "days";
				const finalScheduledDate = action.scheduled_date;

				if (finalTimingMode === "immediate") {
					// For immediate, execute now (or as soon as possible)
					newExecuteAt = new Date();
				} else if (finalTimingMode === "offset") {
					// Calculate based on original trigger time + new offset
					newExecuteAt = new Date(triggeredAt);
					switch (finalOffsetUnit) {
						case "minutes":
							newExecuteAt = new Date(triggeredAt.getTime() + finalOffsetValue * 60 * 1000);
							break;
						case "hours":
							newExecuteAt = new Date(triggeredAt.getTime() + finalOffsetValue * 60 * 60 * 1000);
							break;
						case "days":
							newExecuteAt = new Date(triggeredAt.getTime() + finalOffsetValue * 24 * 60 * 60 * 1000);
							break;
						case "weeks":
							newExecuteAt = new Date(triggeredAt.getTime() + finalOffsetValue * 7 * 24 * 60 * 60 * 1000);
							break;
						case "months":
							newExecuteAt = new Date(triggeredAt);
							newExecuteAt.setMonth(newExecuteAt.getMonth() + finalOffsetValue);
							break;
					}

					// If the new time is in the past, execute now
					if (newExecuteAt && newExecuteAt.getTime() < Date.now()) {
						newExecuteAt = new Date();
					}
				} else if (finalTimingMode === "scheduled" && finalScheduledDate) {
					newExecuteAt = new Date(finalScheduledDate);
					// If scheduled time is in the past, execute now
					if (newExecuteAt.getTime() < Date.now()) {
						newExecuteAt = new Date();
					}
				}

				if (newExecuteAt) {
					const newScheduledFor = newExecuteAt.toISOString();
					const tenantId = (action as any).obras?.tenant_id;
					const notifTypes = action.notification_types?.length > 0
						? action.notification_types
						: ["in_app"];

					console.info("Rescheduling flujo action", {
						actionId: id,
						oldExecutions: pendingExecutions.length,
						newScheduledFor,
						triggeredAt: triggeredAt.toISOString(),
					});

					// Delete old pending executions
					await adminSupabase
						.from("obra_flujo_executions")
						.delete()
						.eq("flujo_action_id", id)
						.eq("status", "pending");

					// Create new executions and emit events for each recipient
					for (const oldExec of pendingExecutions) {
						const recipientId = oldExec.recipient_user_id;

						// Create new execution record
						const { data: newExecution, error: execError } = await adminSupabase
							.from("obra_flujo_executions")
							.insert({
								flujo_action_id: id,
								obra_id: action.obra_id,
								recipient_user_id: recipientId,
								scheduled_for: newScheduledFor,
								notification_types: notifTypes,
								status: "pending",
							})
							.select("id")
							.single();

						if (execError) {
							console.error("Failed to create rescheduled execution", {
								actionId: id,
								recipientId,
								error: execError,
							});
							continue;
						}

						// Emit new event for the workflow
						try {
							await emitEvent("flujo.action.triggered", {
								tenantId,
								actorId: user.id,
								recipientId,
								obraId: action.obra_id,
								actionId: id,
								title: action.title,
								message: action.message,
								executeAt: newScheduledFor,
								notificationTypes: notifTypes,
								executionId: newExecution?.id,
							});
							console.info("Rescheduled flujo workflow emitted", {
								actionId: id,
								recipientId,
								newScheduledFor,
							});
						} catch (eventError) {
							console.error("Failed to emit rescheduled workflow", {
								actionId: id,
								recipientId,
								error: eventError,
							});
						}
					}
				}
			}
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

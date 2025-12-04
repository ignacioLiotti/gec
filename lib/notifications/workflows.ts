import { sleep } from "workflow";
import { insertNotificationEdge } from "@/lib/workflow/notifications";
import { sendSimpleEmailEdge } from "@/lib/workflow/email";
import { markFlujoExecutionStatusEdge } from "@/lib/workflow/flujo-executions";

type ExpandedEffect = {
	channel: "in-app" | "email";
	when: "now" | Date | null;
	title?: string | null;
	body?: string | null;
	subject?: string | null;
	html?: string | null;
	actionUrl?: string | null;
	data?: any;
	type?: string | null;
	ctx: any;
	recipientId?: string | null;
	recipientEmail?: string | null;
	shouldSend?: boolean;
	executionId?: string | null;
};

export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
	"use workflow";

	const executionId =
		effects.find((eff) => eff.executionId)?.executionId ??
		(effects[0]?.ctx?.executionId as string | null | undefined) ??
		null;

	console.info("[workflow] deliverEffectsWorkflow started", {
		effectCount: effects.length,
		executionId,
	});

	try {
		for (const eff of effects) {
			if (eff.shouldSend === false) continue;

			const at = eff.when;
			if (at && at !== "now") {
				const target = new Date(at);
				if (!Number.isFinite(target.getTime()) || target <= new Date()) {
					console.warn("[workflow] skipping sleep for past/invalid date", {
						executionId,
						recipientId: eff.recipientId ?? null,
						target,
					});
				} else {
					await sleep(target);
				}
			}

			console.info("[workflow] delivering effect", {
				executionId,
				channel: eff.channel,
				recipientId: eff.recipientId ?? null,
				eventType: eff.ctx?.eventType ?? eff.ctx?.type ?? "unknown",
				when: at === "now" || !at ? "now" : new Date(at as Date).toISOString(),
				title: eff.title ?? null,
				body: eff.body ?? null,
				subject: eff.subject ?? null,
			});

			if (eff.channel === "in-app") {
				("use step");
				await insertNotificationEdge({
					user_id: eff.recipientId,
					tenant_id: eff.ctx?.tenantId ?? null,
					title: eff.title ?? "",
					body: eff.body ?? null,
					type: eff.type ?? "info",
					action_url: eff.actionUrl ?? null,
					pendiente_id: (eff.ctx?.pendienteId as string | null) ?? null,
					data: eff.data ?? {},
				});
				console.info("[workflow] in-app notification inserted", {
					executionId,
					recipientId: eff.recipientId ?? null,
				});
			} else if (eff.channel === "email") {
				("use step");
				if (!eff.recipientEmail) continue;
				const subject = eff.subject ?? eff.title ?? "Notificación";
				const html =
					eff.html ??
					`<p>${eff.title ?? "Notificación"}</p><p>${eff.body ?? ""}</p>`;
				await sendSimpleEmailEdge({
					to: eff.recipientEmail,
					subject,
					html,
				});
				console.info("[workflow] email queued", {
					executionId,
					to: eff.recipientEmail,
					subject,
				});
			}
		}

		if (executionId) {
			await markFlujoExecutionStatusEdge({
				id: executionId,
				status: "completed",
			});
		}
	} catch (error: any) {
		console.error("[workflow] delivery failed", {
			executionId,
			error,
		});
		if (executionId) {
			await markFlujoExecutionStatusEdge({
				id: executionId,
				status: "failed",
				errorMessage:
					error instanceof Error ? error.message : String(error ?? "Error"),
			});
		}
		throw error;
	}
}

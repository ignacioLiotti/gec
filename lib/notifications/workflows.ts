import { sleep } from "workflow";
import { insertNotificationEdge } from "@/lib/workflow/notifications";
import { sendSimpleEmailEdge } from "@/lib/workflow/email";
import { markFlujoExecutionStatusEdge } from "@/lib/workflow/flujo-executions";

type ExpandedEffect = {
	channel: "in-app" | "email";
	// Resolved "when" value. `null` means "no delay" / treat as "now".
	when: "now" | Date | null | ((ctx: any) => Date | "now" | null);
	title?: (ctx: any) => string;
	body?: (ctx: any) => string | null | undefined;
	subject?: (ctx: any) => string | null | undefined;
	html?: (ctx: any) => string | null | undefined;
	actionUrl?: (ctx: any) => string | null | undefined;
	data?: (ctx: any) => any;
	type?: string | ((ctx: any) => string | null | undefined);
	ctx: any;
	recipientId?: string | null;
	recipientEmail?: string | null;
	shouldSend?: (ctx: any) => boolean;
	executionId?: string | null;
};

export async function deliverEffectsWorkflow(effects: ExpandedEffect[]) {
	"use workflow";

	const executionId =
		effects.find((eff) => eff.executionId)?.executionId ??
		(effects[0]?.ctx?.executionId as string | null | undefined) ??
		null;

	try {
		for (const eff of effects) {
			const shouldSend =
				typeof eff.shouldSend === "function" ? eff.shouldSend(eff.ctx) : true;
			if (!shouldSend) continue;

			const at = typeof eff.when === "function" ? eff.when(eff.ctx) : eff.when;
			if (at && at !== "now") {
				await sleep(new Date(at));
			}

			if (eff.channel === "in-app") {
				("use step");
				const resolvedType =
					typeof eff.type === "function" ? eff.type(eff.ctx) : eff.type;
				await insertNotificationEdge({
					user_id: eff.recipientId,
					tenant_id: eff.ctx?.tenantId ?? null,
					title: eff.title?.(eff.ctx) ?? "",
					body: eff.body?.(eff.ctx) ?? null,
					type: resolvedType ?? "info",
					action_url: eff.actionUrl?.(eff.ctx) ?? null,
					pendiente_id: (eff.ctx?.pendienteId as string | null) ?? null,
					data: eff.data?.(eff.ctx) ?? {},
				});
			} else if (eff.channel === "email") {
				("use step");
				if (!eff.recipientEmail) continue;
				const subject = eff.subject?.(eff.ctx) ?? "Notificación";
				const html =
					eff.html?.(eff.ctx) ??
					`<p>${eff.title?.(eff.ctx) ?? "Notificación"}</p><p>${
						eff.body?.(eff.ctx) ?? ""
					}</p>`;
				await sendSimpleEmailEdge({
					to: eff.recipientEmail,
					subject,
					html,
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

import { NextResponse } from "next/server";
import { emitEvent, expandEffectsForEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient as createServerRlsClient } from "@/utils/supabase/server";
import { z } from "zod";
import { ApiValidationError, validateJsonBody } from "@/lib/http/validation";

const DocReminderSchema = z.object({
	obraId: z.string().min(1),
	obraName: z.string().nullish(),
	documentName: z.string().min(1),
	dueDate: z.string().min(1),
	notifyUserId: z.string().min(1).optional(),
	pendienteId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
	try {
		const {
			obraId,
			obraName,
			documentName,
			dueDate,
			notifyUserId,
			pendienteId,
		} = await validateJsonBody(request, DocReminderSchema);

		const workflowsDisabled = process.env.WORKFLOWS_DISABLED === "1";
		const workflowsForced = process.env.WORKFLOWS_ENABLED === "1";
		const workflowsActive = workflowsForced || !workflowsDisabled;

		// Insert an immediate "created" notification so the UI can toast and list it
        try {
            const rls = await createServerRlsClient();
            const { data: me } = await rls.auth.getUser();
            const authedUserId = me.user?.id ?? null;
            const title = `Recordatorio programado: ${String(documentName)}`;
            const message = `Se programó para el ${String(dueDate)}.`;
			const basePayload: any = {
                user_id: authedUserId,
				title,
                body: message,
				type: "reminder",
				action_url: obraId ? `/excel/${obraId}` : null,
				data: {
					stage: "created",
					obraId: obraId ? String(obraId) : null,
					obraName: obraName ? String(obraName) : null,
					documentName: String(documentName),
					dueDate: String(dueDate),
				},
			};
			if (pendienteId) basePayload.pendiente_id = String(pendienteId);
			let ins = await rls.from("notifications").insert(basePayload);
			if ((ins as any)?.error && (ins as any).error?.code === '42703') {
				// Column pendiente_id might not exist yet; retry without it
				delete basePayload.pendiente_id;
				await rls.from("notifications").insert(basePayload);
			}
		} catch {}
		if (workflowsActive) {
			await emitEvent("document.reminder.requested", {
				obraId: String(obraId),
				obraName: obraName ? String(obraName) : null,
				documentName: String(documentName),
				dueDate: String(dueDate),
				notifyUserId: notifyUserId ? String(notifyUserId) : null,
				pendienteId: pendienteId ? String(pendienteId) : null,
			});
			return NextResponse.json({ ok: true, workflow: "queued" });
		}

		// Workflows explicitly disabled; rely on immediate insert above.
		return NextResponse.json({ ok: true, workflow: "disabled" });
	} catch (error: any) {
		if (error instanceof ApiValidationError) {
			return NextResponse.json(
				{ error: error.message, issues: error.issues },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: error?.message ?? "Failed to schedule reminder" },
			{ status: 500 }
		);
	}
}

import { NextResponse } from "next/server";
import { emitEvent, expandEffectsForEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createClient as createServerRlsClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { obraId, obraName, documentName, dueDate, notifyUserId, pendienteId } =
            body ?? {};
		if (!obraId || !documentName || !dueDate) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const workflowsEnabled =
			process.env.NODE_ENV === "production" &&
			process.env.WORKFLOWS_DISABLED !== "1";

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
        if (workflowsEnabled) {
            await emitEvent("document.reminder.requested", {
				obraId: String(obraId),
				obraName: obraName ? String(obraName) : null,
				documentName: String(documentName),
				dueDate: String(dueDate),
				notifyUserId: notifyUserId ? String(notifyUserId) : null,
                pendienteId: pendienteId ? String(pendienteId) : null,
			});
            return NextResponse.json({ ok: true });
		}

        // Dev: we already inserted a "created" row; skip immediate delivery. Acknowledge.
        return NextResponse.json({ ok: true });
	} catch (error: any) {
		return NextResponse.json(
			{ error: error?.message ?? "Failed to schedule reminder" },
			{ status: 500 }
		);
	}
}

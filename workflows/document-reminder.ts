import { sleep } from "workflow";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { parseLocalDate } from "@/utils/date";

type DocumentReminderParams = {
	obraId: string;
	obraName?: string | null;
	documentName: string;
	/**
	 * Due date string from client. Can be a date-only string (YYYY-MM-DD) or ISO string.
	 */
	dueDate: string;
	notifyUserId?: string | null;
	pendienteId?: string | null;
	/**
	 * Optional email fallback if you prefer email reminders instead of in-app notifications.
	 */
	notifyEmail?: string | null;
};

export async function sendDocumentReminderWorkflow(
	params: DocumentReminderParams
) {
	"use workflow";

	const reminderAt = computeReminderDate(params.dueDate);

	if (!reminderAt || reminderAt.getTime() <= Date.now()) {
		await sleep("2m");
	} else {
		await sleep(reminderAt);
	}

	await createNotification(params).catch(() => {
		// swallow to avoid failing workflow
	});

	return { success: true } as const;
}

function computeReminderDate(dueDateInput: string): Date | null {
    const due = parseLocalDate(dueDateInput);
    if (!due) {
        return null;
    }
    // Day-of due date at 09:00 local time
    const dayOf = new Date(due);
    dayOf.setHours(9, 0, 0, 0);
    return dayOf;
}

async function createNotification(params: DocumentReminderParams) {
	"use step";
	if (!params.notifyUserId) return;
	const supabase = createSupabaseAdminClient();
	const title = `Recordatorio: ${params.documentName} pendiente`;
	const body = `Mañana vence el documento "${params.documentName}" de la obra "${params.obraName ?? ""}".`;
	const actionUrl = `/excel/${params.obraId}`;
	await supabase.from("notifications").insert({
		user_id: params.notifyUserId,
		title,
		body,
		type: "reminder",
		action_url: actionUrl,
		pendiente_id: params.pendienteId ?? null,
		data: {
			obraId: params.obraId,
			obraName: params.obraName ?? null,
			documentName: params.documentName,
			dueDate: params.dueDate,
		},
	});
}

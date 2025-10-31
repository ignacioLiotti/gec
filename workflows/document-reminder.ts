import { sleep } from "workflow";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type DocumentReminderParams = {
	obraId: string;
	obraName?: string | null;
	documentName: string;
	/**
	 * Due date string from client. Can be a date-only string (YYYY-MM-DD) or ISO string.
	 */
	dueDate: string;
	notifyUserId?: string | null;
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
	let due = new Date(dueDateInput);
	if (Number.isNaN(due.getTime())) {
		// Try parsing date-only format
		if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)) {
			due = new Date(`${dueDateInput}T00:00:00`);
		} else {
			return null;
		}
	}
	// Day before due date at 09:00 local time
	const dayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
	dayBefore.setHours(9, 0, 0, 0);
	return dayBefore;
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
	});
}

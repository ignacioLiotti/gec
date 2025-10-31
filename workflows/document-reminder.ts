import { sleep } from "workflow";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type DocumentReminderParams = {
\tobraId: string;
\tobraName?: string | null;
\tdocumentName: string;
\t/**
\t * Due date string from client. Can be a date-only string (YYYY-MM-DD) or ISO string.
\t */
\tdueDate: string;
\tnotifyUserId?: string | null;
\t/**
\t * Optional email fallback if you prefer email reminders instead of in-app notifications.
\t */
\tnotifyEmail?: string | null;
};

export async function sendDocumentReminderWorkflow(params: DocumentReminderParams) {
\t"use workflow";

\tconst reminderAt = computeReminderDate(params.dueDate);

\tif (!reminderAt || reminderAt.getTime() <= Date.now()) {
\t\tawait sleep("2m");
\t} else {
\t\tawait sleep(reminderAt);
\t}

\tawait createNotification(params).catch(() => {
\t\t// swallow to avoid failing workflow
\t});

\treturn { success: true } as const;
}

function computeReminderDate(dueDateInput: string): Date | null {
\tlet due = new Date(dueDateInput);
\tif (Number.isNaN(due.getTime())) {
\t\t// Try parsing date-only format
\t\tif (/^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)) {
\t\t\tdue = new Date(`${dueDateInput}T00:00:00`);
\t\t} else {
\t\t\treturn null;
\t\t}
\t}
\t// Day before due date at 09:00 local time
\tconst dayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
\tdayBefore.setHours(9, 0, 0, 0);
\treturn dayBefore;
}

async function createNotification(params: DocumentReminderParams) {
\t"use step";
\tif (!params.notifyUserId) return;
\tconst supabase = createSupabaseAdminClient();
\tconst title = `Recordatorio: ${params.documentName} pendiente`;
\tconst body = `Mañana vence el documento "${params.documentName}" de la obra "${params.obraName ?? ""}".`;
\tconst actionUrl = `/excel/${params.obraId}`;
\tawait supabase.from("notifications").insert({
\t\tuser_id: params.notifyUserId,
\t\ttitle,
\t\tbody,
\t\ttype: "reminder",
\t\taction_url: actionUrl,
\t});
}



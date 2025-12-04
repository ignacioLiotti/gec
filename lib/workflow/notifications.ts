import { createSupabaseAdminClient } from "@/utils/supabase/admin";

type NotificationInsert = {
	user_id?: string | null;
	tenant_id?: string | null;
	title: string;
	body?: string | null;
	type?: string | null;
	action_url?: string | null;
	pendiente_id?: string | null;
	data?: Record<string, any> | null;
};

export async function insertNotificationEdge(row: NotificationInsert): Promise<void> {
	const client = createSupabaseAdminClient();
	const { error } = await client.rpc("workflow_insert_notification", {
		payload: row,
	});
	if (error) {
		console.error("[workflow/notifications] failed to insert via RPC", error);
		throw error;
	}
}

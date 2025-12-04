import { getVersionedSecret } from "@/lib/security/secrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

function buildWorkflowError(message: string): Error {
	return new Error(`[workflow/notifications] ${message}`);
}

export async function insertNotificationEdge(row: NotificationInsert): Promise<void> {
	if (!supabaseUrl) {
		throw buildWorkflowError("missing NEXT_PUBLIC_SUPABASE_URL");
	}

	const { value: serviceKey } = getVersionedSecret("SUPABASE_SERVICE_ROLE_KEY");
	if (!serviceKey) {
		throw buildWorkflowError("missing SUPABASE_SERVICE_ROLE_KEY configuration");
	}

	const response = await fetch(
		`${supabaseUrl}/rest/v1/rpc/workflow_insert_notification`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: serviceKey,
				Authorization: `Bearer ${serviceKey}`,
			},
			body: JSON.stringify({
				payload: row,
			}),
		}
	);

	if (!response.ok) {
		let errorPayload: unknown = null;
		try {
			errorPayload = await response.json();
		} catch {
			errorPayload = await response.text().catch(() => null);
		}
		console.error(
			"[workflow/notifications] failed to insert via RPC",
			response.status,
			errorPayload
		);
		throw buildWorkflowError(
			`RPC workflow_insert_notification failed with status ${response.status}`
		);
	}
}

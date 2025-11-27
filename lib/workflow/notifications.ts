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

export async function insertNotificationEdge(
	row: NotificationInsert
): Promise<void> {
	if (!supabaseUrl) {
		console.error("[workflow/notifications] missing NEXT_PUBLIC_SUPABASE_URL");
		return;
	}

	const { value: serviceKey } = getVersionedSecret(
		"SUPABASE_SERVICE_ROLE_KEY"
	);
	if (!serviceKey) {
		console.error(
			"[workflow/notifications] missing SUPABASE_SERVICE_ROLE_KEY configuration"
		);
		return;
	}

	const response = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			apikey: serviceKey,
			Authorization: `Bearer ${serviceKey}`,
			Prefer: "return=minimal",
		},
		body: JSON.stringify(row),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		console.error(
			"[workflow/notifications] failed to insert notification",
			response.status,
			text
		);
	}
}

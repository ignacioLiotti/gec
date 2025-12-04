import { fetch as workflowFetch } from "workflow";
import { getVersionedSecret } from "@/lib/security/secrets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

type ExecutionStatus = "pending" | "completed" | "failed";

type ExecutionStatusUpdate = {
	id: string;
	status: ExecutionStatus;
	errorMessage?: string | null;
};

export async function markFlujoExecutionStatusEdge(
	update: ExecutionStatusUpdate
): Promise<void> {
	"use step";
	if (!supabaseUrl) {
		console.error(
			"[workflow/flujo-executions] missing NEXT_PUBLIC_SUPABASE_URL"
		);
		return;
	}

	const { value: serviceKey } = getVersionedSecret(
		"SUPABASE_SERVICE_ROLE_KEY"
	);
	if (!serviceKey) {
		console.error(
			"[workflow/flujo-executions] missing SUPABASE_SERVICE_ROLE_KEY configuration"
		);
		return;
	}

	const payload: Record<string, any> = {
		status: update.status,
		error_message: update.errorMessage ?? null,
		updated_at: new Date().toISOString(),
	};

	if (update.status !== "pending") {
		payload.executed_at = new Date().toISOString();
	}

	const response = await workflowFetch(
		`${supabaseUrl}/rest/v1/obra_flujo_executions?id=eq.${update.id}`,
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				apikey: serviceKey,
				Authorization: `Bearer ${serviceKey}`,
				Prefer: "return=minimal",
			},
			body: JSON.stringify(payload),
		}
	);

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		console.error(
			"[workflow/flujo-executions] failed to update execution status",
			response.status,
			text
		);
	}
}

'use server';

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function updateTenantLimitsAction(formData: FormData) {
	const tenantId = formData.get("tenantId");
	if (typeof tenantId !== "string" || tenantId.length === 0) {
		throw new Error("Falta el ID de la organización.");
	}

	const parseNumber = (value: FormDataEntryValue | null): number | null => {
		if (value === null) return null;
		if (typeof value === "string" && value.trim() === "") return null;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	};

	const storageLimitGb = parseNumber(formData.get("storageLimitGb"));
	const aiTokenLimit = parseNumber(formData.get("aiTokenLimit"));
	const whatsappLimit = parseNumber(formData.get("whatsappLimit"));

	const storageBytes = storageLimitGb !== null ? Math.max(0, Math.trunc(storageLimitGb * 1024 * 1024 * 1024)) : null;

	const supabase = createSupabaseAdminClient();
	const payload = {
		tenant_id: tenantId,
		plan_key: formData.get("planKey") || undefined,
		storage_limit_bytes_override: storageBytes,
		ai_token_budget_override: aiTokenLimit,
		whatsapp_message_budget_override: whatsappLimit,
	};
	if (!payload.plan_key) {
		const { data: existing } = await supabase
			.from("tenant_subscriptions")
			.select("plan_key")
			.eq("tenant_id", tenantId)
			.maybeSingle();
		payload.plan_key = existing?.plan_key ?? "starter";
	}

	const { error } = await supabase.from("tenant_subscriptions").upsert(payload, {
		onConflict: "tenant_id",
	});

	if (error) {
		throw new Error(error.message);
	}

	revalidatePath("/admin/expenses/all");
}

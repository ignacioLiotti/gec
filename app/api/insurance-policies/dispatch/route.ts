import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { notifyInApp } from "@/lib/notifications/api";

function isAuthorized(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return process.env.NODE_ENV !== "production";
	return request.headers.get("x-cron-secret") === secret;
}

type DuePolicyRow = {
	id: string;
	tenant_id: string;
	policy_number: string;
	obras?: {
		n?: number | string | null;
		designacion_y_ubicacion?: string | null;
	} | Array<{
		n?: number | string | null;
		designacion_y_ubicacion?: string | null;
	}>;
};

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const admin = createSupabaseAdminClient();
	const today = new Date().toISOString().slice(0, 10);
	const { data: policies, error } = await admin
		.from("insurance_policies")
		.select(`
			id,
			tenant_id,
			obra_id,
			policy_number,
			calculated_cancellation_date,
			obras!inner(id, n, designacion_y_ubicacion, deleted_at)
		`)
		.eq("is_cancelled", false)
		.lte("calculated_cancellation_date", today)
		.is("last_notified_at", null)
		.is("obras.deleted_at", null);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	const byTenant = new Map<string, DuePolicyRow[]>();
	for (const policy of (policies ?? []) as DuePolicyRow[]) {
		const tenantId = policy.tenant_id;
		byTenant.set(tenantId, [...(byTenant.get(tenantId) ?? []), policy]);
	}

	let notified = 0;
	for (const [tenantId, tenantPolicies] of byTenant) {
		const { data: settings } = await admin
			.from("insurance_policy_settings")
			.select("responsible_user_id, responsible_user_ids")
			.eq("tenant_id", tenantId)
			.maybeSingle();
		const responsibleUserIds = Array.isArray(settings?.responsible_user_ids)
			? (settings.responsible_user_ids as string[])
			: settings?.responsible_user_id
				? [settings.responsible_user_id as string]
				: [];
		if (responsibleUserIds.length === 0) continue;

		const list = tenantPolicies
			.map((policy) => {
				const obra = Array.isArray(policy.obras) ? policy.obras[0] : policy.obras;
				return `Obra ${obra?.n ?? ""} ${obra?.designacion_y_ubicacion ?? ""}: ${policy.policy_number}`;
			})
			.join("\n");
		for (const responsibleUserId of responsibleUserIds) {
			await notifyInApp({
				tenantId,
				userId: responsibleUserId,
				title: "Polizas de seguro para dar de baja",
				body: list,
				type: "insurance_policy_due",
				actionUrl: "/macro?insurancePolicies=1",
				data: { policyIds: tenantPolicies.map((policy) => policy.id) },
			});
		}
		const ids = tenantPolicies.map((policy) => policy.id);
		await admin
			.from("insurance_policies")
			.update({ last_notified_at: new Date().toISOString() })
			.in("id", ids);
		notified += tenantPolicies.length;
	}

	return NextResponse.json({ ok: true, notified });
}

export async function GET(request: Request) {
	return POST(request);
}

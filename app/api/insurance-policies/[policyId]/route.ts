import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateCancellationDate } from "@/lib/insurance-policies";
import { syncInsurancePoliciesToMacroTable } from "@/lib/insurance-policies-macro";
import { getAuthContext } from "../../obras/route";

const PatchSchema = z.object({
	policyNumber: z.string().trim().min(1).optional(),
	endDate: z.string().nullable().optional(),
	cancellationRuleType: z.enum(["on_finish", "days_after", "months_after"]).optional(),
	cancellationRuleOffset: z.coerce.number().int().min(0).optional(),
	isCancelled: z.boolean().optional(),
});

type InsurancePolicyRow = {
	obra_id: string;
	policy_number: string;
	end_date: string | null;
	cancellation_rule_type: "on_finish" | "days_after" | "months_after";
	cancellation_rule_offset: number | null;
	obra_finished_at: string | null;
	is_cancelled: boolean;
	cancelled_at: string | null;
	cancelled_by: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ policyId: string }> }) {
	const { policyId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
	}

	const { data: existing, error: existingError } = await supabase
		.from("insurance_policies")
		.select("*")
		.eq("id", policyId)
		.eq("tenant_id", tenantId)
		.maybeSingle<InsurancePolicyRow>();
	if (existingError || !existing) return NextResponse.json({ error: "Póliza no encontrada" }, { status: 404 });

	const nextRuleType = parsed.data.cancellationRuleType ?? existing.cancellation_rule_type;
	const nextOffset = parsed.data.cancellationRuleOffset ?? Number(existing.cancellation_rule_offset ?? 0);
	const wasCancelled = existing.is_cancelled === true;
	const update: Record<string, unknown> = {
		policy_number: parsed.data.policyNumber ?? existing.policy_number,
		end_date: parsed.data.endDate === undefined ? existing.end_date : parsed.data.endDate,
		cancellation_rule_type: nextRuleType,
		cancellation_rule_offset: nextOffset,
		calculated_cancellation_date: calculateCancellationDate(existing.obra_finished_at, nextRuleType, nextOffset),
		updated_at: new Date().toISOString(),
	};

	if (parsed.data.isCancelled !== undefined) {
		update.is_cancelled = parsed.data.isCancelled;
		update.cancelled_at = parsed.data.isCancelled ? (existing.cancelled_at ?? new Date().toISOString()) : null;
		update.cancelled_by = parsed.data.isCancelled ? (existing.cancelled_by ?? user.id) : null;
		if (!wasCancelled && parsed.data.isCancelled) update.last_notified_at = null;
	}

	const { data, error } = await supabase
		.from("insurance_policies")
		.update(update)
		.eq("id", policyId)
		.eq("tenant_id", tenantId)
		.select("*")
		.single();
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [existing.obra_id] });
	return NextResponse.json({ policy: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ policyId: string }> }) {
	const { policyId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const { data: existing, error: existingError } = await supabase
		.from("insurance_policies")
		.select("obra_id")
		.eq("id", policyId)
		.eq("tenant_id", tenantId)
		.maybeSingle<{ obra_id: string }>();
	if (existingError || !existing) return NextResponse.json({ error: "PÃ³liza no encontrada" }, { status: 404 });

	const { error } = await supabase
		.from("insurance_policies")
		.delete()
		.eq("id", policyId)
		.eq("tenant_id", tenantId);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [existing.obra_id] });
	return NextResponse.json({ ok: true });
}

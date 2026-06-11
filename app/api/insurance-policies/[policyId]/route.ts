import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateCancellationDate } from "@/lib/insurance-policies";
import { syncInsurancePoliciesToMacroTable } from "@/lib/insurance-policies-macro";
import { getAuthContext } from "../../obras/route";

const PatchSchema = z.object({
	obraId: z.string().uuid().nullable().optional(),
	policyNumber: z.string().trim().min(1).optional(),
	section: z.string().nullable().optional(),
	coveragePeriod: z.string().nullable().optional(),
	endDate: z.string().nullable().optional(),
	insuredAmount: z.union([z.number(), z.string()]).nullable().optional(),
	currency: z.string().nullable().optional(),
	premium: z.union([z.number(), z.string()]).nullable().optional(),
	prize: z.union([z.number(), z.string()]).nullable().optional(),
	balance: z.union([z.number(), z.string()]).nullable().optional(),
	status: z.string().nullable().optional(),
	risk: z.string().nullable().optional(),
	insuredObject: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	definitiveReceptionDate: z.string().nullable().optional(),
	cancellationRequestedAt: z.string().nullable().optional(),
	cancellationConfirmedAt: z.string().nullable().optional(),
	cancellationNotes: z.string().nullable().optional(),
	cancellationRuleType: z.enum(["on_finish", "days_after", "months_after"]).optional(),
	cancellationRuleOffset: z.coerce.number().int().min(0).optional(),
	isCancelled: z.boolean().optional(),
});

type InsurancePolicyRow = {
	obra_id: string | null;
	policy_number: string;
	section: string | null;
	coverage_period: string | null;
	end_date: string | null;
	insured_amount: number | string | null;
	currency: string | null;
	premium: number | string | null;
	prize: number | string | null;
	balance: number | string | null;
	status: string | null;
	risk: string | null;
	insured_object: string | null;
	notes: string | null;
	cancellation_rule_type: "on_finish" | "days_after" | "months_after";
	cancellation_rule_offset: number | null;
	cancellation_rule_configured?: boolean | null;
	obra_finished_at: string | null;
	definitive_reception_date?: string | null;
	cancellation_requested_at?: string | null;
	cancellation_confirmed_at?: string | null;
	cancellation_notes?: string | null;
	is_cancelled: boolean;
	cancelled_at: string | null;
	cancelled_by: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ policyId: string }> }) {
	const { policyId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const rawBody = await request.json().catch(() => ({}));
	const parsed = PatchSchema.safeParse(rawBody);
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
	const nextDefinitiveReceptionDate =
		parsed.data.definitiveReceptionDate === undefined
			? existing.definitive_reception_date ?? null
			: parsed.data.definitiveReceptionDate;
	const ruleWasUpdated =
		Object.prototype.hasOwnProperty.call(rawBody, "cancellationRuleType") ||
		Object.prototype.hasOwnProperty.call(rawBody, "cancellationRuleOffset");
	const nextRuleConfigured = ruleWasUpdated ? true : existing.cancellation_rule_configured === true;
	const wasCancelled = existing.is_cancelled === true;
	const nextObraId = parsed.data.obraId === undefined ? existing.obra_id : parsed.data.obraId;
	let nextObraFinishedAt = existing.obra_finished_at;
	let targetObra: { porcentaje: number | string | null } | null = null;
	if (!nextObraId) {
		nextObraFinishedAt = null;
	} else if (nextObraId !== existing.obra_id) {
		const { data: obra, error: obraError } = await supabase
			.from("obras")
			.select("porcentaje")
			.eq("id", nextObraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle<{ porcentaje: number | string | null }>();
		if (obraError || !obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
		targetObra = obra;
		nextObraFinishedAt = nextRuleConfigured && Number(obra.porcentaje ?? 0) >= 100
			? new Date().toISOString().slice(0, 10)
			: null;
	}
	if (nextRuleConfigured && !nextObraFinishedAt && nextObraId) {
		const { data: obra } = targetObra
			? { data: targetObra }
			: await supabase
			.from("obras")
			.select("porcentaje")
			.eq("id", nextObraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle<{ porcentaje: number | string | null }>();
		if (Number(obra?.porcentaje ?? 0) >= 100) {
			nextObraFinishedAt = new Date().toISOString().slice(0, 10);
		}
	}
	const update: Record<string, unknown> = {
		obra_id: nextObraId,
		import_match_status: nextObraId ? "matched" : "unmatched",
		policy_number: parsed.data.policyNumber ?? existing.policy_number,
		section: parsed.data.section === undefined ? existing.section : parsed.data.section,
		coverage_period: parsed.data.coveragePeriod === undefined ? existing.coverage_period : parsed.data.coveragePeriod,
		end_date: parsed.data.endDate === undefined ? existing.end_date : parsed.data.endDate,
		insured_amount: parsed.data.insuredAmount === undefined ? existing.insured_amount : parsed.data.insuredAmount,
		currency: parsed.data.currency === undefined ? existing.currency : parsed.data.currency,
		premium: parsed.data.premium === undefined ? existing.premium : parsed.data.premium,
		prize: parsed.data.prize === undefined ? existing.prize : parsed.data.prize,
		balance: parsed.data.balance === undefined ? existing.balance : parsed.data.balance,
		status: parsed.data.status === undefined ? existing.status : parsed.data.status,
		risk: parsed.data.risk === undefined ? existing.risk : parsed.data.risk,
		insured_object: parsed.data.insuredObject === undefined ? existing.insured_object : parsed.data.insuredObject,
		notes: parsed.data.notes === undefined ? existing.notes : parsed.data.notes,
		cancellation_rule_type: nextRuleType,
		cancellation_rule_offset: nextOffset,
		cancellation_rule_configured: nextRuleConfigured,
		obra_finished_at: nextObraFinishedAt,
		definitive_reception_date: nextDefinitiveReceptionDate,
		cancellation_requested_at: parsed.data.cancellationRequestedAt === undefined ? existing.cancellation_requested_at ?? null : parsed.data.cancellationRequestedAt,
		cancellation_confirmed_at: parsed.data.cancellationConfirmedAt === undefined ? existing.cancellation_confirmed_at ?? null : parsed.data.cancellationConfirmedAt,
		cancellation_notes: parsed.data.cancellationNotes === undefined ? existing.cancellation_notes ?? null : parsed.data.cancellationNotes,
		calculated_cancellation_date: nextRuleConfigured ? calculateCancellationDate(nextObraFinishedAt, nextRuleType, nextOffset, nextDefinitiveReceptionDate) : null,
		updated_at: new Date().toISOString(),
	};

	if (parsed.data.isCancelled !== undefined) {
		update.is_cancelled = parsed.data.isCancelled;
		update.cancelled_at = parsed.data.isCancelled ? (existing.cancelled_at ?? new Date().toISOString()) : null;
		update.cancelled_by = parsed.data.isCancelled ? (existing.cancelled_by ?? user.id) : null;
		if (!wasCancelled && parsed.data.isCancelled) update.last_notified_at = null;
	}

	let { data, error } = await supabase
		.from("insurance_policies")
		.update(update)
		.eq("id", policyId)
		.eq("tenant_id", tenantId)
		.select("*")
		.single();
	if (error && /cancellation_rule_configured|definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
		const legacyUpdate = { ...update };
		if (/cancellation_rule_configured/i.test(error.message)) delete legacyUpdate.cancellation_rule_configured;
		if (/definitive_reception_date/i.test(error.message)) delete legacyUpdate.definitive_reception_date;
		if (/cancellation_requested_at/i.test(error.message)) delete legacyUpdate.cancellation_requested_at;
		if (/cancellation_confirmed_at/i.test(error.message)) delete legacyUpdate.cancellation_confirmed_at;
		if (/cancellation_notes/i.test(error.message)) delete legacyUpdate.cancellation_notes;
		const fallback = await supabase
			.from("insurance_policies")
			.update(legacyUpdate)
			.eq("id", policyId)
			.eq("tenant_id", tenantId)
			.select("*")
			.single();
		data = fallback.data;
		error = fallback.error;
	}
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	try {
		await syncInsurancePoliciesToMacroTable({
			supabase,
			tenantId,
			obraIds: [...new Set([existing.obra_id, nextObraId].filter((obraId): obraId is string => Boolean(obraId)))],
		});
	} catch (syncError) {
		console.error("Error syncing insurance policies after patch", syncError);
	}
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
		.maybeSingle<{ obra_id: string | null }>();
	if (existingError || !existing) return NextResponse.json({ error: "PÃ³liza no encontrada" }, { status: 404 });

	const { error } = await supabase
		.from("insurance_policies")
		.delete()
		.eq("id", policyId)
		.eq("tenant_id", tenantId);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	if (existing.obra_id) {
		await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [existing.obra_id] });
	}
	return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateCancellationDate } from "@/lib/insurance-policies";
import { syncInsurancePoliciesToMacroTable } from "@/lib/insurance-policies-macro";
import { getAuthContext } from "../../route";

const PolicyInputSchema = z.object({
	policyNumber: z.string().trim().min(1, "Número de póliza requerido"),
	endDate: z.string().nullable().optional(),
	cancellationRuleType: z.enum(["on_finish", "days_after", "months_after"]).default("on_finish"),
	cancellationRuleOffset: z.coerce.number().int().min(0).default(0),
	isCancelled: z.boolean().default(false),
});

type ObraPolicyState = {
	id: string;
	porcentaje: number | string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle();
	if (obraError || !obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });

	const { data, error } = await supabase
		.from("insurance_policies")
		.select("*")
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.order("policy_number", { ascending: true });

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ policies: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const parsed = PolicyInputSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
	}

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id, porcentaje")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle<ObraPolicyState>();
	if (obraError || !obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });

	const obraFinishedAt = Number(obra.porcentaje ?? 0) >= 100 ? new Date().toISOString().slice(0, 10) : null;
	const payload = {
		tenant_id: tenantId,
		obra_id: obraId,
		policy_number: parsed.data.policyNumber,
		end_date: parsed.data.endDate ?? null,
		cancellation_rule_type: parsed.data.cancellationRuleType,
		cancellation_rule_offset: parsed.data.cancellationRuleOffset,
		obra_finished_at: obraFinishedAt,
		calculated_cancellation_date: calculateCancellationDate(
			obraFinishedAt,
			parsed.data.cancellationRuleType,
			parsed.data.cancellationRuleOffset,
		),
		is_cancelled: parsed.data.isCancelled,
		cancelled_at: parsed.data.isCancelled ? new Date().toISOString() : null,
		cancelled_by: parsed.data.isCancelled ? user.id : null,
	};

	const { data, error } = await supabase
		.from("insurance_policies")
		.insert(payload)
		.select("*")
		.single();

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [obraId] });
	return NextResponse.json({ policy: data });
}

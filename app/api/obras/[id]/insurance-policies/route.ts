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

const MAX_POLICY_LIMIT = 150;

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
	const url = new URL(request.url);
	const page = parsePositiveInt(url.searchParams.get("page"), 1);
	const limit = Math.min(MAX_POLICY_LIMIT, parsePositiveInt(url.searchParams.get("limit"), 100));
	const search = url.searchParams.get("q")?.trim() ?? "";
	const status = url.searchParams.get("status") ?? "all";
	const orderBy = url.searchParams.get("orderBy") ?? "policy_number";
	const orderDir = url.searchParams.get("orderDir") === "desc" ? "desc" : "asc";
	const from = (page - 1) * limit;
	const to = from + limit - 1;
	const allowedOrderFields = new Set([
		"policy_number",
		"end_date",
		"calculated_cancellation_date",
		"status",
	]);
	const sortField = allowedOrderFields.has(orderBy) ? orderBy : "policy_number";

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle();
	if (obraError || !obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });

	let query = supabase
		.from("insurance_policies")
		.select("*", { count: "exact" })
		.eq("tenant_id", tenantId)
		.eq("obra_id", obraId)
		.order(sortField, { ascending: orderDir === "asc" })
		.range(from, to);

	if (status === "cancelled") query = query.eq("is_cancelled", true);
	if (status === "active") query = query.eq("is_cancelled", false);
	if (status === "expired") query = query.eq("is_cancelled", false).lt("calculated_cancellation_date", new Date().toISOString().slice(0, 10));
	if (status === "dueSoon") {
		const today = new Date();
		const inSixtyDays = new Date(today);
		inSixtyDays.setDate(today.getDate() + 60);
		query = query
			.eq("is_cancelled", false)
			.gte("calculated_cancellation_date", today.toISOString().slice(0, 10))
			.lte("calculated_cancellation_date", inSixtyDays.toISOString().slice(0, 10));
	}
	if (search) {
		const escaped = search.replace(/[%_]/g, "\\$&");
		query = query.or(
			[
				`policy_number.ilike.%${escaped}%`,
				`section.ilike.%${escaped}%`,
				`insured_object.ilike.%${escaped}%`,
				`risk.ilike.%${escaped}%`,
				`status.ilike.%${escaped}%`,
			].join(",")
		);
	}

	const { data, error, count } = await query;

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	const total = count ?? data?.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	return NextResponse.json({
		policies: data ?? [],
		pagination: {
			page,
			limit,
			total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		},
	});
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const rawBody = await request.json().catch(() => ({}));
	const parsed = PolicyInputSchema.safeParse(rawBody);
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
	const ruleConfigured = Object.prototype.hasOwnProperty.call(rawBody, "cancellationRuleType");
	const payload = {
		tenant_id: tenantId,
		obra_id: obraId,
		policy_number: parsed.data.policyNumber,
		end_date: parsed.data.endDate ?? null,
		cancellation_rule_type: parsed.data.cancellationRuleType,
		cancellation_rule_offset: parsed.data.cancellationRuleOffset,
		cancellation_rule_configured: ruleConfigured,
		obra_finished_at: obraFinishedAt,
		definitive_reception_date: null,
		cancellation_requested_at: null,
		cancellation_confirmed_at: null,
		cancellation_notes: null,
		calculated_cancellation_date: ruleConfigured
			? calculateCancellationDate(
				obraFinishedAt,
				parsed.data.cancellationRuleType,
				parsed.data.cancellationRuleOffset,
			)
			: null,
		is_cancelled: parsed.data.isCancelled,
		cancelled_at: parsed.data.isCancelled ? new Date().toISOString() : null,
		cancelled_by: parsed.data.isCancelled ? user.id : null,
	};

	let { data, error } = await supabase
		.from("insurance_policies")
		.insert(payload)
		.select("*")
		.single();
	if (error && /definitive_reception_date|cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
		const legacyPayload: Partial<typeof payload> = { ...payload };
		if (/definitive_reception_date/i.test(error.message)) delete legacyPayload.definitive_reception_date;
		if (/cancellation_requested_at|cancellation_confirmed_at|cancellation_notes/i.test(error.message)) {
			delete legacyPayload.cancellation_requested_at;
			delete legacyPayload.cancellation_confirmed_at;
			delete legacyPayload.cancellation_notes;
		}
		const fallback = await supabase
			.from("insurance_policies")
			.insert(legacyPayload)
			.select("*")
			.single();
		data = fallback.data;
		error = fallback.error;
	}

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [obraId] });
	return NextResponse.json({ policy: data });
}

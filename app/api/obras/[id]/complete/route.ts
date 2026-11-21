import { NextResponse } from "next/server";
import { getAuthContext } from "../../route";
import { updateInsurancePoliciesForObraCompletion } from "@/lib/insurance-policies";
import { syncInsurancePoliciesToMacroTable } from "@/lib/insurance-policies-macro";
import { canEditObras } from "@/lib/obras/permissions";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
	try {
		if (!(await canEditObras(supabase, tenantId))) {
			return NextResponse.json({ error: "No tenés permiso para editar obras." }, { status: 403 });
		}
	} catch (permissionError) {
		console.error("Obra complete: failed to validate edit permission", permissionError);
		return NextResponse.json({ error: "No se pudo validar el permiso para editar obras." }, { status: 500 });
	}
	if (!obraId || obraId === "undefined") {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id, porcentaje")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle<{ id: string; porcentaje: number | string | null }>();

	if (obraError) return NextResponse.json({ error: obraError.message }, { status: 500 });
	if (!obra) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });

	const finishedAt = new Date().toISOString().slice(0, 10);
	if (Number(obra.porcentaje ?? 0) < 100) {
		const { error: updateError } = await supabase
			.from("obras")
			.update({ porcentaje: 100 })
			.eq("id", obraId)
			.eq("tenant_id", tenantId);
		if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
	}

	await updateInsurancePoliciesForObraCompletion({
		supabase: createSupabaseAdminClient(),
		tenantId,
		obraId,
		finishedAt,
	});
	await syncInsurancePoliciesToMacroTable({ supabase, tenantId, obraIds: [obraId] });

	return NextResponse.json({ ok: true, finishedAt });
}

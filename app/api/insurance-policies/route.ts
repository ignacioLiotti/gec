import { NextResponse } from "next/server";
import { resolveRequestAccessContext } from "@/lib/demo-session";

export async function GET() {
	const access = await resolveRequestAccessContext();
	const { supabase, tenantId } = access;
	if (access.actorType === "anonymous") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!tenantId) return NextResponse.json({ policies: [] });

	const { data, error } = await supabase
		.from("insurance_policies")
		.select(`
			id,
			tenant_id,
			obra_id,
			policy_number,
			end_date,
			cancellation_rule_type,
			cancellation_rule_offset,
			obra_finished_at,
			calculated_cancellation_date,
			is_cancelled,
			cancelled_at,
			last_notified_at,
			obras!inner(id, n, designacion_y_ubicacion, porcentaje, tenant_id, deleted_at)
		`)
		.eq("tenant_id", tenantId)
		.eq("obras.tenant_id", tenantId)
		.is("obras.deleted_at", null)
		.order("policy_number", { ascending: true });

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ policies: data ?? [] });
}


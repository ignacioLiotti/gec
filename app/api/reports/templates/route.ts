import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/app/api/obras/route";

export async function GET(request: NextRequest) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user || !tenantId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const reportKey = request.nextUrl.searchParams.get("reportKey");
	if (!reportKey) {
		return NextResponse.json({ error: "reportKey is required" }, { status: 400 });
	}
	const { data, error } = await supabase
		.from("report_templates")
		.select("*")
		.eq("tenant_id", tenantId)
		.eq("report_key", reportKey)
		.order("updated_at", { ascending: false });
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user || !tenantId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const body = await request.json().catch(() => ({}));
	const { reportKey, name, description, payload, isSystem } = body ?? {};
	if (!reportKey || !name) {
		return NextResponse.json({ error: "reportKey and name are required" }, { status: 400 });
	}
	const { data, error } = await supabase
		.from("report_templates")
		.insert({
			tenant_id: tenantId,
			report_key: reportKey,
			name,
			description: description ?? null,
			payload: payload ?? {},
			is_system: Boolean(isSystem),
		})
		.select("*")
		.maybeSingle();
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ template: data });
}

export async function DELETE(request: NextRequest) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user || !tenantId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const id = request.nextUrl.searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id is required" }, { status: 400 });
	}
	const { error } = await supabase
		.from("report_templates")
		.delete()
		.eq("id", id)
		.eq("tenant_id", tenantId);
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ ok: true });
}

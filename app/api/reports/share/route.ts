import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/app/api/obras/route";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

function buildToken() {
	return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user || !tenantId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const body = await request.json().catch(() => ({}));
	const { reportKey, presetId, payload, expiresAt } = body ?? {};
	if (!reportKey || !payload) {
		return NextResponse.json({ error: "reportKey and payload are required" }, { status: 400 });
	}
	const token = buildToken();
	const { data, error } = await supabase
		.from("report_share_links")
		.insert({
			tenant_id: tenantId,
			report_key: reportKey,
			preset_id: presetId ?? null,
			token,
			payload,
			expires_at: expiresAt ?? null,
			created_by: user.id,
		})
		.select("*")
		.maybeSingle();
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ share: data, url: `/r/${token}` });
}

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token");
	if (!token) {
		return NextResponse.json({ error: "token is required" }, { status: 400 });
	}
	const admin = createSupabaseAdminClient();
	const { data, error } = await admin
		.from("report_share_links")
		.select("*")
		.eq("token", token)
		.maybeSingle();
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	if (!data) {
		return NextResponse.json({ error: "Share link not found" }, { status: 404 });
	}
	if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
		return NextResponse.json({ error: "Share link expired" }, { status: 410 });
	}
	return NextResponse.json({ share: data });
}

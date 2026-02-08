import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const obraId = searchParams.get("obraId");
	const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
	const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;

	if (!obraId) {
		return NextResponse.json(
			{ error: "obraId is required" },
			{ status: 400 },
		);
	}

	try {
		const { data, error } = await supabase
			.from("flow_event")
			.select("type, payload_json, dedupe_key, run_id, created_at")
			.eq("obra_id", obraId)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (error) throw error;

		return NextResponse.json({ events: data ?? [] });
	} catch (error: any) {
		console.error("[api/flows/events]", error);
		return NextResponse.json(
			{ error: error?.message ?? "Failed to load events" },
			{ status: 500 },
		);
	}
}

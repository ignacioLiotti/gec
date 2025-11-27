import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

function isAuthorized(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return process.env.NODE_ENV !== "production";
	}
	const header = request.headers.get("x-cron-secret");
	return header === secret;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const admin = createSupabaseAdminClient();
	const { data, error } = await admin.rpc("cleanup_orphan_records");

	if (error) {
		return NextResponse.json(
			{ error: "Failed to cleanup orphans", detail: error.message },
			{ status: 500 }
		);
	}

	return NextResponse.json({
		ok: true,
		results: data ?? [],
	});
}

export async function GET(request: Request) {
	return POST(request);
}

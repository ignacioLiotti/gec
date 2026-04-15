import { NextResponse } from "next/server";

import { resolveRequestAccessContext } from "@/lib/demo-session";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

function normalizeTenantMarker(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

export async function GET() {
	try {
		const access = await resolveRequestAccessContext();
		if (!access.tenantId) {
			return NextResponse.json(
				{ error: "No active tenant" },
				{ status: 403 },
			);
		}

		const admin = createSupabaseAdminClient();
		const { data: tenantRecord, error } = await admin
			.from("tenants")
			.select("name, demo_slug")
			.eq("id", access.tenantId)
			.maybeSingle();

		if (error) {
			console.error("[tenant-marker] failed to load tenant", {
				tenantId: access.tenantId,
				error,
			});
			return NextResponse.json(
				{ error: "Failed to resolve tenant marker" },
				{ status: 500 },
			);
		}

		const tenantName = normalizeTenantMarker(
			typeof tenantRecord?.name === "string"
				? tenantRecord.name
				: (access.tenantName ?? ""),
		);
		const tenantDemoSlug = normalizeTenantMarker(
			typeof tenantRecord?.demo_slug === "string"
				? tenantRecord.demo_slug
				: "",
		);
		const isIlagDemoTenant =
			tenantName.includes("ilag demo") || tenantDemoSlug.includes("ilag-demo");

		return NextResponse.json({
			tenantId: access.tenantId,
			actorType: access.actorType,
			isIlagDemoTenant,
		});
	} catch (error) {
		console.error("[tenant-marker] unexpected error", error);
		return NextResponse.json(
			{ error: "Failed to resolve tenant marker" },
			{ status: 500 },
		);
	}
}

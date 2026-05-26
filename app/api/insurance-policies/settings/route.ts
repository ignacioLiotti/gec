import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "../../obras/route";

const SettingsSchema = z.object({
	responsibleUserId: z.string().uuid().nullable(),
});

export async function GET() {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const { data, error } = await supabase
		.from("insurance_policy_settings")
		.select("responsible_user_id")
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ responsibleUserId: data?.responsible_user_id ?? null });
}

export async function PUT(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const parsed = SettingsSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
	}

	if (parsed.data.responsibleUserId) {
		const { data: member, error: memberError } = await supabase
			.from("memberships")
			.select("user_id")
			.eq("tenant_id", tenantId)
			.eq("user_id", parsed.data.responsibleUserId)
			.maybeSingle();
		if (memberError || !member) {
			return NextResponse.json({ error: "El responsable no pertenece a la organización" }, { status: 400 });
		}
	}

	const { data, error } = await supabase
		.from("insurance_policy_settings")
		.upsert({
			tenant_id: tenantId,
			responsible_user_id: parsed.data.responsibleUserId,
			updated_at: new Date().toISOString(),
		}, { onConflict: "tenant_id" })
		.select("responsible_user_id")
		.single();
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ responsibleUserId: data.responsible_user_id ?? null });
}


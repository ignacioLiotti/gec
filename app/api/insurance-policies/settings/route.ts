import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "../../obras/route";

const SettingsSchema = z.object({
	responsibleUserId: z.string().uuid().nullable().optional(),
	responsibleUserIds: z.array(z.string().uuid()).optional(),
});

function isMissingResponsibleUserIdsColumn(error: unknown) {
	const message = String((error as { message?: string })?.message ?? "").toLowerCase();
	const code = String((error as { code?: string })?.code ?? "");
	return code === "42703" || message.includes("responsible_user_ids");
}

function uniqueUserIds(ids: string[]) {
	return [...new Set(ids)];
}

export async function GET() {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const { data, error } = await supabase
		.from("insurance_policy_settings")
		.select("responsible_user_id, responsible_user_ids")
		.eq("tenant_id", tenantId)
		.maybeSingle();
	if (error && isMissingResponsibleUserIdsColumn(error)) {
		const { data: legacyData, error: legacyError } = await supabase
			.from("insurance_policy_settings")
			.select("responsible_user_id")
			.eq("tenant_id", tenantId)
			.maybeSingle();
		if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 500 });
		return NextResponse.json({
			responsibleUserId: legacyData?.responsible_user_id ?? null,
			responsibleUserIds: legacyData?.responsible_user_id ? [legacyData.responsible_user_id] : [],
		});
	}
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	const responsibleUserIds = Array.isArray(data?.responsible_user_ids)
		? (data.responsible_user_ids as string[])
		: data?.responsible_user_id
			? [data.responsible_user_id as string]
			: [];

	return NextResponse.json({
		responsibleUserId: data?.responsible_user_id ?? null,
		responsibleUserIds,
	});
}

export async function PUT(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

	const parsed = SettingsSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return NextResponse.json({ error: "Datos invalidos", details: parsed.error.flatten() }, { status: 400 });
	}

	const responsibleUserIds = uniqueUserIds(
		parsed.data.responsibleUserIds ??
		(parsed.data.responsibleUserId ? [parsed.data.responsibleUserId] : []),
	);

	if (responsibleUserIds.length > 0) {
		const { data: members, error: memberError } = await supabase
			.from("memberships")
			.select("user_id")
			.eq("tenant_id", tenantId)
			.in("user_id", responsibleUserIds);
		const memberIds = new Set((members ?? []).map((member) => member.user_id as string));
		if (memberError || responsibleUserIds.some((userId) => !memberIds.has(userId))) {
			return NextResponse.json(
				{ error: "Uno o mas responsables no pertenecen a la organizacion" },
				{ status: 400 },
			);
		}
	}

	const { data, error } = await supabase
		.from("insurance_policy_settings")
		.upsert({
			tenant_id: tenantId,
			responsible_user_id: responsibleUserIds[0] ?? null,
			responsible_user_ids: responsibleUserIds,
			updated_at: new Date().toISOString(),
		}, { onConflict: "tenant_id" })
		.select("responsible_user_id, responsible_user_ids")
		.single();
	if (error && isMissingResponsibleUserIdsColumn(error)) {
		const { data: legacyData, error: legacyError } = await supabase
			.from("insurance_policy_settings")
			.upsert({
				tenant_id: tenantId,
				responsible_user_id: responsibleUserIds[0] ?? null,
				updated_at: new Date().toISOString(),
			}, { onConflict: "tenant_id" })
			.select("responsible_user_id")
			.single();
		if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 500 });
		return NextResponse.json({
			responsibleUserId: legacyData.responsible_user_id ?? null,
			responsibleUserIds: legacyData.responsible_user_id ? [legacyData.responsible_user_id] : [],
			needsMigration: true,
		});
	}
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	return NextResponse.json({
		responsibleUserId: data.responsible_user_id ?? null,
		responsibleUserIds: Array.isArray(data.responsible_user_ids) ? data.responsible_user_ids : [],
	});
}

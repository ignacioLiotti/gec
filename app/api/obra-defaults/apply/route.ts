import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/app/api/obras/route";
import { provisionObraDefaults } from "@/lib/obra-defaults/provision";

const payloadSchema = z.object({
	obraId: z.string().uuid(),
});

/**
 * Backward-compatible single-obra endpoint. All callers now share the same
 * idempotent, tracked materializer used by first-obra and bulk creation.
 */
export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();
	if (!user) {
		return NextResponse.json({ error: "No autorizado" }, { status: 401 });
	}
	if (!tenantId) {
		return NextResponse.json(
			{ error: "No se encontró una organización activa" },
			{ status: 400 },
		);
	}

	const parsed = payloadSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Revisá la obra elegida" },
			{ status: 400 },
		);
	}

	const { data: obra, error: obraError } = await supabase
		.from("obras")
		.select("id")
		.eq("id", parsed.data.obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle();
	if (obraError || !obra) {
		return NextResponse.json(
			{ error: "No encontramos la obra en la organización activa" },
			{ status: 404 },
		);
	}

	const result = await provisionObraDefaults(
		supabase,
		parsed.data.obraId,
		tenantId,
	);
	return NextResponse.json(
		{
			ok: result.success,
			applied: {
				folders: result.foldersApplied,
				tablas: result.tablasApplied,
			},
			error: result.error ?? null,
		},
		{ status: result.success ? 200 : 207 },
	);
}

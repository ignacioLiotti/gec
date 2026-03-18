import { NextResponse } from "next/server";
import { z } from "zod";
import { applyObraDefaults } from "@/lib/obra-defaults";
import { getAuthContext } from "../route";

const payloadSchema = z.object({
	obraIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No se encontro una organizacion para el usuario" },
			{ status: 400 }
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
	}

	const parsed = payloadSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Datos invalidos", details: parsed.error.flatten() },
			{ status: 400 }
		);
	}

	const obraIds = [...new Set(parsed.data.obraIds)];
	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id, n, designacion_y_ubicacion")
		.eq("tenant_id", tenantId)
		.in("id", obraIds);

	if (obrasError) {
		console.error("[obras:backfill-defaults] failed to load obras", obrasError);
		return NextResponse.json(
			{ error: "No se pudieron cargar las obras" },
			{ status: 500 }
		);
	}

	const obraById = new Map((obras ?? []).map((obra) => [obra.id as string, obra]));
	const results: Array<{
		obraId: string;
		n: number | null;
		name: string | null;
		ok: boolean;
		foldersApplied: number;
		tablasApplied: number;
		error?: string;
	}> = [];

	for (const obraId of obraIds) {
		const obra = obraById.get(obraId);
		if (!obra) {
			results.push({
				obraId,
				n: null,
				name: null,
				ok: false,
				foldersApplied: 0,
				tablasApplied: 0,
				error: "Obra no encontrada en el tenant activo",
			});
			continue;
		}

		try {
			const result = await applyObraDefaults(supabase, obraId, tenantId);
			results.push({
				obraId,
				n: typeof obra.n === "number" ? obra.n : Number(obra.n) || null,
				name:
					typeof obra.designacion_y_ubicacion === "string"
						? obra.designacion_y_ubicacion
						: null,
				ok: result.success,
				foldersApplied: result.foldersApplied,
				tablasApplied: result.tablasApplied,
				error: result.error,
			});
		} catch (error) {
			console.error("[obras:backfill-defaults] failed to apply defaults", {
				obraId,
				error,
			});
			results.push({
				obraId,
				n: typeof obra.n === "number" ? obra.n : Number(obra.n) || null,
				name:
					typeof obra.designacion_y_ubicacion === "string"
						? obra.designacion_y_ubicacion
						: null,
				ok: false,
				foldersApplied: 0,
				tablasApplied: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return NextResponse.json({
		ok: results.every((result) => result.ok),
		results,
	});
}

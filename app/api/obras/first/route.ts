import { NextResponse } from "next/server";
import { z } from "zod";

import { provisionObraDefaults } from "@/lib/obra-defaults/provision";
import {
	getAuthContext,
	loadTenantMainTableCustomColumnIds,
	sanitizeCustomData,
} from "../route";

const firstObraSchema = z.object({
	designacionYUbicacion: z.string().trim().min(3).max(240),
	entidadContratante: z.string().trim().min(2).max(240),
	mesBasicoDeContrato: z.string().regex(/^\d{4}-\d{2}-01$/),
	iniciacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	supDeObraM2: z.number().finite().nonnegative(),
	contratoMasAmpliaciones: z.number().finite().nonnegative(),
	segunContrato: z.number().finite().int().nonnegative(),
	especialidad: z.string().trim().max(120).optional(),
});

const MAX_NUMBER_ALLOCATION_ATTEMPTS = 4;

export async function POST(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "No autorizado" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No se encontró una organización para el usuario" },
			{ status: 400 },
		);
	}

	const { data: canCreateFirstObra, error: permissionError } = await supabase.rpc(
		"has_permission",
		{
			tenant: tenantId,
			perm_key: "admin:obra-defaults",
		},
	);
	if (permissionError) {
		console.error("First obra: permission check failed", permissionError);
		return NextResponse.json(
			{ error: "No pudimos verificar tus permisos" },
			{ status: 500 },
		);
	}
	if (canCreateFirstObra !== true) {
		return NextResponse.json(
			{ error: "Necesitás ayuda de una persona administradora para crear la primera obra" },
			{ status: 403 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
	}

	const parsed = firstObraSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Revisá los datos de la obra", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const input = parsed.data;
	const allowedCustomColumnIds = await loadTenantMainTableCustomColumnIds(
		supabase,
		tenantId,
	);
	const customData = sanitizeCustomData(
		input.especialidad ? { especialidad: input.especialidad } : {},
		allowedCustomColumnIds,
	);

	let createdObra: { id: string; n: number } | null = null;

	for (let attempt = 0; attempt < MAX_NUMBER_ALLOCATION_ATTEMPTS; attempt += 1) {
		const { count: activeObraCount, error: activeCountError } = await supabase
			.from("obras")
			.select("id", { count: "exact", head: true })
			.eq("tenant_id", tenantId)
			.is("deleted_at", null);
		if (activeCountError) {
			console.error("First obra: failed to validate active obras", activeCountError);
			return NextResponse.json(
				{ error: "No pudimos verificar las obras existentes" },
				{ status: 500 },
			);
		}
		if ((activeObraCount ?? 0) > 0) {
			return NextResponse.json(
				{ error: "La organización ya tiene una obra. Actualizá la puesta en marcha." },
				{ status: 409 },
			);
		}

		const { data: highestRows, error: highestError } = await supabase
			.from("obras")
			.select("n")
			.eq("tenant_id", tenantId)
			.order("n", { ascending: false })
			.limit(1);

		if (highestError) {
			console.error("First obra: failed to allocate obra number", highestError);
			return NextResponse.json(
				{ error: "No pudimos preparar el número de la obra" },
				{ status: 500 },
			);
		}

		const highest = Number(highestRows?.[0]?.n ?? 0);
		const nextNumber = Number.isFinite(highest) ? highest + 1 : 1;
		const { data, error } = await supabase
			.from("obras")
			.insert({
				tenant_id: tenantId,
				n: nextNumber,
				designacion_y_ubicacion: input.designacionYUbicacion,
				sup_de_obra_m2: input.supDeObraM2,
				entidad_contratante: input.entidadContratante,
				mes_basico_de_contrato: input.mesBasicoDeContrato,
				iniciacion: input.iniciacion,
				contrato_mas_ampliaciones: input.contratoMasAmpliaciones,
				certificado_a_la_fecha: 0,
				saldo_a_certificar: input.contratoMasAmpliaciones,
				segun_contrato: input.segunContrato,
				prorrogas_acordadas: 0,
				plazo_total: input.segunContrato,
				plazo_transc: 0,
				porcentaje: 0,
				custom_data: customData,
				deleted_at: null,
				deleted_by: null,
			})
			.select("id, n")
			.single();

		if (!error && data) {
			createdObra = { id: data.id as string, n: Number(data.n) };
			break;
		}

		if (error?.code === "23505") {
			continue;
		}

		console.error("First obra: insert failed", error);
		return NextResponse.json(
			{ error: "No pudimos crear la obra" },
			{ status: 500 },
		);
	}

	if (!createdObra) {
		return NextResponse.json(
			{ error: "Otra persona creó una obra al mismo tiempo. Volvé a intentarlo." },
			{ status: 409 },
		);
	}

	const defaults = await provisionObraDefaults(supabase, createdObra.id, tenantId);

	return NextResponse.json(
		{
			ok: true,
			obra: createdObra,
			provisioning: {
				status: defaults.success ? "ready" : "partial",
				foldersApplied: defaults.foldersApplied,
				tablasApplied: defaults.tablasApplied,
				error: defaults.error ?? null,
			},
		},
		{ status: 201 },
	);
}

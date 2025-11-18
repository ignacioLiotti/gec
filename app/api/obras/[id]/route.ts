import { NextResponse } from "next/server";
import { obraSchema } from "@/app/excel/schema";
import { emitEvent } from "@/lib/notifications/engine";
import {
	BASE_COLUMNS,
	CONFIG_COLUMNS,
	DbObraRow,
	getAuthContext,
	mapDbRowToObra,
	executeFlujoActions,
} from "../route";

type RouteContext = {
	params: Promise<{
		id: string;
	}>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;

	if (!obraId || obraId === "undefined") {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant" }, { status: 400 });
	}

	let { data, error } = await supabase
		.from("obras")
		.select(CONFIG_COLUMNS)
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.maybeSingle<DbObraRow>();

	if (error && error.code === "42703") {
		console.warn(
			"Obra GET: on_finish_* columns missing, falling back to base columns"
		);
		const fallback = await supabase
			.from("obras")
			.select(BASE_COLUMNS)
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.maybeSingle<DbObraRow>();
		data = fallback.data;
		error = fallback.error;
	}

	if (error) {
		console.error("Error fetching obra", error);
		return NextResponse.json(
			{ error: "No se pudo obtener la obra" },
			{ status: 500 }
		);
	}

	if (!data) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	return NextResponse.json({ obra: mapDbRowToObra(data) });
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: obraId } = await params;

	if (!obraId || obraId === "undefined") {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant" }, { status: 400 });
	}

	// Fetch existing porcentaje to detect newly completed state (crossing <100 → 100)
	const { data: existingRow, error: existingError } = await supabase
		.from("obras")
		.select("porcentaje, designacion_y_ubicacion")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.maybeSingle();

	if (existingError) {
		console.error(
			"Obra [id] PUT: failed to fetch existing obra",
			existingError
		);
	}

	const prevPorcentaje = existingRow
		? Number((existingRow as any).porcentaje ?? 0)
		: 0;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
	}

	const payload =
		typeof body === "object" && body !== null
			? (body as Record<string, unknown>)
			: ({} as Record<string, unknown>);

	const parsingResult = obraSchema.safeParse({
		...payload,
		id: obraId,
	});

	if (!parsingResult.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsingResult.error.flatten() },
			{ status: 400 }
		);
	}

	const obra = parsingResult.data;

	const fullUpdate = {
		n: obra.n,
		designacion_y_ubicacion: obra.designacionYUbicacion,
		sup_de_obra_m2: obra.supDeObraM2,
		entidad_contratante: obra.entidadContratante,
		mes_basico_de_contrato: obra.mesBasicoDeContrato,
		iniciacion: obra.iniciacion,
		contrato_mas_ampliaciones: obra.contratoMasAmpliaciones,
		certificado_a_la_fecha: obra.certificadoALaFecha,
		saldo_a_certificar: obra.saldoACertificar,
		segun_contrato: obra.segunContrato,
		prorrogas_acordadas: obra.prorrogasAcordadas,
		plazo_total: obra.plazoTotal,
		plazo_transc: obra.plazoTransc,
		porcentaje: obra.porcentaje,
		on_finish_first_message: obra.onFinishFirstMessage ?? null,
		on_finish_second_message: obra.onFinishSecondMessage ?? null,
		on_finish_second_send_at: obra.onFinishSecondSendAt ?? null,
	};

	let { error: updateError } = await supabase
		.from("obras")
		.update(fullUpdate)
		.eq("id", obraId)
		.eq("tenant_id", tenantId);

	if (updateError && updateError.code === "42703") {
		console.warn(
			"Obra PUT: on_finish_* columns missing, updating without finish config"
		);
		const fallbackUpdate: Record<string, unknown> = { ...fullUpdate };
		delete fallbackUpdate.on_finish_first_message;
		delete fallbackUpdate.on_finish_second_message;
		delete fallbackUpdate.on_finish_second_send_at;

		const fallback = await supabase
			.from("obras")
			.update(fallbackUpdate)
			.eq("id", obraId)
			.eq("tenant_id", tenantId);

		updateError = fallback.error;
	}

	if (updateError) {
		console.error("Error updating obra", updateError);
		return NextResponse.json(
			{ error: "No se pudo actualizar la obra" },
			{ status: 500 }
		);
	}

	// Detect newly completed obra (transition <100 → 100) and trigger the same
	// completion side-effects as the bulk /api/obras route.
	const newPorcentaje = obra.porcentaje;
	const becameCompleted = prevPorcentaje < 100 && newPorcentaje >= 100;
	const becameIncomplete = prevPorcentaje >= 100 && newPorcentaje < 100;

	if (becameCompleted) {
		try {
			// Fetch full row to build event context
			let { data: completedRow, error: completedError } = await supabase
				.from("obras")
				.select(CONFIG_COLUMNS)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.maybeSingle<DbObraRow>();

			if (completedError && completedError.code === "42703") {
				console.warn(
					"Obra [id] PUT: on_finish_* columns missing when fetching completed obra, falling back"
				);
				const fallback = await supabase
					.from("obras")
					.select(BASE_COLUMNS)
					.eq("id", obraId)
					.eq("tenant_id", tenantId)
					.maybeSingle<DbObraRow>();
				completedRow = fallback.data;
				completedError = fallback.error;
			}

			if (completedError) {
				console.error(
					"Obra [id] PUT: failed to fetch completed obra data",
					completedError
				);
			} else if (completedRow) {
				const ctx = {
					tenantId,
					actorId: user.id,
					obra: {
						id: completedRow.id,
						name:
							(completedRow as any).designacion_y_ubicacion ??
							obra.designacionYUbicacion,
						percentage: Number(
							(completedRow as any).porcentaje ?? newPorcentaje
						),
					},
					followUpAt: (completedRow as any).on_finish_second_send_at ?? null,
				} as const;

				console.info("OBRA TERMINADA ([id] PUT)", {
					obraId,
					name: ctx.obra.name,
					percentage: ctx.obra.percentage,
				});

				try {
					await emitEvent("obra.completed", ctx);
					console.info("Obras [id] PUT: event obra.completed emitted", {
						obraId,
					});
				} catch (workflowError) {
					console.error("Obras [id] PUT: failed to emit obra.completed", {
						error: workflowError,
						obraId,
					});
				}

				try {
					await executeFlujoActions(supabase, obraId, user.id, tenantId);
				} catch (flujoError) {
					console.error(
						"Obras [id] PUT: error while executing flujo actions",
						flujoError
					);
				}
			}
		} catch (completionError) {
			console.error(
				"Obras [id] PUT: unexpected error handling completion side-effects",
				completionError
			);
		}
	}

	if (becameIncomplete) {
		try {
			// Remove any calendar events created for this obra by flujo actions
			const { error: delErr } = await supabase
				.from("calendar_events")
				.delete()
				.eq("obra_id", obraId);
			if (delErr) {
				console.error(
					"Obras [id] PUT: failed to delete calendar_events for reverted obra",
					{ obraId, error: delErr }
				);
			} else {
				console.info(
					"Obras [id] PUT: deleted calendar_events for reverted obra",
					{ obraId }
				);
			}
		} catch (revertError) {
			console.error(
				"Obras [id] PUT: unexpected error while cleaning up calendar_events",
				revertError
			);
		}
	}

	return NextResponse.json({ ok: true });
}

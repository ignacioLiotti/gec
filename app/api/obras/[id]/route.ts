import { NextResponse } from "next/server";
import { obraSchema } from "@/app/excel/schema";
import { z } from "zod";
import { emitEvent } from "@/lib/notifications/engine";
import {
	BASE_COLUMNS,
	CONFIG_COLUMNS,
	DbObraRow,
	LEGACY_BASE_COLUMNS,
	getAuthContext,
	loadTenantMainTableCustomColumnIds,
	mapDbRowToObra,
	sanitizeCustomData,
	executeFlujoActions,
} from "../route";
import { softDeleteObraWithDocuments } from "@/lib/obras/delete-lifecycle";
import {
	hasAnyDemoCapability,
	resolveRequestAccessContext,
} from "@/lib/demo-session";

type RouteContext = {
	params: Promise<{
		id: string;
	}>;
};

type AuthSupabase = Awaited<ReturnType<typeof getAuthContext>>["supabase"];
type ObraStatusRecord = {
	porcentaje?: number | string | null;
	designacion_y_ubicacion?: string | null;
};
type ObraCompletionRecord = ObraStatusRecord & {
	id: string;
	on_finish_second_send_at?: string | null;
};

const obraPatchSchema = obraSchema.omit({ id: true }).partial();

function buildObraUpdatePayload(
	obra: Partial<z.infer<typeof obraPatchSchema>>,
	allowedCustomColumnIds: Set<string> | null
) {
	const update: Record<string, unknown> = {};

	if (typeof obra.n !== "undefined") update.n = obra.n;
	if (typeof obra.designacionYUbicacion !== "undefined") {
		update.designacion_y_ubicacion = obra.designacionYUbicacion;
	}
	if (typeof obra.supDeObraM2 !== "undefined") update.sup_de_obra_m2 = obra.supDeObraM2;
	if (typeof obra.entidadContratante !== "undefined") {
		update.entidad_contratante = obra.entidadContratante;
	}
	if (typeof obra.mesBasicoDeContrato !== "undefined") {
		update.mes_basico_de_contrato = obra.mesBasicoDeContrato;
	}
	if (typeof obra.iniciacion !== "undefined") update.iniciacion = obra.iniciacion;
	if (typeof obra.contratoMasAmpliaciones !== "undefined") {
		update.contrato_mas_ampliaciones = obra.contratoMasAmpliaciones;
	}
	if (typeof obra.certificadoALaFecha !== "undefined") {
		update.certificado_a_la_fecha = obra.certificadoALaFecha;
	}
	if (typeof obra.saldoACertificar !== "undefined") {
		update.saldo_a_certificar = obra.saldoACertificar;
	}
	if (typeof obra.segunContrato !== "undefined") update.segun_contrato = obra.segunContrato;
	if (typeof obra.prorrogasAcordadas !== "undefined") {
		update.prorrogas_acordadas = obra.prorrogasAcordadas;
	}
	if (typeof obra.plazoTotal !== "undefined") update.plazo_total = obra.plazoTotal;
	if (typeof obra.plazoTransc !== "undefined") update.plazo_transc = obra.plazoTransc;
	if (typeof obra.porcentaje !== "undefined") update.porcentaje = obra.porcentaje;
	if (typeof obra.customData !== "undefined") {
		update.custom_data = sanitizeCustomData(obra.customData, allowedCustomColumnIds);
	}
	if (typeof obra.onFinishFirstMessage !== "undefined") {
		update.on_finish_first_message = obra.onFinishFirstMessage ?? null;
	}
	if (typeof obra.onFinishSecondMessage !== "undefined") {
		update.on_finish_second_message = obra.onFinishSecondMessage ?? null;
	}
	if (typeof obra.onFinishSecondSendAt !== "undefined") {
		update.on_finish_second_send_at = obra.onFinishSecondSendAt ?? null;
	}

	return update;
}

async function handleObraCompletionTransitions({
	supabase,
	obraId,
	tenantId,
	userId,
	prevPorcentaje,
	committedPorcentaje,
	obraDesignacionFallback,
}: {
	supabase: AuthSupabase;
	obraId: string;
	tenantId: string;
	userId: string;
	prevPorcentaje: number;
	committedPorcentaje: number;
	obraDesignacionFallback: string;
}) {
	const becameCompleted = prevPorcentaje < 100 && committedPorcentaje >= 100;
	const becameIncomplete = prevPorcentaje >= 100 && committedPorcentaje < 100;

	if (becameCompleted) {
		try {
			let { data: completedRow, error: completedError } = await supabase
				.from("obras")
				.select(CONFIG_COLUMNS)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.maybeSingle<ObraCompletionRecord>();

			if (completedError && completedError.code === "42703") {
				console.warn(
					"Obra [id] PUT: modern columns missing when fetching completed obra, falling back"
				);
				const fallback = await supabase
					.from("obras")
					.select(BASE_COLUMNS)
					.eq("id", obraId)
					.eq("tenant_id", tenantId)
					.is("deleted_at", null)
					.maybeSingle();
				completedRow = fallback.data;
				completedError = fallback.error;
				if (completedError && completedError.code === "42703") {
					const legacy = await supabase
						.from("obras")
						.select(LEGACY_BASE_COLUMNS)
						.eq("id", obraId)
						.eq("tenant_id", tenantId)
						.is("deleted_at", null)
						.maybeSingle();
					completedRow = legacy.data;
					completedError = legacy.error;
				}
			}

			if (completedError) {
				console.error(
					"Obra [id] PUT: failed to fetch completed obra data",
					completedError
				);
			} else if (completedRow) {
				const ctx = {
					tenantId,
					actorId: userId,
					obra: {
						id: completedRow.id,
						name: completedRow.designacion_y_ubicacion ?? obraDesignacionFallback,
						percentage: Number(completedRow.porcentaje ?? committedPorcentaje),
					},
					followUpAt: completedRow.on_finish_second_send_at ?? null,
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
					await executeFlujoActions(supabase, obraId, userId, tenantId);
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

			const { error: execDelErr } = await supabase
				.from("obra_flujo_executions")
				.delete()
				.eq("obra_id", obraId)
				.eq("status", "pending");
			if (execDelErr) {
				console.error(
					"Obras [id] PUT: failed to delete pending flujo executions for reverted obra",
					{ obraId, error: execDelErr }
				);
			} else {
				console.info(
					"Obras [id] PUT: deleted pending flujo executions for reverted obra",
					{ obraId }
				);
			}
		} catch (revertError) {
			console.error(
				"Obras [id] PUT: unexpected error while cleaning up calendar_events/executions",
				revertError
			);
		}
	}
}

export async function GET(_request: Request, context: RouteContext) {
	const { id: obraId } = await context.params;

	if (!obraId || obraId === "undefined") {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	const access = await resolveRequestAccessContext();
	const { supabase, user, tenantId, actorType } = access;
	const { demoSession } = access;

	if (!user && actorType !== "demo") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (
		actorType === "demo" &&
		!hasAnyDemoCapability(demoSession, ["dashboard", "excel"])
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant" }, { status: 400 });
	}

	let { data, error } = await supabase
		.from("obras")
		.select(CONFIG_COLUMNS)
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle<DbObraRow>();

	if (error && error.code === "42703") {
		console.warn(
			"Obra GET: modern columns missing, falling back"
		);
		const fallback = await supabase
			.from("obras")
			.select(BASE_COLUMNS)
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.is("deleted_at", null)
			.maybeSingle<DbObraRow>();
		data = fallback.data;
		error = fallback.error;
		if (error && error.code === "42703") {
			const legacy = await supabase
				.from("obras")
				.select(LEGACY_BASE_COLUMNS)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.is("deleted_at", null)
				.maybeSingle<DbObraRow>();
			data = legacy.data;
			error = legacy.error;
		}
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

	// Fetch existing porcentaje atomically with update using single query
	// Note: We still need to fetch first because Supabase's RETURNING only gives us NEW values
	// To properly eliminate race conditions, consider using a database trigger
	const { data: existingRow, error: existingError } = await supabase
		.from("obras")
		.select("porcentaje, designacion_y_ubicacion")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle<ObraStatusRecord>();

	if (existingError) {
		console.error(
			"Obra [id] PUT: failed to fetch existing obra",
			existingError
		);
	}

	const prevPorcentaje = existingRow
		? Number(existingRow.porcentaje ?? 0)
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

	const allowedCustomColumnIds = await loadTenantMainTableCustomColumnIds(
		supabase,
		tenantId
	);

	const fullUpdate = buildObraUpdatePayload(obra, allowedCustomColumnIds);

	// Use .select() to get RETURNING data for the actual committed value
	let updateResult = await supabase
		.from("obras")
		.update(fullUpdate)
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.select("porcentaje")
		.maybeSingle<ObraStatusRecord>();

	let updateError = updateResult.error;

	if (updateError && updateError.code === "42703") {
		console.warn(
			"Obra PUT: modern columns missing, retrying with reduced payload"
		);
		const fallbackUpdate: Record<string, unknown> = { ...fullUpdate };
		delete fallbackUpdate.on_finish_first_message;
		delete fallbackUpdate.on_finish_second_message;
		delete fallbackUpdate.on_finish_second_send_at;

		updateResult = await supabase
			.from("obras")
			.update(fallbackUpdate)
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.select("porcentaje")
			.maybeSingle();

		updateError = updateResult.error;
		if (updateError && updateError.code === "42703") {
			const legacyUpdate: Record<string, unknown> = { ...fallbackUpdate };
			delete legacyUpdate.custom_data;
			updateResult = await supabase
				.from("obras")
				.update(legacyUpdate)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.select("porcentaje")
				.maybeSingle();
			updateError = updateResult.error;
		}
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
	// Use the actual committed porcentaje from RETURNING to reduce race conditions
	const committedPorcentaje = updateResult.data
		? Number(updateResult.data.porcentaje ?? obra.porcentaje)
		: obra.porcentaje;
	await handleObraCompletionTransitions({
		supabase,
		obraId,
		tenantId,
		userId: user.id,
		prevPorcentaje,
		committedPorcentaje,
		obraDesignacionFallback: obra.designacionYUbicacion,
	});

	return NextResponse.json({ ok: true });
}

export async function PATCH(
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

	const { data: existingRow, error: existingError } = await supabase
		.from("obras")
		.select("porcentaje, designacion_y_ubicacion")
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.is("deleted_at", null)
		.maybeSingle<ObraStatusRecord>();

	if (existingError) {
		console.error(
			"Obra [id] PATCH: failed to fetch existing obra",
			existingError
		);
		return NextResponse.json(
			{ error: "No se pudo verificar la obra" },
			{ status: 500 }
		);
	}

	if (!existingRow) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	const prevPorcentaje = existingRow
		? Number(existingRow.porcentaje ?? 0)
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

	const parsingResult = obraPatchSchema.safeParse(payload);
	if (!parsingResult.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsingResult.error.flatten() },
			{ status: 400 }
		);
	}

	const obraPatch = parsingResult.data;
	if (Object.keys(obraPatch).length === 0) {
		return NextResponse.json({ ok: true });
	}

	const allowedCustomColumnIds = await loadTenantMainTableCustomColumnIds(
		supabase,
		tenantId
	);
	const partialUpdate = buildObraUpdatePayload(obraPatch, allowedCustomColumnIds);

	let updateResult = await supabase
		.from("obras")
		.update(partialUpdate)
		.eq("id", obraId)
		.eq("tenant_id", tenantId)
		.select("porcentaje")
		.maybeSingle<ObraStatusRecord>();

	let updateError = updateResult.error;

	if (updateError && updateError.code === "42703") {
		console.warn(
			"Obra PATCH: modern columns missing, retrying with reduced payload"
		);
		const fallbackUpdate: Record<string, unknown> = { ...partialUpdate };
		delete fallbackUpdate.on_finish_first_message;
		delete fallbackUpdate.on_finish_second_message;
		delete fallbackUpdate.on_finish_second_send_at;

		updateResult = await supabase
			.from("obras")
			.update(fallbackUpdate)
			.eq("id", obraId)
			.eq("tenant_id", tenantId)
			.select("porcentaje")
			.maybeSingle();

		updateError = updateResult.error;
		if (updateError && updateError.code === "42703") {
			const legacyUpdate: Record<string, unknown> = { ...fallbackUpdate };
			delete legacyUpdate.custom_data;
			updateResult = await supabase
				.from("obras")
				.update(legacyUpdate)
				.eq("id", obraId)
				.eq("tenant_id", tenantId)
				.select("porcentaje")
				.maybeSingle();
			updateError = updateResult.error;
		}
	}

	if (updateError) {
		console.error("Error patching obra", updateError);
		return NextResponse.json(
			{ error: "No se pudo actualizar la obra" },
			{ status: 500 }
		);
	}

	if (!updateResult.data) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	const committedPorcentaje = updateResult.data
		? Number(updateResult.data.porcentaje ?? obraPatch.porcentaje ?? prevPorcentaje)
		: (obraPatch.porcentaje ?? prevPorcentaje);

	await handleObraCompletionTransitions({
		supabase,
		obraId,
		tenantId,
		userId: user.id,
		prevPorcentaje,
		committedPorcentaje,
		obraDesignacionFallback:
			obraPatch.designacionYUbicacion ??
			String(existingRow.designacion_y_ubicacion ?? ""),
	});

	return NextResponse.json({ ok: true });
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: obraId } = await params;
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ error: "No tenant" }, { status: 400 });
	}

	if (!obraId || obraId === "undefined") {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	try {
		const result = await softDeleteObraWithDocuments({
			supabase,
			tenantId,
			obraId,
			actorUserId: user.id,
			actorEmail: user.email ?? null,
			deleteReason: "manual_delete",
		});

		if (!result.ok) {
			if (result.errorCode === "obra_not_found") {
				return NextResponse.json({ error: result.errorMessage }, { status: 404 });
			}
			return NextResponse.json({ error: result.errorMessage }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			alreadyDeleted: result.alreadyDeleted,
			deleteId: result.deleteId,
			restoreDeadlineAt: result.restoreDeadlineAt,
		});
	} catch (error) {
		console.error("Obra DELETE: failed to soft delete obra", error);
		return NextResponse.json(
			{ error: "No se pudo eliminar la obra" },
			{ status: 500 }
		);
	}
}

// app/api/obras/route.ts
import { createClient } from "@/utils/supabase/server";
import { obrasFormSchema } from "@/app/excel/schema";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { sendObraCompletionWorkflow } from "@/workflows/obra-complete";

export const BASE_COLUMNS =
	"id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje";
export const CONFIG_COLUMNS =
	`${BASE_COLUMNS}, on_finish_first_message, on_finish_second_message, on_finish_second_send_at`;

export type DbObraRow = {
	id: string;
	n: number;
	designacion_y_ubicacion: string;
	sup_de_obra_m2: number | string;
	entidad_contratante: string;
	mes_basico_de_contrato: string;
	iniciacion: string;
	contrato_mas_ampliaciones: number | string;
	certificado_a_la_fecha: number | string;
	saldo_a_certificar: number | string;
	segun_contrato: number | string;
	prorrogas_acordadas: number | string;
	plazo_total: number | string;
	plazo_transc: number | string;
	porcentaje: number | string;
	on_finish_first_message?: string | null;
	on_finish_second_message?: string | null;
	on_finish_second_send_at?: string | null;
};

export function mapDbRowToObra(row: DbObraRow) {
	return {
		id: row.id,
		n: row.n,
		designacionYUbicacion: row.designacion_y_ubicacion,
		supDeObraM2: Number(row.sup_de_obra_m2) || 0,
		entidadContratante: row.entidad_contratante,
		mesBasicoDeContrato: row.mes_basico_de_contrato,
		iniciacion: row.iniciacion,
		contratoMasAmpliaciones: Number(row.contrato_mas_ampliaciones) || 0,
		certificadoALaFecha: Number(row.certificado_a_la_fecha) || 0,
		saldoACertificar: Number(row.saldo_a_certificar) || 0,
		segunContrato: Number(row.segun_contrato) || 0,
		prorrogasAcordadas: Number(row.prorrogas_acordadas) || 0,
		plazoTotal: Number(row.plazo_total) || 0,
		plazoTransc: Number(row.plazo_transc) || 0,
		porcentaje: Number(row.porcentaje) || 0,
		onFinishFirstMessage: row.on_finish_first_message ?? null,
		onFinishSecondMessage: row.on_finish_second_message ?? null,
		onFinishSecondSendAt: row.on_finish_second_send_at ?? null,
	};
}

export async function getAuthContext() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { supabase, user: null, tenantId: null };
	}

	const { data: membership, error: membershipError } = await supabase
		.from("memberships")
		.select("tenant_id")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	if (membershipError) {
		console.error("Failed to fetch tenant membership", membershipError);
		return { supabase, user, tenantId: null };
	}

	const tenantId = membership?.tenant_id ?? null;
	return { supabase, user, tenantId };
}

export async function GET(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json({ detalleObras: [] });
	}

	const url = new URL(request.url);
	const searchParams = url.searchParams;
	const hasPagination =
		searchParams.has("page") || searchParams.has("limit");

	const statusParam = searchParams.get("status");
	const status =
		statusParam === "completed" || statusParam === "in-process"
			? statusParam
			: null;

	const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
	const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);

	const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
	const limitCandidate =
		Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
	const limit = Math.min(Math.max(limitCandidate, 1), 500);
	const from = (page - 1) * limit;
	const to = from + limit - 1;

	let supportsConfigColumns = true;
	let count: number | null | undefined;

	const buildSelect = (columns: string) => {
		const query = supabase
			.from("obras")
			.select(columns, hasPagination ? { count: "exact" } : undefined)
			.eq("tenant_id", tenantId)
			.order("n", { ascending: true });

		if (status === "completed") {
			query.eq("porcentaje", 100);
		} else if (status === "in-process") {
			query.lt("porcentaje", 100);
		}

		if (hasPagination) {
			query.range(from, to);
		}

		return query;
	};

	let { data, error, count: initialCount } = await buildSelect(CONFIG_COLUMNS);
	count = initialCount;

	if (error && error.code === "42703") {
		console.warn(
			"Obras GET: on_finish_* columns missing, falling back to base columns"
		);
		supportsConfigColumns = false;
		const fallback = await buildSelect(BASE_COLUMNS);
		data = fallback.data;
		error = fallback.error;
		count = fallback.count ?? count;
	}

	if (error) {
		console.error("Error fetching obras", error);
		return NextResponse.json(
			{ error: "No se pudieron obtener las obras" },
			{ status: 500 }
		);
	}

	const detalleObras = (data ?? []).map(mapDbRowToObra);

	if (!hasPagination) {
		return NextResponse.json({ detalleObras, supportsConfigColumns });
	}

	let total = count ?? null;
	if (total == null) {
		const totalQuery = supabase
			.from("obras")
			.select("*", { count: "exact", head: true })
			.eq("tenant_id", tenantId);

		if (status === "completed") {
			totalQuery.eq("porcentaje", 100);
		} else if (status === "in-process") {
			totalQuery.lt("porcentaje", 100);
		}

		const { count: totalCount, error: countError } = await totalQuery;
		if (countError) {
			console.warn(
				"Obras GET: failed to fetch total count for pagination",
				countError
			);
		}
		total = totalCount ?? detalleObras.length;
	}

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return NextResponse.json({
		detalleObras,
		pagination: {
			page,
			limit,
			total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		},
		supportsConfigColumns,
	});
}

export async function PUT(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No se encontró una organización para el usuario" },
			{ status: 400 }
		);
	}

	console.info("Obras PUT: start", {
		tenantId,
		userId: user.id,
		userEmail: user.email ?? null,
	});

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
	}

	const parsingResult = obrasFormSchema.safeParse(body);
	if (!parsingResult.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsingResult.error.flatten() },
			{ status: 400 }
		);
	}

	const payload = parsingResult.data.detalleObras;

	console.info("Obras PUT: parsed payload", {
		count: payload.length,
	});

	let supportsConfigColumns = true;

	let { data: existingRows, error: fetchExistingError } = await supabase
		.from("obras")
		.select(
			"id, n, porcentaje, designacion_y_ubicacion, on_finish_first_message, on_finish_second_message, on_finish_second_send_at"
		)
		.eq("tenant_id", tenantId);

	if (fetchExistingError && fetchExistingError.code === "42703") {
		supportsConfigColumns = false;
		console.warn(
			"Obras PUT: on_finish_* columns missing when fetching existing rows, falling back"
		);
		const fallback = await supabase
			.from("obras")
			.select("id, n, porcentaje, designacion_y_ubicacion")
			.eq("tenant_id", tenantId);
		existingRows = fallback.data;
		fetchExistingError = fallback.error;
	}

	if (fetchExistingError) {
		console.error("Error fetching existing obras", fetchExistingError);
		return NextResponse.json(
			{ error: "No se pudieron validar los datos actuales" },
			{ status: 500 }
		);
	}

	const existingMap = new Map(
		(existingRows ?? []).map((row) => [
			row.n,
			{
				id: row.id,
				porcentaje: Number(row.porcentaje) || 0,
				name: row.designacion_y_ubicacion,
				onFinishFirstMessage:
					(row as DbObraRow).on_finish_first_message ?? null,
				onFinishSecondMessage:
					(row as DbObraRow).on_finish_second_message ?? null,
				onFinishSecondSendAt:
					(row as DbObraRow).on_finish_second_send_at ?? null,
			},
		])
	);

	const upsertPayload = payload.map((obra) => {
		const base = {
			tenant_id: tenantId,
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
		};

		if (supportsConfigColumns) {
			Object.assign(base, {
				on_finish_first_message: obra.onFinishFirstMessage ?? null,
				on_finish_second_message: obra.onFinishSecondMessage ?? null,
				on_finish_second_send_at: obra.onFinishSecondSendAt ?? null,
			});
		}

		return base;
	});

	const { error: upsertError } = await supabase
		.from("obras")
		.upsert(upsertPayload, { onConflict: "tenant_id,n" });

	if (upsertError) {
		console.error("Error saving obras", upsertError);
		return NextResponse.json(
			{ error: "No se pudieron guardar las obras" },
			{ status: 500 }
		);
	}

	const newNs = new Set(payload.map((obra) => obra.n));
	const toRemove =
		existingRows?.filter((row) => !newNs.has(row.n)).map((row) => row.n) ?? [];

	if (toRemove.length) {
		const { error: deleteError } = await supabase
			.from("obras")
			.delete()
			.eq("tenant_id", tenantId)
			.in("n", toRemove);

		if (deleteError) {
			console.error("Error deleting removed obras", deleteError);
			return NextResponse.json(
				{ error: "No se pudieron eliminar algunas obras" },
				{ status: 500 }
			);
		}
	}

	const newlyCompleted = payload.filter(
		(obra) =>
			obra.porcentaje === 100 &&
			(existingMap.get(obra.n)?.porcentaje ?? 0) < 100
	);

	console.info("Obras PUT: computed newlyCompleted", {
		count: newlyCompleted.length,
		items: newlyCompleted.map((obra) => ({
			n: obra.n,
			name: obra.designacionYUbicacion,
			percentage: obra.porcentaje,
		})),
	});

	let completedRows: Array<{
		id: string;
		n: number;
		designacion_y_ubicacion: string;
		porcentaje: number | string;
		on_finish_first_message: string | null;
		on_finish_second_message: string | null;
		on_finish_second_send_at: string | null;
	}> = [];

	if (newlyCompleted.length > 0) {
		const query = supabase
			.from("obras")
			.select(
				"id, n, designacion_y_ubicacion, porcentaje, on_finish_first_message, on_finish_second_message, on_finish_second_send_at"
			)
			.eq("tenant_id", tenantId)
			.in(
				"n",
				newlyCompleted.map((obra) => obra.n)
			);

		let fetchedCompleted;
		let fetchCompletedError;
		({ data: fetchedCompleted, error: fetchCompletedError } = await query);

		if (fetchCompletedError) {
			if (fetchCompletedError.code === "42703") {
				supportsConfigColumns = false;
				console.warn(
					"Obras PUT: on_finish_* columns missing when fetching completed obras, falling back"
				);
				const fallback = await supabase
					.from("obras")
					.select("id, n, designacion_y_ubicacion, porcentaje")
					.eq("tenant_id", tenantId)
					.in(
						"n",
						newlyCompleted.map((obra) => obra.n)
					);
				fetchedCompleted = fallback.data;
				fetchCompletedError = fallback.error;
			}
		}

		if (fetchCompletedError) {
			console.error(
				"Obras PUT: failed to fetch completed obras data",
				fetchCompletedError
			);
		} else {
			completedRows = fetchedCompleted ?? [];
		}
	}

	if (newlyCompleted.length === 0) {
		console.info("Obras PUT: no newly completed obras -> skipping email");
	} else if (user.email == null) {
		console.warn("Obras PUT: user has no email, cannot send completion email", {
			userId: user.id,
		});
	} else {
		const completedMap = new Map(
			completedRows.map((row) => [row.n, row])
		);

		for (const obra of newlyCompleted) {
			const latestRow = completedMap.get(obra.n);
			const fallbackRow = existingMap.get(obra.n);
			const workflowInput = {
				to: user.email,
				recipientName: user.user_metadata?.full_name ?? null,
				obra: {
					id: latestRow?.id ?? fallbackRow?.id,
					name: latestRow?.designacion_y_ubicacion ?? obra.designacionYUbicacion,
					percentage: latestRow ? Number(latestRow.porcentaje) || 0 : obra.porcentaje,
				},
				firstMessage:
					latestRow?.on_finish_first_message ??
					fallbackRow?.onFinishFirstMessage ??
					null,
				secondMessage:
					latestRow?.on_finish_second_message ??
					fallbackRow?.onFinishSecondMessage ??
					null,
				followUpSendAt:
					latestRow?.on_finish_second_send_at ??
					fallbackRow?.onFinishSecondSendAt ??
					null,
			};

			console.info("Obras PUT: starting completion workflow", {
				n: obra.n,
				obraId: workflowInput.obra.id ?? null,
				to: workflowInput.to,
				followUpSendAt: workflowInput.followUpSendAt,
			});

			try {
				await start(sendObraCompletionWorkflow, [workflowInput]);
				console.info("Obras PUT: completion workflow started", {
					n: obra.n,
					obraId: workflowInput.obra.id ?? null,
				});
			} catch (workflowError) {
				console.error("Obras PUT: failed to start completion workflow", {
					error: workflowError,
					n: obra.n,
					obraId: workflowInput.obra.id ?? null,
				});
			}
		}
	}

	return NextResponse.json({ ok: true });
}

export async function POST(_request: Request) {
	console.log("Sending workflow");
	const run = await start(sendObraCompletionWorkflow, [
		{
			to: "ignacioliotti@gmail.com",
			recipientName: "Test User",
			obra: { name: "Obra Test 1", percentage: 100 },
			firstMessage: "¡Felicitaciones! Alcanzaste el 100% de avance.",
			secondMessage: "Recordatorio personalizado de prueba.",
			followUpSendAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
		},
	]);
	console.log("Workflow started", run);
	return NextResponse.json({ readable: run });
}

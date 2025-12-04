// app/api/obras/route.ts
import { createClient } from "@/utils/supabase/server";
import { obrasFormSchema } from "@/app/excel/schema";
import { NextResponse } from "next/server";
import { emitEvent } from "@/lib/notifications/engine";
import "@/lib/notifications/rules"; // register rules
import { applyObraDefaults } from "@/lib/obra-defaults";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";

export const BASE_COLUMNS =
	"id, n, designacion_y_ubicacion, sup_de_obra_m2, entidad_contratante, mes_basico_de_contrato, iniciacion, contrato_mas_ampliaciones, certificado_a_la_fecha, saldo_a_certificar, segun_contrato, prorrogas_acordadas, plazo_total, plazo_transc, porcentaje";
export const CONFIG_COLUMNS = `${BASE_COLUMNS}, on_finish_first_message, on_finish_second_message, on_finish_second_send_at`;

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

/**
 * Execute flujo actions when an obra completes
 */
export async function executeFlujoActions(
	supabase: any,
	obraId: string,
	currentUserId: string,
	tenantId: string | null
) {
	console.info("Executing flujo actions for obra", { obraId });
	const adminSupabase = createSupabaseAdminClient();

	// Fetch all enabled flujo actions for this obra
	const { data: actions, error: fetchError } = await supabase
		.from("obra_flujo_actions")
		.select("*")
		.eq("obra_id", obraId)
		.eq("enabled", true);

	if (fetchError) {
		console.error("Error fetching flujo actions:", fetchError);
		return;
	}

	if (!actions || actions.length === 0) {
		console.info("No flujo actions configured for this obra");
		return;
	}

	console.info(`Found ${actions.length} flujo actions to execute`);

	for (const action of actions) {
		try {
			// Calculate when to execute based on timing_mode
			let executeAt: Date | null = null;

			if (action.timing_mode === "immediate") {
				executeAt = new Date();
			} else if (action.timing_mode === "offset") {
				// For completion workflows, "now" effectively is the completion time.
				// Offsets are calculated relative to the moment the obra reached 100%.
				const now = new Date();
				const offsetValue = action.offset_value || 0;
				const offsetUnit = action.offset_unit || "days";

				switch (offsetUnit) {
					case "minutes":
						executeAt = new Date(now.getTime() + offsetValue * 60 * 1000);
						break;
					case "hours":
						executeAt = new Date(now.getTime() + offsetValue * 60 * 60 * 1000);
						break;
					case "days":
						executeAt = new Date(
							now.getTime() + offsetValue * 24 * 60 * 60 * 1000
						);
						break;
					case "weeks":
						executeAt = new Date(
							now.getTime() + offsetValue * 7 * 24 * 60 * 60 * 1000
						);
						break;
					case "months":
						executeAt = new Date(now);
						executeAt.setMonth(executeAt.getMonth() + offsetValue);
						break;
					default:
						executeAt = new Date(
							now.getTime() + offsetValue * 24 * 60 * 60 * 1000
						);
				}
			} else if (action.timing_mode === "scheduled") {
				executeAt = action.scheduled_date
					? new Date(action.scheduled_date)
					: null;
			}

			if (!executeAt) {
				console.warn("Could not determine execution time for action", {
					actionId: action.id,
				});
				continue;
			}

			// Get recipient user IDs (default to current user if empty)
			const recipients =
				action.recipient_user_ids?.length > 0
					? action.recipient_user_ids
					: [currentUserId];

			// Get notification types (default to in_app if not specified)
			const notificationTypes =
				action.notification_types?.length > 0
					? action.notification_types
					: ["in_app"];

			const scheduledAtIso = executeAt.toISOString();
			const executionBase = {
				flujo_action_id: action.id,
				obra_id: obraId,
				scheduled_for: scheduledAtIso,
				notification_types: notificationTypes,
			};

			// For email-type actions, we still create notifications; for calendar_event
			// actions we now create rows in calendar_events instead, so they only
			// appear once the obra has actually completed.
			if (action.action_type === "calendar_event") {
				if (!tenantId) {
					console.warn(
						"Skipping calendar_event flujo action because tenantId is null",
						{ actionId: action.id, obraId }
					);
				} else {
					for (const recipientId of recipients) {
						const end = new Date(executeAt.getTime() + 60 * 60 * 1000);
						const { error: calErr } = await adminSupabase
							.from("calendar_events")
							.insert({
								tenant_id: tenantId,
								created_by: currentUserId,
								obra_id: obraId,
								flujo_action_id: action.id,
								title: action.title,
								description: action.message || "",
								start_at: executeAt.toISOString(),
								end_at: end.toISOString(),
								all_day: false,
								audience_type: "user",
								target_user_id: recipientId,
								deleted_at: null,
								deleted_by: null,
							});
						if (calErr) {
							console.error(
								"Failed to insert calendar_event from flujo action",
								{
									actionId: action.id,
									obraId,
									recipientId,
									error: calErr,
								}
							);
							await supabase.from("obra_flujo_executions").insert({
								...executionBase,
								recipient_user_id: recipientId,
								status: "failed",
								executed_at: new Date().toISOString(),
								error_message:
									calErr instanceof Error ? calErr.message : String(calErr),
							});
						} else {
							console.info("Inserted calendar_event from flujo action", {
								actionId: action.id,
								obraId,
								recipientId,
								start_at: executeAt.toISOString(),
							});
							await adminSupabase.from("obra_flujo_executions").insert({
								...executionBase,
								recipient_user_id: recipientId,
								status: "completed",
								executed_at: new Date().toISOString(),
							});
						}
					}
				}
			} else {
				for (const recipientId of recipients) {
					const { data: executionRow, error: executionError } = await adminSupabase
						.from("obra_flujo_executions")
						.insert({
							...executionBase,
							recipient_user_id: recipientId,
							status: "pending",
						})
						.select("id")
						.single();

					if (executionError) {
						console.error("Failed to record flujo execution", {
							actionId: action.id,
							recipientId,
							error: executionError,
						});
						continue;
					}

					const executionId = executionRow?.id ?? null;

					try {
						console.info("Scheduling flujo notification workflow", {
							actionId: action.id,
							recipientId,
							executionId,
							notificationTypes,
							executeAt: scheduledAtIso,
						});
						await emitEvent("flujo.action.triggered", {
							tenantId,
							actorId: currentUserId,
							recipientId,
							obraId,
							actionId: action.id,
							title: action.title,
							message: action.message,
							executeAt: scheduledAtIso,
							notificationTypes,
							executionId,
						});
					} catch (eventError) {
						console.error("Failed to schedule flujo workflow", {
							actionId: action.id,
							recipientId,
							error: eventError,
						});
						if (executionId) {
							await adminSupabase
								.from("obra_flujo_executions")
								.update({
									status: "failed",
									executed_at: new Date().toISOString(),
									error_message:
										eventError instanceof Error
											? eventError.message
											: String(eventError),
								})
								.eq("id", executionId);
						}
					}
				}
			}

			console.info("Flujo action executed successfully", {
				actionId: action.id,
				type: action.action_type,
				recipientCount: recipients.length,
			});
		} catch (actionError) {
			console.error("Error executing flujo action", {
				actionId: action.id,
				error: actionError,
			});

		}
	}
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
	const hasPagination = searchParams.has("page") || searchParams.has("limit");

	const statusParam = searchParams.get("status");
	const status =
		statusParam === "completed" || statusParam === "in-process"
			? statusParam
			: null;

	// Sorting & search parameters
	const allowedOrderColumns = new Set([
		"n",
		"designacion_y_ubicacion",
		"sup_de_obra_m2",
		"entidad_contratante",
		"mes_basico_de_contrato",
		"iniciacion",
		"contrato_mas_ampliaciones",
		"certificado_a_la_fecha",
		"saldo_a_certificar",
		"segun_contrato",
		"prorrogas_acordadas",
		"plazo_total",
		"plazo_transc",
		"porcentaje",
	]);

	const rawOrderBy = searchParams.get("orderBy") ?? "n";
	const orderBy = allowedOrderColumns.has(rawOrderBy) ? rawOrderBy : "n";
	const rawOrderDir = (searchParams.get("orderDir") ?? "asc").toLowerCase();
	const orderAscending = rawOrderDir !== "desc";

	const qRaw = (searchParams.get("q") ?? "").trim();

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
			.is("deleted_at", null)
			.order(orderBy, { ascending: orderAscending });

		if (status === "completed") {
			query.eq("porcentaje", 100);
		} else if (status === "in-process") {
			query.lt("porcentaje", 100);
		}

		if (qRaw) {
			const like = `%${qRaw}%`;
			const orFilters: string[] = [
				`designacion_y_ubicacion.ilike.${like}`,
				`entidad_contratante.ilike.${like}`,
				`mes_basico_de_contrato.ilike.${like}`,
				`iniciacion.ilike.${like}`,
			];
			const numericCandidate = Number(qRaw.replace(/[^\d+\-.]/g, ""));
			if (Number.isFinite(numericCandidate)) {
				const eqVal = String(numericCandidate);
				orFilters.push(
					`n.eq.${eqVal}`,
					`sup_de_obra_m2.eq.${eqVal}`,
					`contrato_mas_ampliaciones.eq.${eqVal}`,
					`certificado_a_la_fecha.eq.${eqVal}`,
					`saldo_a_certificar.eq.${eqVal}`,
					`segun_contrato.eq.${eqVal}`,
					`prorrogas_acordadas.eq.${eqVal}`,
					`plazo_total.eq.${eqVal}`,
					`plazo_transc.eq.${eqVal}`,
					`porcentaje.eq.${eqVal}`
				);
			}
			// Combine text and numeric filters into a single OR group
			query.or(orFilters.join(","));
		}

		// Advanced filters
		const numRange = (
			nameMin: string,
			nameMax: string,
			column: keyof DbObraRow | string
		) => {
			const rawMin = searchParams.get(nameMin);
			const rawMax = searchParams.get(nameMax);
			const min = rawMin != null ? Number(rawMin) : null;
			const max = rawMax != null ? Number(rawMax) : null;
			if (min != null && Number.isFinite(min))
				query.gte(String(column), min as any);
			if (max != null && Number.isFinite(max))
				query.lte(String(column), max as any);
		};

		numRange("supMin", "supMax", "sup_de_obra_m2");
		numRange("cmaMin", "cmaMax", "contrato_mas_ampliaciones");
		numRange("cafMin", "cafMax", "certificado_a_la_fecha");
		numRange("sacMin", "sacMax", "saldo_a_certificar");
		numRange("scMin", "scMax", "segun_contrato");
		numRange("paMin", "paMax", "prorrogas_acordadas");
		numRange("ptMin", "ptMax", "plazo_total");
		numRange("ptrMin", "ptrMax", "plazo_transc");

		const entidades = searchParams
			.getAll("entidad")
			.filter((v) => v.trim().length > 0);
		if (entidades.length > 0) {
			query.in("entidad_contratante", entidades);
		}

		const mesYear = searchParams.get("mesYear");
		if (mesYear && mesYear.trim())
			query.ilike("mes_basico_de_contrato", `%${mesYear.trim()}%`);
		const iniYear = searchParams.get("iniYear");
		if (iniYear && iniYear.trim())
			query.ilike("iniciacion", `%${iniYear.trim()}%`);
		const mesContains = searchParams.get("mesContains");
		if (mesContains && mesContains.trim())
			query.ilike("mes_basico_de_contrato", `%${mesContains.trim()}%`);
		const iniContains = searchParams.get("iniContains");
		if (iniContains && iniContains.trim())
			query.ilike("iniciacion", `%${iniContains.trim()}%`);

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

	const detalleObras = ((data ?? []) as unknown as DbObraRow[]).map(
		mapDbRowToObra
	);

	if (!hasPagination) {
		return NextResponse.json({ detalleObras, supportsConfigColumns });
	}

	let total = count ?? null;
	if (total == null) {
		const totalQuery = supabase
			.from("obras")
			.select("*", { count: "exact", head: true })
			.eq("tenant_id", tenantId)
			.is("deleted_at", null);

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
		.eq("tenant_id", tenantId)
		.is("deleted_at", null);

	if (fetchExistingError && fetchExistingError.code === "42703") {
		supportsConfigColumns = false;
		console.warn(
			"Obras PUT: on_finish_* columns missing when fetching existing rows, falling back"
		);
		const fallback = await supabase
			.from("obras")
			.select("id, n, porcentaje, designacion_y_ubicacion")
			.eq("tenant_id", tenantId)
			.is("deleted_at", null);
		existingRows = fallback.data as any;
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
			deleted_at: null,
			deleted_by: null,
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

	// Detect newly created obras and apply defaults
	const existingNs = new Set(existingMap.keys());
	const newlyCreatedNs = payload
		.filter((obra) => !existingNs.has(obra.n))
		.map((obra) => obra.n);

	if (newlyCreatedNs.length > 0) {
		console.info("Obras PUT: detected newly created obras", {
			count: newlyCreatedNs.length,
			ns: newlyCreatedNs,
		});

		// Fetch the IDs of newly created obras
		const { data: newObraRows, error: fetchNewError } = await supabase
			.from("obras")
			.select("id, n")
			.eq("tenant_id", tenantId)
			.in("n", newlyCreatedNs);

		if (fetchNewError) {
			console.error("Obras PUT: error fetching new obra IDs", fetchNewError);
		} else if (newObraRows && newObraRows.length > 0) {
			// Apply defaults to each new obra
			for (const obraRow of newObraRows) {
				try {
					const result = await applyObraDefaults(supabase, obraRow.id, tenantId);
					if (result.success) {
						console.info("Obras PUT: applied defaults to obra", {
							obraId: obraRow.id,
							n: obraRow.n,
							foldersApplied: result.foldersApplied,
							tablasApplied: result.tablasApplied,
						});
					} else {
						console.warn("Obras PUT: failed to apply defaults", {
							obraId: obraRow.id,
							error: result.error,
						});
					}
				} catch (defaultsError) {
					console.error("Obras PUT: error applying defaults", {
						obraId: obraRow.id,
						error: defaultsError,
					});
				}
			}
		}
	}

	const newlyCompleted = payload.filter(
		(obra) =>
			obra.porcentaje === 100 &&
			(existingMap.get(obra.n)?.porcentaje ?? 0) < 100
	);

	const newlyIncomplete = payload.filter(
		(obra) =>
			obra.porcentaje < 100 && (existingMap.get(obra.n)?.porcentaje ?? 0) >= 100
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
			.is("deleted_at", null)
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
					.is("deleted_at", null)
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
			const baseRows = (fetchedCompleted ?? []) as any[];
			completedRows = baseRows.map((row) => ({
				id: row.id,
				n: row.n,
				designacion_y_ubicacion: row.designacion_y_ubicacion,
				porcentaje: row.porcentaje,
				on_finish_first_message:
					(row as DbObraRow).on_finish_first_message ?? null,
				on_finish_second_message:
					(row as DbObraRow).on_finish_second_message ?? null,
				on_finish_second_send_at:
					(row as DbObraRow).on_finish_second_send_at ?? null,
			}));
		}
	}

	if (newlyCompleted.length === 0) {
		console.info("Obras PUT: no newly completed obras -> skipping email");
	} else if (user.email == null) {
		console.warn("Obras PUT: user has no email, cannot send completion email", {
			userId: user.id,
		});
	} else {
		const completedMap = new Map(completedRows.map((row) => [row.n, row]));

		for (const obra of newlyCompleted) {
			const latestRow = completedMap.get(obra.n);
			const fallbackRow = existingMap.get(obra.n);
			const ctx = {
				tenantId,
				actorId: user.id,
				obra: {
					id: latestRow?.id ?? fallbackRow?.id,
					name:
						latestRow?.designacion_y_ubicacion ?? obra.designacionYUbicacion,
					percentage: latestRow
						? Number(latestRow.porcentaje) || 0
						: obra.porcentaje,
				},
				followUpAt:
					latestRow?.on_finish_second_send_at ??
					fallbackRow?.onFinishSecondSendAt ??
					null,
			} as const;

			console.log("OBRA TERMINADA", {
				n: obra.n,
				obraId: ctx.obra.id ?? null,
				name: ctx.obra.name,
				percentage: ctx.obra.percentage,
			});

			console.info("Obras PUT: emitting event obra.completed", {
				n: obra.n,
				obraId: ctx.obra.id ?? null,
				followUpAt: ctx.followUpAt,
			});

			try {
				await emitEvent("obra.completed", ctx);
				console.info("Obras PUT: event emitted", {
					n: obra.n,
					obraId: ctx.obra.id ?? null,
				});
			} catch (workflowError) {
				console.error("Obras PUT: failed to emit event", {
					error: workflowError,
					n: obra.n,
					obraId: ctx.obra.id ?? null,
				});
			}

			// Execute flujo actions for the completed obra
			try {
				if (ctx.obra.id) {
					console.log("EXECUTING FLUJO ACTIONS", ctx.obra.id);
					await executeFlujoActions(supabase, ctx.obra.id, user.id, tenantId);
				}
			} catch (flujoError) {
				console.error(
					"Obras PUT: error while executing flujo actions",
					flujoError
				);
			}

			// Schedule document reminders for pendientes configured after completion
			try {
				if (ctx.obra.id) {
					const { data: pendRows, error: pendError } = await supabase
						.from("obra_pendientes")
						.select("name, offset_days")
						.eq("obra_id", ctx.obra.id)
						.eq("due_mode", "after_completion");
					if (pendError) throw pendError;

					for (const row of pendRows ?? []) {
						const offsetDays = Number((row as any).offset_days ?? 0);
						const dueDate = new Date(
							Date.now() + Math.max(0, offsetDays) * 24 * 60 * 60 * 1000
						);

						// Upsert schedules for this pendiente
						const stages: { stage: string; run_at: Date }[] = [];
						const mk = (days: number, label: string) => {
							const d = new Date(
								dueDate.getTime() - days * 24 * 60 * 60 * 1000
							);
							if (label !== "due_today") d.setHours(9, 0, 0, 0);
							return d;
						};
						stages.push({ stage: "due_7d", run_at: mk(7, "due_7d") });
						stages.push({ stage: "due_3d", run_at: mk(3, "due_3d") });
						stages.push({ stage: "due_1d", run_at: mk(1, "due_1d") });
						stages.push({ stage: "due_today", run_at: new Date(dueDate) });

						for (const s of stages) {
							await supabase.from("pendiente_schedules").upsert(
								{
									pendiente_id: (row as any).id,
									user_id: user.id,
									tenant_id: tenantId,
									stage: s.stage,
									run_at: s.run_at.toISOString(),
								},
								{ onConflict: "pendiente_id,stage" }
							);
						}
					}
				}
			} catch (scheduleErr) {
				console.error(
					"Obras PUT: error while scheduling pendientes after completion",
					scheduleErr
				);
			}
		}
	}

	// Handle obras that were reverted from completed back to incomplete:
	// remove any calendar events that were created for them by flujo actions.
	if (newlyIncomplete.length > 0) {
		try {
			const revertedNs = newlyIncomplete.map((obra) => obra.n);
			const revertedIds =
				existingRows
					?.filter((row) => revertedNs.includes(row.n))
					.map((row) => row.id) ?? [];

			if (revertedIds.length > 0) {
				const { error: delErr } = await supabase
					.from("calendar_events")
					.delete()
					.in("obra_id", revertedIds);
				if (delErr) {
					console.error(
						"Obras PUT: failed to delete calendar_events for reverted obras",
						{ obraIds: revertedIds, error: delErr }
					);
				} else {
					console.info(
						"Obras PUT: deleted calendar_events for reverted obras",
						{ obraIds: revertedIds }
					);
				}
			}
		} catch (revertError) {
			console.error(
				"Obras PUT: unexpected error while cleaning up calendar_events for reverted obras",
				revertError
			);
		}
	}

	return NextResponse.json({ ok: true });
}

export async function POST(_request: Request) {
	// Backward-compatible demo endpoint: emit obra.completed now
	try {
		const ctx = {
			tenantId: null,
			actorId: null,
			obra: { id: undefined, name: "Obra Test 1", percentage: 100 },
			followUpAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
		};
		await emitEvent("obra.completed", ctx);
		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: "failed" }, { status: 500 });
	}
}

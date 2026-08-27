import { NextResponse } from "next/server";
import { z } from "zod";
import { obraSchema } from "@/app/excel/schema";
import { provisionObraDefaults } from "@/lib/obra-defaults/provision";
import { canEditObras } from "@/lib/obras/permissions";
import {
	getAuthContext,
	loadTenantMainTableCustomColumnIds,
	sanitizeCustomData,
} from "../route";

const updateSchema = obraSchema.refine(
	(data) => data.id || (data.n && data.n > 0),
	{
		message: "Debe especificarse un identificador de obra válido",
		path: ["id"],
	},
);

const payloadSchema = z.object({
	updates: z.array(updateSchema).min(1, "Debe enviar al menos una obra"),
});

export async function PATCH(request: Request) {
	const { supabase, user, tenantId } = await getAuthContext();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!tenantId) {
		return NextResponse.json(
			{ error: "No se encontró una organización para el usuario" },
			{ status: 400 },
		);
	}

	try {
		if (!(await canEditObras(supabase, tenantId))) {
			return NextResponse.json(
				{ error: "No tenés permiso para crear o editar obras." },
				{ status: 403 },
			);
		}
	} catch (permissionError) {
		console.error(
			"Obras PATCH bulk: failed to validate edit permission",
			permissionError,
		);
		return NextResponse.json(
			{ error: "No se pudo validar el permiso para editar obras." },
			{ status: 500 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
	}

	const parsed = payloadSchema.safeParse(body);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const { updates } = parsed.data;
	const existingNs = new Set(
		updates
			.filter((obra) => typeof obra.id === "string" && obra.id.trim().length > 0)
			.map((obra) => obra.n)
	);
	const allowedCustomColumnIds = await loadTenantMainTableCustomColumnIds(
		supabase,
		tenantId
	);

	const buildPayload = (supportsConfig: boolean, supportsCustomData: boolean) =>
		updates.map((obra) => {
			const base: Record<string, unknown> = {
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
			if (supportsCustomData) {
				base.custom_data = sanitizeCustomData(
					obra.customData,
					allowedCustomColumnIds
				);
			}

			if (obra.id) {
				base.id = obra.id;
			}

			if (supportsConfig) {
				base.on_finish_first_message = obra.onFinishFirstMessage ?? null;
				base.on_finish_second_message = obra.onFinishSecondMessage ?? null;
				base.on_finish_second_send_at = obra.onFinishSecondSendAt ?? null;
			}

			return base;
		});

	let supportsConfigColumns = true;
	let supportsCustomData = true;

	let { error } = await supabase
		.from("obras")
		.upsert(buildPayload(supportsConfigColumns, supportsCustomData), {
			onConflict: "tenant_id,n",
		});

	if (error && error.code === "42703") {
		console.warn(
			"Obras PATCH bulk: on_finish_* columns missing, retrying without config columns",
			{ message: error.message }
		);
		supportsConfigColumns = false;
		const fallback = await supabase
			.from("obras")
			.upsert(buildPayload(supportsConfigColumns, supportsCustomData), {
				onConflict: "tenant_id,n",
			});
		error = fallback.error;
	}

	if (error && error.code === "42703") {
		console.warn(
			"Obras PATCH bulk: custom_data column missing, retrying without custom data",
			{ message: error.message }
		);
		supportsCustomData = false;
		const fallbackLegacy = await supabase
			.from("obras")
			.upsert(buildPayload(false, false), {
				onConflict: "tenant_id,n",
			});
		error = fallbackLegacy.error;
	}

	if (error) {
		console.error("Obras PATCH bulk: No se pudieron guardar las obras", error);
		return NextResponse.json(
			{ error: "No se pudieron guardar las obras" },
			{ status: 500 },
		);
	}

	const newlyCreatedNs = updates
		.filter((obra) => !existingNs.has(obra.n))
		.map((obra) => obra.n);
	const provisioningResults: Array<{
		obraId: string;
		n: number;
		ok: boolean;
		foldersApplied: number;
		tablasApplied: number;
		error: string | null;
	}> = [];

	if (newlyCreatedNs.length > 0) {
		console.info("Obras PATCH bulk: detected newly created obras", {
			count: newlyCreatedNs.length,
			ns: newlyCreatedNs,
		});

		const { data: newObraRows, error: fetchNewError } = await supabase
			.from("obras")
			.select("id, n")
			.eq("tenant_id", tenantId)
			.in("n", newlyCreatedNs);

		if (fetchNewError) {
			console.error(
				"Obras PATCH bulk: error fetching new obra IDs",
				fetchNewError
			);
			for (const n of newlyCreatedNs) {
				provisioningResults.push({
					obraId: "",
					n,
					ok: false,
					foldersApplied: 0,
					tablasApplied: 0,
					error: "No se pudo recuperar la obra para completar su estructura.",
				});
			}
		} else if (newObraRows && newObraRows.length > 0) {
			for (const obraRow of newObraRows) {
				try {
					const result = await provisionObraDefaults(
						supabase,
						obraRow.id as string,
						tenantId
					);
					provisioningResults.push({
						obraId: String(obraRow.id),
						n: Number(obraRow.n),
						ok: result.success,
						foldersApplied: result.foldersApplied,
						tablasApplied: result.tablasApplied,
						error: result.error ?? null,
					});
					if (result.success) {
						console.info("Obras PATCH bulk: applied defaults to obra", {
							obraId: obraRow.id,
							n: obraRow.n,
							foldersApplied: result.foldersApplied,
							tablasApplied: result.tablasApplied,
						});
					} else {
						console.warn("Obras PATCH bulk: failed to apply defaults", {
							obraId: obraRow.id,
							n: obraRow.n,
							error: result.error,
						});
					}
				} catch (defaultsError) {
					console.error("Obras PATCH bulk: error applying defaults", {
						obraId: obraRow.id,
						n: obraRow.n,
						error: defaultsError,
					});
					provisioningResults.push({
						obraId: String(obraRow.id),
						n: Number(obraRow.n),
						ok: false,
						foldersApplied: 0,
						tablasApplied: 0,
						error: "No se pudo completar la estructura de la obra.",
					});
				}
			}
		}

		const handledNs = new Set(provisioningResults.map((result) => result.n));
		for (const n of newlyCreatedNs) {
			if (handledNs.has(n)) continue;
			provisioningResults.push({
				obraId: "",
				n,
				ok: false,
				foldersApplied: 0,
				tablasApplied: 0,
				error: "La obra se guardó, pero no se pudo recuperar para completar su estructura.",
			});
		}
	}

	const provisioningFailed = provisioningResults.some((result) => !result.ok);
	return NextResponse.json(
		{
			ok: !provisioningFailed,
			count: updates.length,
			supportsConfigColumns,
			...(provisioningResults.length > 0
				? {
						provisioning: {
							status: provisioningFailed ? "partial" : "ready",
							results: provisioningResults,
						},
					}
				: {}),
			...(provisioningFailed
				? {
						error:
							"Las obras se guardaron, pero no se pudo completar su estructura. Reintentá la preparación antes de usarlas.",
					}
				: {}),
		},
		{ status: provisioningFailed ? 503 : 200 },
	);
}

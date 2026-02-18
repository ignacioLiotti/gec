import { NextResponse } from "next/server";
import { z } from "zod";
import { obraSchema } from "@/app/excel/schema";
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

	return NextResponse.json({
		ok: true,
		count: updates.length,
		supportsConfigColumns,
	});
}

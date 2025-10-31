import { NextResponse } from "next/server";
import { obraSchema } from "@/app/excel/schema";
import {
	BASE_COLUMNS,
	CONFIG_COLUMNS,
	DbObraRow,
	getAuthContext,
	mapDbRowToObra,
} from "../route";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

export async function GET(
    _request: Request,
    context: RouteContext,
) {
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
			"Obra GET: on_finish_* columns missing, falling back to base columns",
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
			{ status: 500 },
		);
	}

	if (!data) {
		return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
	}

	return NextResponse.json({ obra: mapDbRowToObra(data) });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
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

    let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
	}

    const payload = (typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : ({} as Record<string, unknown>));

    const parsingResult = obraSchema.safeParse({
        ...payload,
        id: obraId,
    });

	if (!parsingResult.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsingResult.error.flatten() },
			{ status: 400 },
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
			"Obra PUT: on_finish_* columns missing, updating without finish config",
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
			{ status: 500 },
		);
	}

	return NextResponse.json({ ok: true });
}

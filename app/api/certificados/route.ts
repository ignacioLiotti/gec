// app/api/certificados/route.ts
import { createClient } from "@/utils/supabase/server";
import { certificatesFormSchema } from "@/app/certificados/schema";
import { NextResponse } from "next/server";

export type DbCertificateRow = {
	id: string;
	obra_id: string;
	n_exp: string;
	n_certificado: number;
	monto: number | string;
	mes: string;
	estado: string;
	created_at: string;
	updated_at: string;
};

export function mapDbRowToCertificate(row: DbCertificateRow) {
	return {
		id: row.id,
		obra_id: row.obra_id,
		n_exp: row.n_exp,
		n_certificado: row.n_certificado,
		monto: Number(row.monto) || 0,
		mes: row.mes,
		estado: row.estado,
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
		return NextResponse.json({ detalleCertificados: [] });
	}

	const url = new URL(request.url);
	const searchParams = url.searchParams;
	const hasPagination =
		searchParams.has("page") || searchParams.has("limit");

	const statusParam = searchParams.get("estado");
	const estado = statusParam || null;

	const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
	const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);

	const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
	const limitCandidate =
		Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
	const limit = Math.min(Math.max(limitCandidate, 1), 500);
	const from = (page - 1) * limit;
	const to = from + limit - 1;

	let count: number | null | undefined;

	// Join with obras table to filter by tenant_id
	const query = supabase
		.from("certificates")
		.select(
			"*, obras!inner(tenant_id)",
			hasPagination ? { count: "exact" } : undefined
		)
		.eq("obras.tenant_id", tenantId)
		.order("n_certificado", { ascending: true });

	if (estado) {
		query.eq("estado", estado);
	}

	if (hasPagination) {
		query.range(from, to);
	}

	const { data, error, count: initialCount } = await query;
	count = initialCount;

	if (error) {
		console.error("Error fetching certificates", error);
		return NextResponse.json(
			{ error: "No se pudieron obtener los certificados" },
			{ status: 500 }
		);
	}

	const detalleCertificados = ((data ?? []) as unknown as DbCertificateRow[]).map(
		mapDbRowToCertificate
	);

	if (!hasPagination) {
		return NextResponse.json({ detalleCertificados });
	}

	let total = count ?? null;
	if (total == null) {
		const totalQuery = supabase
			.from("certificates")
			.select("*, obras!inner(tenant_id)", { count: "exact", head: true })
			.eq("obras.tenant_id", tenantId);

		if (estado) {
			totalQuery.eq("estado", estado);
		}

		const { count: totalCount, error: countError } = await totalQuery;
		if (countError) {
			console.warn(
				"Certificates GET: failed to fetch total count for pagination",
				countError
			);
		}
		total = totalCount ?? detalleCertificados.length;
	}

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return NextResponse.json({
		detalleCertificados,
		pagination: {
			page,
			limit,
			total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		},
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

	console.info("Certificados PUT: start", {
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

	const parsingResult = certificatesFormSchema.safeParse(body);
	if (!parsingResult.success) {
		return NextResponse.json(
			{ error: "Datos inválidos", details: parsingResult.error.flatten() },
			{ status: 400 }
		);
	}

	const payload = parsingResult.data.detalleCertificados;

	console.info("Certificados PUT: parsed payload", {
		count: payload.length,
	});

	// Verify all obras belong to the tenant
	const obraIds = [...new Set(payload.map((cert) => cert.obra_id))];
	const { data: obras, error: obrasError } = await supabase
		.from("obras")
		.select("id")
		.eq("tenant_id", tenantId)
		.in("id", obraIds);

	if (obrasError) {
		console.error("Error verifying obras", obrasError);
		return NextResponse.json(
			{ error: "No se pudieron verificar las obras" },
			{ status: 500 }
		);
	}

	const validObraIds = new Set((obras ?? []).map((o) => o.id));
	const invalidObras = obraIds.filter((id) => !validObraIds.has(id));

	if (invalidObras.length > 0) {
		return NextResponse.json(
			{
				error: `Las siguientes obras no pertenecen a tu organización: ${invalidObras.join(", ")}`,
			},
			{ status: 403 }
		);
	}

	// Get existing certificates for these obras
	const { data: existingRows, error: fetchExistingError } = await supabase
		.from("certificates")
		.select("id, obra_id, n_certificado")
		.in("obra_id", obraIds);

	if (fetchExistingError) {
		console.error("Error fetching existing certificates", fetchExistingError);
		return NextResponse.json(
			{ error: "No se pudieron validar los datos actuales" },
			{ status: 500 }
		);
	}

	// Create a map of existing certificates by (obra_id, n_certificado)
	const existingMap = new Map(
		(existingRows ?? []).map((row) => [`${row.obra_id}-${row.n_certificado}`, row.id])
	);

	const upsertPayload = payload.map((cert) => {
		const key = `${cert.obra_id}-${cert.n_certificado}`;
		const existingId = existingMap.get(key);

		return {
			...(existingId ? { id: existingId } : {}),
			obra_id: cert.obra_id,
			n_exp: cert.n_exp,
			n_certificado: cert.n_certificado,
			monto: cert.monto,
			mes: cert.mes,
			estado: cert.estado,
		};
	});

	const { data: upsertedRows, error: upsertError } = await supabase
		.from("certificates")
		.upsert(upsertPayload, { onConflict: "id" })
		.select();

	if (upsertError) {
		console.error("Error upserting certificates", upsertError);
		return NextResponse.json(
			{ error: "Error al guardar los certificados" },
			{ status: 500 }
		);
	}

	console.info("Certificados PUT: success", {
		upsertedCount: upsertedRows?.length ?? 0,
	});

	return NextResponse.json({ success: true, count: upsertedRows?.length ?? 0 });
}

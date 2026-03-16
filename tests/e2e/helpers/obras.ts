import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext } from "@playwright/test";

type ObraUpsertPayload = {
	n: number;
	designacionYUbicacion: string;
	supDeObraM2: number;
	entidadContratante: string;
	mesBasicoDeContrato: string;
	iniciacion: string;
	contratoMasAmpliaciones: number;
	certificadoALaFecha: number;
	saldoACertificar: number;
	segunContrato: number;
	prorrogasAcordadas: number;
	plazoTotal: number;
	plazoTransc: number;
	porcentaje: number;
	customData: Record<string, unknown>;
	onFinishFirstMessage: null;
	onFinishSecondMessage: null;
	onFinishSecondSendAt: null;
};

export type ObraListItem = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
	entidadContratante?: string | null;
	porcentaje?: number | null;
};

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const E2E_EXCEL_PREFIX = "[E2E][Excel]";
const NAVIGATION_OBRA_NAME = `${E2E_EXCEL_PREFIX} Navigation`;

function getAdminClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceRoleKey) {
		throw new Error(
			"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for E2E obra helpers.",
		);
	}

	return createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export function buildExcelObraName(label: string) {
	return `${E2E_EXCEL_PREFIX} ${label} ${crypto.randomUUID().slice(0, 8)}`;
}

async function fetchObras(request: APIRequestContext): Promise<ObraListItem[]> {
	const response = await request.get("/api/obras");
	expect(response.ok()).toBeTruthy();

	const payload = (await response.json()) as {
		detalleObras?: ObraListItem[];
	};

	return Array.isArray(payload.detalleObras) ? payload.detalleObras : [];
}

function buildObraPayload(
	nextN: number,
	overrides: Partial<ObraUpsertPayload> & Pick<ObraUpsertPayload, "designacionYUbicacion">,
): ObraUpsertPayload {
	return {
		n: nextN,
		designacionYUbicacion: overrides.designacionYUbicacion,
		supDeObraM2: overrides.supDeObraM2 ?? 100,
		entidadContratante: overrides.entidadContratante ?? "Tenant E2E",
		mesBasicoDeContrato: overrides.mesBasicoDeContrato ?? "01/01/2025",
		iniciacion: overrides.iniciacion ?? "15/01/2025",
		contratoMasAmpliaciones: overrides.contratoMasAmpliaciones ?? 1000,
		certificadoALaFecha: overrides.certificadoALaFecha ?? 0,
		saldoACertificar: overrides.saldoACertificar ?? 1000,
		segunContrato: overrides.segunContrato ?? 12,
		prorrogasAcordadas: overrides.prorrogasAcordadas ?? 0,
		plazoTotal: overrides.plazoTotal ?? 12,
		plazoTransc: overrides.plazoTransc ?? 1,
		porcentaje: overrides.porcentaje ?? 10,
		customData: overrides.customData ?? {},
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	};
}

export async function createObraViaBulkApi(
	request: APIRequestContext,
	overrides: Partial<ObraUpsertPayload> & Pick<ObraUpsertPayload, "designacionYUbicacion">,
): Promise<ObraListItem> {
	const nextN = crypto.randomInt(1_000_000, 9_999_999);

	const createResponse = await request.patch("/api/obras/bulk", {
		data: {
			updates: [buildObraPayload(nextN, overrides)],
		},
	});

	expect(createResponse.ok()).toBeTruthy();

	let created: ObraListItem | null = null;
	await expect
		.poll(
			async () => {
				const updatedObras = await fetchObras(request);
				created =
					updatedObras.find(
						(obra) =>
							obra.designacionYUbicacion === overrides.designacionYUbicacion,
					) ?? null;
				return created != null;
			},
			{
				message: `Expected obra ${overrides.designacionYUbicacion} to be visible after bulk create`,
				timeout: 10_000,
			},
		)
		.toBe(true);

	if (!created) {
		throw new Error(
			`Obra ${overrides.designacionYUbicacion} was not returned after bulk create`,
		);
	}

	return created;
}

export async function deleteObrasByNames(names: string[]) {
	if (names.length === 0) return;

	const admin = getAdminClient();
	const { error } = await admin
		.from("obras")
		.delete()
		.eq("tenant_id", DEFAULT_TENANT_ID)
		.in("designacion_y_ubicacion", names);

	if (error) {
		throw new Error(`Failed to cleanup E2E obras: ${error.message}`);
	}
}

export async function ensureNavigationObra(
	request: APIRequestContext,
): Promise<ObraListItem> {
	const obras = await fetchObras(request);
	const existing = obras.find(
		(obra) => obra.designacionYUbicacion === NAVIGATION_OBRA_NAME,
	);

	if (existing) {
		return existing;
	}

	return createObraViaBulkApi(request, {
		designacionYUbicacion: NAVIGATION_OBRA_NAME,
	});
}

export async function fetchAuthenticatedObras(request: APIRequestContext) {
	return fetchObras(request);
}

import crypto from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import { z } from "zod";

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

const obraListItemSchema = z.object({
	id: z.string(),
	n: z.number().nullable().optional(),
	designacionYUbicacion: z.string().nullable().optional(),
	entidadContratante: z.string().nullable().optional(),
	porcentaje: z.number().nullable().optional(),
});

const obrasResponseSchema = z.object({
	detalleObras: z.array(obraListItemSchema).optional(),
});

export const E2E_EXCEL_PREFIX = "[E2E][Excel]";

export function buildExcelObraName(label: string) {
	return `${E2E_EXCEL_PREFIX} ${label} ${crypto.randomUUID().slice(0, 8)}`;
}

async function fetchObras(request: APIRequestContext): Promise<ObraListItem[]> {
	const response = await request.get("/api/obras");
	expect(response.ok()).toBeTruthy();

	const payload = obrasResponseSchema.parse(await response.json());
	return payload.detalleObras ?? [];
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

export async function fetchAuthenticatedObras(request: APIRequestContext) {
	return fetchObras(request);
}

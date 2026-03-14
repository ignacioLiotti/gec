import { expect, type APIRequestContext } from "@playwright/test";

type ObraListItem = {
	id: string;
	n?: number | null;
	designacionYUbicacion?: string | null;
};

const E2E_OBRA_NAME = "E2E Playwright Navigation";

async function fetchObras(request: APIRequestContext): Promise<ObraListItem[]> {
	const response = await request.get("/api/obras");
	expect(response.ok()).toBeTruthy();

	const payload = (await response.json()) as {
		detalleObras?: ObraListItem[];
	};

	return Array.isArray(payload.detalleObras) ? payload.detalleObras : [];
}

function buildObraPayload(nextN: number) {
	return {
		n: nextN,
		designacionYUbicacion: E2E_OBRA_NAME,
		supDeObraM2: 100,
		entidadContratante: "Tenant E2E",
		mesBasicoDeContrato: "01/01/2025",
		iniciacion: "15/01/2025",
		contratoMasAmpliaciones: 1000,
		certificadoALaFecha: 0,
		saldoACertificar: 1000,
		segunContrato: 12,
		prorrogasAcordadas: 0,
		plazoTotal: 12,
		plazoTransc: 1,
		porcentaje: 10,
		customData: {},
		onFinishFirstMessage: null,
		onFinishSecondMessage: null,
		onFinishSecondSendAt: null,
	};
}

export async function ensureNavigationObra(
	request: APIRequestContext,
): Promise<ObraListItem> {
	const obras = await fetchObras(request);
	const existing = obras.find(
		(obra) => obra.designacionYUbicacion === E2E_OBRA_NAME,
	);

	if (existing) {
		return existing;
	}

	const nextN =
		obras.reduce((max, obra) => Math.max(max, Number(obra.n) || 0), 0) + 1;

	const createResponse = await request.patch("/api/obras/bulk", {
		data: {
			updates: [buildObraPayload(nextN)],
		},
	});

	expect(createResponse.ok()).toBeTruthy();

	const updatedObras = await fetchObras(request);
	const created = updatedObras.find(
		(obra) => obra.designacionYUbicacion === E2E_OBRA_NAME,
	);

	expect(created).toBeTruthy();
	return created as ObraListItem;
}

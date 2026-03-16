import {
	expect,
	request as playwrightRequest,
	test,
} from "@playwright/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	deleteObrasByNames,
	fetchAuthenticatedObras,
} from "../../helpers/obras";

const baseURL =
	process.env.PLAYWRIGHT_BASE_URL ??
	`http://127.0.0.1:${process.env.PORT ?? "3000"}`;

test.describe("Excel obras API", () => {
	const createdNames: string[] = [];

	test.afterEach(async () => {
		await deleteObrasByNames(createdNames.splice(0));
	});

	test("GET /api/obras requires authentication", async () => {
		const api = await playwrightRequest.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const response = await api.get("/api/obras");

		expect(response.status()).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			error: "Unauthorized",
		});

		await api.dispose();
	});

	test("PATCH /api/obras/bulk creates an obra retrievable from GET /api/obras", async ({
		request,
	}) => {
		const designacionYUbicacion = buildExcelObraName("API Create");
		createdNames.push(designacionYUbicacion);

		const created = await createObraViaBulkApi(request, {
			designacionYUbicacion,
			entidadContratante: "API Contract Tenant",
			porcentaje: 35,
		});

		expect(created.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);

		const obras = await fetchAuthenticatedObras(request);
		const saved = obras.find(
			(obra) => obra.designacionYUbicacion === designacionYUbicacion,
		);

		expect(saved).toMatchObject({
			id: created.id,
			designacionYUbicacion,
			entidadContratante: "API Contract Tenant",
			porcentaje: 35,
		});
	});

	test("PATCH /api/obras/bulk validates invalid payloads", async ({ request }) => {
		const response = await request.patch("/api/obras/bulk", {
			data: {
				updates: [],
			},
		});

		expect(response.status()).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "Datos inválidos",
		});
	});

	test("GET /api/obras status filters split in-process and completed obras", async ({
		request,
	}) => {
		const inProcessName = buildExcelObraName("InProcess");
		const completedName = buildExcelObraName("Completed");
		createdNames.push(inProcessName, completedName);

		await createObraViaBulkApi(request, {
			designacionYUbicacion: inProcessName,
			porcentaje: 20,
		});
		await createObraViaBulkApi(request, {
			designacionYUbicacion: completedName,
			porcentaje: 100,
		});

		await expect
			.poll(async () => {
				const inProcessResponse = await request.get("/api/obras?status=in-process");
				const completedResponse = await request.get("/api/obras?status=completed");

				expect(inProcessResponse.ok()).toBeTruthy();
				expect(completedResponse.ok()).toBeTruthy();

				const inProcessPayload = (await inProcessResponse.json()) as {
					detalleObras?: Array<{ designacionYUbicacion?: string | null }>;
				};
				const completedPayload = (await completedResponse.json()) as {
					detalleObras?: Array<{ designacionYUbicacion?: string | null }>;
				};

				const inProcessNames = new Set(
					(inProcessPayload.detalleObras ?? []).map(
						(obra) => obra.designacionYUbicacion,
					),
				);
				const completedNames = new Set(
					(completedPayload.detalleObras ?? []).map(
						(obra) => obra.designacionYUbicacion,
					),
				);

				return (
					inProcessNames.has(inProcessName) &&
					!inProcessNames.has(completedName) &&
					completedNames.has(completedName) &&
					!completedNames.has(inProcessName)
				);
			}, {
				message: "Expected status filters to separate in-process and completed obras",
				timeout: 10_000,
			})
			.toBe(true);
	});
});

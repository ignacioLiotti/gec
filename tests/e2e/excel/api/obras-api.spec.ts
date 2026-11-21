import { expect, test } from "../../fixtures/test";
import { z } from "zod";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	fetchAuthenticatedObras,
} from "../../helpers/obras";

const obrasListResponseSchema = z.object({
	detalleObras: z
		.array(
			z.object({
				designacionYUbicacion: z.string().nullish(),
			}),
		)
		.optional(),
});

test.describe("Excel obras API", () => {
	test("PATCH /api/obras/bulk creates an obra retrievable from GET /api/obras", async ({
		request,
		scenario,
	}) => {
		const designacionYUbicacion = buildExcelObraName(`${scenario.namespace} API Create`);

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

	test("PUT /api/obras rejects legacy partial sync without deleting omitted obras", async ({
		request,
		scenario,
	}) => {
		const keptName = buildExcelObraName(`${scenario.namespace} Legacy Put Kept`);
		const omittedName = buildExcelObraName(`${scenario.namespace} Legacy Put Omitted`);

		await createObraViaBulkApi(request, {
			designacionYUbicacion: keptName,
			porcentaje: 15,
		});
		await createObraViaBulkApi(request, {
			designacionYUbicacion: omittedName,
			porcentaje: 25,
		});

		const obrasBefore = await fetchAuthenticatedObras(request);
		const keptObra = obrasBefore.find(
			(obra) => obra.designacionYUbicacion === keptName,
		);
		if (!keptObra) {
			throw new Error("Expected kept obra to exist before legacy PUT check");
		}

		const response = await request.put("/api/obras", {
			data: {
				detalleObras: [keptObra],
			},
		});

		expect(response.status()).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			error: expect.stringContaining("fullSync=true"),
		});

		const obrasAfter = await fetchAuthenticatedObras(request);
		const namesAfter = new Set(
			obrasAfter.map((obra) => obra.designacionYUbicacion),
		);
		expect(namesAfter.has(keptName)).toBe(true);
		expect(namesAfter.has(omittedName)).toBe(true);
	});

	test("GET /api/obras status filters split in-process and completed obras", async ({
		request,
		scenario,
	}) => {
		const inProcessName = buildExcelObraName(`${scenario.namespace} InProcess`);
		const completedName = buildExcelObraName(`${scenario.namespace} Completed`);

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

				const inProcessPayload = obrasListResponseSchema.parse(
					await inProcessResponse.json(),
				);
				const completedPayload = obrasListResponseSchema.parse(
					await completedResponse.json(),
				);

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

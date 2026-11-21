import { randomInt } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { z } from "zod";

import {
	expect,
	test,
	type ActorName,
} from "../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	fetchAuthenticatedObras,
} from "../helpers/obras";

const persistedObraSchema = z.object({
	id: z.string().uuid(),
	designacionYUbicacion: z.string(),
	entidadContratante: z.string(),
	porcentaje: z.number(),
});

const obraResponseSchema = z.object({
	obra: persistedObraSchema,
});

const obrasResponseSchema = z.object({
	detalleObras: z.array(persistedObraSchema),
});

function buildObraPayload(designacionYUbicacion: string) {
	return {
		n: randomInt(1_000_000, 9_999_999),
		designacionYUbicacion,
		supDeObraM2: 100,
		entidadContratante: "Tenant isolation fixture",
		mesBasicoDeContrato: "01/01/2025",
		iniciacion: "15/01/2025",
		contratoMasAmpliaciones: 1_000,
		certificadoALaFecha: 0,
		saldoACertificar: 1_000,
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

function buildDatabaseObra(args: {
	tenantId: string;
	designacionYUbicacion: string;
}) {
	return {
		tenant_id: args.tenantId,
		n: randomInt(1_000_000, 9_999_999),
		designacion_y_ubicacion: args.designacionYUbicacion,
		sup_de_obra_m2: 100,
		entidad_contratante: "Foreign tenant insert attempt",
		mes_basico_de_contrato: "01/01/2025",
		iniciacion: "15/01/2025",
		contrato_mas_ampliaciones: 1_000,
		certificado_a_la_fecha: 0,
		saldo_a_certificar: 1_000,
		segun_contrato: 12,
		prorrogas_acordadas: 0,
		plazo_total: 12,
		plazo_transc: 1,
		porcentaje: 10,
	};
}

async function readObra(request: APIRequestContext, obraId: string) {
	const response = await request.get(`/api/obras/${obraId}`);
	expect(response.ok()).toBeTruthy();
	return obraResponseSchema.parse(await response.json()).obra;
}

for (const actorName of ["owner", "editor"] satisfies ActorName[]) {
	test(`${actorName} creates, saves and reads an own-tenant obra in a fresh context`, async ({
		scenario,
	}) => {
		const actor = await scenario.actor(actorName);
		const initialName = buildExcelObraName(`${scenario.namespace} ${actorName} create`);
		const savedName = `${initialName} saved`;
		const savedContractor = `${actorName} persisted contractor`;

		const created = await createObraViaBulkApi(actor.request, {
			designacionYUbicacion: initialName,
			entidadContratante: `${actorName} initial contractor`,
			porcentaje: 25,
		});

		const saveResponse = await actor.request.patch(`/api/obras/${created.id}`, {
			data: {
				designacionYUbicacion: savedName,
				entidadContratante: savedContractor,
				porcentaje: 45,
			},
		});
		expect(saveResponse.status()).toBe(200);

		const freshContext = await scenario.newContext(actorName);
		const persisted = await readObra(freshContext.request, created.id);
		expect(persisted).toMatchObject({
			id: created.id,
			designacionYUbicacion: savedName,
			entidadContratante: savedContractor,
			porcentaje: 45,
		});
		await freshContext.close();
	});
}

test("viewer reads own-tenant obras but API writes are forbidden and persisted fields stay unchanged", async ({
	scenario,
}) => {
	const owner = await scenario.actor("owner");
	const viewer = await scenario.actor("viewer");
	const name = buildExcelObraName(`${scenario.namespace} viewer read`);
	const blockedCreateName = buildExcelObraName(`${scenario.namespace} viewer blocked create`);
	const originalContractor = "Owner-controlled contractor";
	const created = await createObraViaBulkApi(owner.request, {
		designacionYUbicacion: name,
		entidadContratante: originalContractor,
		porcentaje: 30,
	});

	await expect(readObra(viewer.request, created.id)).resolves.toMatchObject({
		id: created.id,
		designacionYUbicacion: name,
		entidadContratante: originalContractor,
	});

	const blockedUpdate = await viewer.request.patch(`/api/obras/${created.id}`, {
		data: { entidadContratante: "Viewer mutation" },
	});
	expect(blockedUpdate.status()).toBe(403);

	const blockedCreate = await viewer.request.patch("/api/obras/bulk", {
		data: { updates: [buildObraPayload(blockedCreateName)] },
	});
	expect(blockedCreate.status()).toBe(403);

	const ownerFreshContext = await scenario.newContext("owner");
	const persisted = await readObra(ownerFreshContext.request, created.id);
	expect(persisted).toMatchObject({
		entidadContratante: originalContractor,
		porcentaje: 30,
	});
	const ownerList = await fetchAuthenticatedObras(ownerFreshContext.request);
	expect(
		ownerList.some((obra) => obra.designacionYUbicacion === blockedCreateName),
	).toBe(false);
	await ownerFreshContext.close();
});

test("tenant A owner cannot read or update a known tenant B obra through the API", async ({
	scenario,
}) => {
	const ownerA = await scenario.actor("owner");
	const ownerB = await scenario.actor("otherOwner");
	const name = buildExcelObraName(`${scenario.namespace} tenant B API`);
	const originalContractor = "Tenant B contractor";
	const createdByB = await createObraViaBulkApi(ownerB.request, {
		designacionYUbicacion: name,
		entidadContratante: originalContractor,
		porcentaje: 35,
	});

	const foreignRead = await ownerA.request.get(`/api/obras/${createdByB.id}`);
	expect(foreignRead.status()).toBe(404);

	const foreignUpdate = await ownerA.request.patch(`/api/obras/${createdByB.id}`, {
		data: { entidadContratante: "Tenant A mutation" },
	});
	expect(foreignUpdate.status()).toBe(404);

	const ownerBFreshContext = await scenario.newContext("otherOwner");
	const unchanged = await readObra(ownerBFreshContext.request, createdByB.id);
	expect(unchanged).toMatchObject({
		id: createdByB.id,
		designacionYUbicacion: name,
		entidadContratante: originalContractor,
		porcentaje: 35,
	});
	await ownerBFreshContext.close();
});

test("foreign-tenant RLS hides reads, affects zero rows for update/delete and rejects insert", async ({
	scenario,
}) => {
	const ownerA = await scenario.actor("owner");
	const ownerB = await scenario.actor("otherOwner");
	const name = buildExcelObraName(`${scenario.namespace} tenant B RLS`);
	const attemptedInsertName = buildExcelObraName(`${scenario.namespace} foreign insert`);
	const createdByB = await createObraViaBulkApi(ownerB.request, {
		designacionYUbicacion: name,
		entidadContratante: "Tenant B before RLS attempts",
		porcentaje: 20,
	});

	const foreignRead = await ownerA.db
		.from("obras")
		.select("id")
		.eq("id", createdByB.id);
	expect(foreignRead.error).toBeNull();
	expect(foreignRead.data).toEqual([]);

	const foreignUpdate = await ownerA.db
		.from("obras")
		.update({ entidad_contratante: "Tenant A direct update" })
		.eq("id", createdByB.id)
		.select("id");
	expect(foreignUpdate.error).toBeNull();
	expect(foreignUpdate.data).toEqual([]);

	const foreignDelete = await ownerA.db
		.from("obras")
		.delete()
		.eq("id", createdByB.id)
		.select("id");
	expect(foreignDelete.error).toBeNull();
	expect(foreignDelete.data).toEqual([]);

	const foreignInsert = await ownerA.db.from("obras").insert(
		buildDatabaseObra({
			tenantId: scenario.tenants.b,
			designacionYUbicacion: attemptedInsertName,
		}),
	);
	expect(foreignInsert.error?.code).toBe("42501");

	const positiveUpdate = await ownerB.db
		.from("obras")
		.update({ entidad_contratante: "Tenant B RLS positive control" })
		.eq("id", createdByB.id)
		.select("id, entidad_contratante")
		.single();
	expect(positiveUpdate.error).toBeNull();
	expect(positiveUpdate.data).toMatchObject({
		id: createdByB.id,
		entidad_contratante: "Tenant B RLS positive control",
	});

	const positiveRead = await ownerB.db
		.from("obras")
		.select("id, designacion_y_ubicacion, entidad_contratante")
		.eq("id", createdByB.id)
		.single();
	expect(positiveRead.error).toBeNull();
	expect(positiveRead.data).toMatchObject({
		id: createdByB.id,
		designacion_y_ubicacion: name,
		entidad_contratante: "Tenant B RLS positive control",
	});
});

test("tampering active_tenant_id cannot grant membership in another tenant", async ({
	scenario,
}) => {
	const ownerA = await scenario.actor("owner");
	const ownerB = await scenario.actor("otherOwner");
	const tenantAName = buildExcelObraName(`${scenario.namespace} tenant A cookie`);
	const tenantBName = buildExcelObraName(`${scenario.namespace} tenant B cookie`);
	const tenantAObra = await createObraViaBulkApi(ownerA.request, {
		designacionYUbicacion: tenantAName,
	});
	const tenantBObra = await createObraViaBulkApi(ownerB.request, {
		designacionYUbicacion: tenantBName,
	});

	const tamperedContext = await scenario.newContext("owner", {
		activeTenantId: scenario.tenants.b,
	});
	const listResponse = await tamperedContext.request.get("/api/obras");
	expect(listResponse.ok()).toBeTruthy();
	const listed = obrasResponseSchema.parse(await listResponse.json()).detalleObras;
	expect(listed.some((obra) => obra.id === tenantAObra.id)).toBe(true);
	expect(listed.some((obra) => obra.id === tenantBObra.id)).toBe(false);

	const directForeignRead = await tamperedContext.request.get(
		`/api/obras/${tenantBObra.id}`,
	);
	expect(directForeignRead.status()).toBe(404);
	await tamperedContext.close();
});

test("an explicit role deny overrides a role grant for obras:edit", async ({
	scenario,
}) => {
	const viewer = await scenario.actor("viewer");
	const owner = await scenario.actor("owner");
	const blockedName = buildExcelObraName(`${scenario.namespace} role deny`);
	await scenario.permissions.seedRoleConflict("viewer", "obras:edit");

	const permission = await viewer.db.rpc("has_permission", {
		tenant: scenario.tenants.a,
		perm_key: "obras:edit",
	});
	expect.soft(permission.error).toBeNull();
	expect.soft(permission.data).toBe(false);

	const blockedCreate = await viewer.request.patch("/api/obras/bulk", {
		data: { updates: [buildObraPayload(blockedName)] },
	});
	expect.soft(blockedCreate.status()).toBe(403);

	const persisted = await fetchAuthenticatedObras(owner.request);
	expect(
		persisted.some((obra) => obra.designacionYUbicacion === blockedName),
	).toBe(false);
});

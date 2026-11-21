import { randomInt } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

import {
	expect,
	test,
	type Actor,
	type ActorName,
} from "../fixtures/test";
import {
	buildExcelObraName,
	createObraViaBulkApi,
	fetchAuthenticatedObras,
} from "../helpers/obras";

const EDIT_PERMISSION = "obras:edit";

function buildObraPayload(designacionYUbicacion: string) {
	return {
		n: randomInt(1_000_000, 9_999_999),
		designacionYUbicacion,
		supDeObraM2: 100,
		entidadContratante: "Permission precedence fixture",
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

async function expectPermission(
	actor: Actor,
	tenantId: string,
	expected: boolean,
) {
	const result = await actor.db.rpc("has_permission", {
		tenant: tenantId,
		perm_key: EDIT_PERMISSION,
	});
	expect(result.error).toBeNull();
	expect(result.data).toBe(expected);
}

async function attemptBulkCreate(
	request: APIRequestContext,
	designacionYUbicacion: string,
) {
	return request.patch("/api/obras/bulk", {
		data: { updates: [buildObraPayload(designacionYUbicacion)] },
	});
}

test("a user deny overrides a role grant", async ({ scenario }) => {
	const editor = await scenario.actor("editor");
	const owner = await scenario.actor("owner");
	const blockedName = buildExcelObraName(
		`${scenario.namespace} user deny over role grant`,
	);

	await expectPermission(editor, scenario.tenants.a, true);
	await scenario.permissions.seedUserOverride("editor", EDIT_PERMISSION, {
		tenant: "a",
		decision: "deny",
	});
	await expectPermission(editor, scenario.tenants.a, false);

	const blockedCreate = await attemptBulkCreate(editor.request, blockedName);
	expect(blockedCreate.status()).toBe(403);
	const persisted = await fetchAuthenticatedObras(owner.request);
	expect(
		persisted.some((obra) => obra.designacionYUbicacion === blockedName),
	).toBe(false);
});

test("a role deny overrides a role grant until a user grant overrides both", async ({
	scenario,
}) => {
	const viewer = await scenario.actor("viewer");
	const owner = await scenario.actor("owner");
	const blockedName = buildExcelObraName(
		`${scenario.namespace} role deny over role grant`,
	);
	const grantedName = buildExcelObraName(
		`${scenario.namespace} user grant over role deny`,
	);

	await expectPermission(viewer, scenario.tenants.a, false);
	await scenario.permissions.seedRoleConflict("viewer", EDIT_PERMISSION);
	await expectPermission(viewer, scenario.tenants.a, false);
	const blockedCreate = await attemptBulkCreate(viewer.request, blockedName);
	expect(blockedCreate.status()).toBe(403);

	await scenario.permissions.seedUserOverride("viewer", EDIT_PERMISSION, {
		tenant: "a",
		decision: "grant",
	});
	await expectPermission(viewer, scenario.tenants.a, true);
	const created = await createObraViaBulkApi(viewer.request, {
		designacionYUbicacion: grantedName,
	});

	const ownerObras = await fetchAuthenticatedObras(owner.request);
	expect(ownerObras.some((obra) => obra.id === created.id)).toBe(true);
	expect(
		ownerObras.some((obra) => obra.designacionYUbicacion === blockedName),
	).toBe(false);
});

for (const actorName of ["owner", "admin"] satisfies ActorName[]) {
	test(`${actorName} bypasses user and role denies`, async ({ scenario }) => {
		const actor = await scenario.actor(actorName);
		const createdName = buildExcelObraName(
			`${scenario.namespace} ${actorName} bypass`,
		);

		await scenario.permissions.seedRoleConflict(actorName, EDIT_PERMISSION);
		await scenario.permissions.seedUserOverride(actorName, EDIT_PERMISSION, {
			tenant: "a",
			decision: "deny",
		});
		await expectPermission(actor, scenario.tenants.a, true);

		const created = await createObraViaBulkApi(actor.request, {
			designacionYUbicacion: createdName,
		});
		expect(created.designacionYUbicacion).toBe(createdName);
	});
}

test("user overrides remain isolated by tenant with an independent owner control", async ({
	scenario,
}) => {
	const editor = await scenario.actor("editor");
	const ownerA = await scenario.actor("owner");
	const ownerB = await scenario.actor("otherOwner");
	const blockedName = buildExcelObraName(
		`${scenario.namespace} tenant A override deny`,
	);
	const tenantBName = buildExcelObraName(
		`${scenario.namespace} tenant B override grant`,
	);

	await scenario.permissions.seedUserOverride("editor", EDIT_PERMISSION, {
		tenant: "a",
		decision: "deny",
	});
	await scenario.permissions.seedUserOverride("editor", EDIT_PERMISSION, {
		tenant: "b",
		decision: "grant",
	});
	await expectPermission(editor, scenario.tenants.a, false);
	await expectPermission(editor, scenario.tenants.b, true);

	const blockedCreate = await attemptBulkCreate(editor.request, blockedName);
	expect(blockedCreate.status()).toBe(403);

	const tenantBContext = await scenario.newContext("editor", {
		activeTenantId: scenario.tenants.b,
	});
	const createdInB = await createObraViaBulkApi(tenantBContext.request, {
		designacionYUbicacion: tenantBName,
	});
	await tenantBContext.close();

	const [tenantAObras, tenantBObras] = await Promise.all([
		fetchAuthenticatedObras(ownerA.request),
		fetchAuthenticatedObras(ownerB.request),
	]);
	expect(tenantAObras.some((obra) => obra.id === createdInB.id)).toBe(false);
	expect(
		tenantAObras.some((obra) => obra.designacionYUbicacion === blockedName),
	).toBe(false);
	expect(tenantBObras.some((obra) => obra.id === createdInB.id)).toBe(true);
});

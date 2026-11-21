import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { assertLocalE2ETarget } from "../helpers/local-target";
import { cleanupScenario, createScenario } from "../fixtures/scenario";

const tenantCreateSchema = z.array(
	z.object({
		id: z.string().uuid(),
		name: z.string(),
	}),
);

const manifestSchema = z.object({
	kind: z.literal("owned-local-integration-fixture"),
	runId: z.string().uuid(),
	projectId: z.string(),
	status: z.string(),
	runtimeCleanup: z.string(),
	errors: z.array(z.string()),
	resources: z.array(z.object({ kind: z.string(), id: z.string() })),
});

function expectAwaitingStackDisposal(tenantId: string) {
	const instancePath = z.string().min(1).parse(process.env.E2E_INSTANCE_MANIFEST);
	const directory = join(dirname(instancePath), "fixture-manifests");
	const manifests = readdirSync(directory)
		.filter((name) => name.endsWith(".json"))
		.map((name) => manifestSchema.parse(JSON.parse(readFileSync(join(directory, name), "utf8"))))
		.filter((manifest) => manifest.resources.some((resource) => resource.kind === "tenant" && resource.id === tenantId));
	expect(manifests).toHaveLength(1);
	expect(manifests[0]).toMatchObject({
		runId: process.env.E2E_RUN_ID,
		projectId: `e2e_${process.env.E2E_RUN_ID?.replaceAll("-", "")}`,
		status: "awaiting-stack-disposal",
		runtimeCleanup: "verified",
		errors: [],
	});
}

function ownedAdminClient() {
	const target = assertLocalE2ETarget({ kind: "execution", env: process.env });
	return createClient(target.supabaseUrl.href, target.supabaseServiceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
	});
}

function requestUrl(input: Parameters<typeof fetch>[0]) {
	return new URL(
		typeof input === "string" || input instanceof URL ? input : input.url,
	);
}

function requestMethod(
	input: Parameters<typeof fetch>[0],
	init: Parameters<typeof fetch>[1],
) {
	return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

async function requestBodyText(
	input: Parameters<typeof fetch>[0],
	init: Parameters<typeof fetch>[1],
) {
	if (typeof init?.body === "string") return init.body;
	if (input instanceof Request) return input.clone().text();
	return null;
}

test("a partial setup failure records owned SQL for verified stack disposal", async ({
	browser,
	contextOptions,
}, testInfo) => {
	const originalFetch = globalThis.fetch;
	const capturedTenantIds: string[] = [];
	let rejectedDefaultInsert = false;

	globalThis.fetch = async (input, init) => {
		const url = requestUrl(input);
		const method = requestMethod(input, init);
		if (
			method === "POST" &&
			url.pathname.endsWith("/rest/v1/tenants")
		) {
			const body = await requestBodyText(input, init);
			if (body) {
				const tenants = tenantCreateSchema.parse(JSON.parse(body));
				capturedTenantIds.push(...tenants.map((tenant) => tenant.id));
			}
		}
		if (
			!rejectedDefaultInsert &&
			method === "POST" &&
			url.pathname.endsWith("/rest/v1/obra_default_folders")
		) {
			rejectedDefaultInsert = true;
			return new Response(
				JSON.stringify({ message: "Injected fixture setup boundary failure" }),
				{
					status: 500,
					headers: { "content-type": "application/json" },
				},
			);
		}
		return originalFetch(input, init);
	};

	let setupError: unknown;
	try {
		await createScenario({ browser, contextOptions, testInfo });
	} catch (error) {
		setupError = error;
	} finally {
		globalThis.fetch = originalFetch;
	}

	expect(rejectedDefaultInsert).toBe(true);
	expect(capturedTenantIds).toHaveLength(2);
	if (!(setupError instanceof Error)) {
		throw new Error("Expected the injected setup failure to reject scenario creation.");
	}
	expect(setupError.message).not.toContain(
		"scenario setup and rollback both failed",
	);

	const residuals = await ownedAdminClient()
		.from("tenants")
		.select("id")
		.in("id", capturedTenantIds);
	expect(residuals.error).toBeNull();
	expect(residuals.data?.map((tenant) => tenant.id).sort()).toEqual([...capturedTenantIds].sort());
	expectAwaitingStackDisposal(capturedTenantIds[0]);
});

test("cleanup removes auth and Storage while soft-deleted SQL awaits stack disposal", async ({
	browser,
	contextOptions,
}, testInfo) => {
	const scenario = await createScenario({ browser, contextOptions, testInfo });
	let cleanupAttempted = false;
	try {
		const owner = await scenario.actor("owner");
		const context = await scenario.newContext("owner");
		const fixture = await scenario.lineage.createSingle("storage cleanup");
		const storagePath = `${fixture.obraId}/fixture-lifecycle/nested/probe.txt`;
		const uploaded = await owner.db.storage
			.from("obra-documents")
			.upload(storagePath, new Blob(["fixture cleanup probe"], {
				type: "text/plain",
			}));
		expect(uploaded.error).toBeNull();

		const beforeCleanup = await ownedAdminClient().storage
			.from("obra-documents")
			.list(`${fixture.obraId}/fixture-lifecycle/nested`);
		expect(beforeCleanup.error).toBeNull();
		expect(beforeCleanup.data?.map((entry) => entry.name)).toContain("probe.txt");

		const deleted = await ownedAdminClient().from("obras").delete().eq("id", fixture.obraId);
		expect(deleted.error).toBeNull();
		const softDeleted = await ownedAdminClient().from("obras")
			.select("id, deleted_at").eq("id", fixture.obraId).single();
		expect(softDeleted.error).toBeNull();
		expect(softDeleted.data?.id).toBe(fixture.obraId);
		expect(softDeleted.data?.deleted_at).toEqual(expect.any(String));

		cleanupAttempted = true;
		await cleanupScenario(scenario);

		const afterCleanup = await ownedAdminClient().storage
			.from("obra-documents")
			.list(`${fixture.obraId}/fixture-lifecycle/nested`);
		expect(afterCleanup.error).toBeNull();
		expect(afterCleanup.data).toEqual([]);
		expect(browser.contexts()).not.toContain(context);
		const authResidual = await ownedAdminClient().auth.admin.getUserById(owner.userId);
		expect(authResidual.data.user).toBeNull();
		expect(authResidual.error?.status).toBe(404);
		const profiles = await ownedAdminClient().from("profiles").select("user_id").eq("user_id", owner.userId);
		expect(profiles.error).toBeNull();
		expect(profiles.data).toEqual([]);
		const sqlResidual = await ownedAdminClient().from("obras")
			.select("id, deleted_at").eq("id", fixture.obraId).single();
		expect(sqlResidual.error).toBeNull();
		expect(sqlResidual.data?.id).toBe(fixture.obraId);
		expect(sqlResidual.data?.deleted_at).toEqual(expect.any(String));
		expectAwaitingStackDisposal(scenario.tenants.a);
	} finally {
		if (!cleanupAttempted) await cleanupScenario(scenario);
	}
});

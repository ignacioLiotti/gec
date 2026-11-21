import type { Route } from "@playwright/test";
import { expect, test } from "../fixtures/test";
import { signedMobileUrl } from "./provider";

test("MOBILE-01 anonymous signed flow submission records one tenant-scoped result", async ({ scenario }) => {
	const seed = await scenario.billingMobile.createFlow({ state: "open" });
	const owner = await scenario.actor("owner");
	const other = await scenario.actor("otherOwner");
	const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
	try {
		const page = await mobile.newPage();
		await page.goto(await signedMobileUrl("flow", seed.runId));
		await expect(page.getByRole("heading", { name: seed.title })).toBeVisible();
		await page.getByLabel("Inspection note").fill("Mobile inspection completed");
		await page.getByLabel("Confirmed").selectOption("false");
		await page.getByRole("button", { name: "Enviar respuesta" }).click();
		await expect(page).toHaveURL(new RegExp(`/whatsapp/flow/${seed.runId}/thanks`));
		const result = await owner.db.from("whatsapp_manual_submissions").select("id,tenant_id,status,parsed_values").eq("contact_id", seed.contactId);
		expect(result.error).toBeNull();
		expect(result.data).toHaveLength(1);
		expect(result.data?.[0]).toMatchObject({
			tenant_id: scenario.tenants.a, status: "ready_to_apply", parsed_values: { note: "Mobile inspection completed", confirmed: false },
		});
		expect(result.data?.[0]?.parsed_values).toEqual({ note: "Mobile inspection completed", confirmed: false });
		const run = await owner.db.from("whatsapp_flow_runs").select("status,manual_submission_id").eq("id", seed.runId).single();
		expect(run.error).toBeNull();
		expect(run.data).toEqual({ status: "completed", manual_submission_id: result.data?.[0]?.id });
		const foreign = await other.db.from("whatsapp_manual_submissions").select("id").eq("contact_id", seed.contactId);
		expect(foreign.error).toBeNull();
		expect(foreign.data).toEqual([]);
	} finally { await mobile.close(); }
});

test("MOBILE-02 signed token cannot be transplanted to another run or changed during submit", async ({ scenario }) => {
	const seed = await scenario.billingMobile.createFlow({ state: "open" });
	const another = await scenario.billingMobile.createFlow({ state: "open" });
	const owner = await scenario.actor("owner");
	const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
	try {
		const page = await mobile.newPage();
		const signed = await signedMobileUrl("flow", seed.runId);
		const transplanted = await page.goto(signed.replace(seed.runId, another.runId));
		expect(transplanted?.status()).toBe(404);
		await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Enviar respuesta" })).toHaveCount(0);
		await page.goto(signed);
		await page.getByLabel("Inspection note").fill("Tampered form must not persist");
		await page.locator('input[name="runId"]').evaluate((element, runId) => {
			if (!(element instanceof HTMLInputElement)) throw new Error("Expected form run input");
			element.value = runId;
		}, another.runId);
		const rejected = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/whatsapp/flow/${seed.runId}`));
		await page.getByRole("button", { name: "Enviar respuesta" }).click();
		const rejection = await rejected;
		expect(rejection.status()).toBeGreaterThanOrEqual(400);
		expect(await rejection.text()).toContain("Respuesta no autorizada");
		const results = await owner.db.from("whatsapp_manual_submissions").select("id").in("contact_id", [seed.contactId, another.contactId]);
		expect(results.error).toBeNull();
		expect(results.data).toEqual([]);
		const runs = await owner.db.from("whatsapp_flow_runs").select("status,manual_submission_id").in("id", [seed.runId, another.runId]);
		expect(runs.error).toBeNull();
		expect(runs.data).toEqual([{ status: "sent", manual_submission_id: null }, { status: "sent", manual_submission_id: null }]);
	} finally { await mobile.close(); }
});

for (const state of ["expired", "past_expiry", "cancelled"] as const) {
	test(`MOBILE-03 ${state} flow cannot expose an editable form or create a response`, async ({ scenario }) => {
		const seed = await scenario.billingMobile.createFlow({ state });
		const owner = await scenario.actor("owner");
		const before = await owner.db.from("whatsapp_flow_runs").select("status,expires_at,manual_submission_id,response_values,completed_at").eq("id", seed.runId).single();
		expect(before.error).toBeNull();
		const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
		try {
			const page = await mobile.newPage();
			await page.goto(await signedMobileUrl("flow", seed.runId));
			await expect(page.getByRole("heading", { name: "Respuesta no disponible" })).toBeVisible();
			await expect(page.getByText(state === "cancelled" ? "Esta solicitud fue cancelada." : "El plazo para responder esta solicitud venció.", { exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Enviar respuesta" })).toHaveCount(0);
			const results = await owner.db.from("whatsapp_manual_submissions").select("id").eq("contact_id", seed.contactId);
			expect(results.error).toBeNull();
			expect(results.data).toEqual([]);
			const after = await owner.db.from("whatsapp_flow_runs").select("status,expires_at,manual_submission_id,response_values,completed_at").eq("id", seed.runId).single();
			expect(after.error).toBeNull();
			expect(after.data).toEqual(before.data);
		} finally { await mobile.close(); }
	});
}

for (const closure of ["expired", "cancelled"] as const) {
	test(`MOBILE-03 an already open flow rejects submission after it is ${closure}`, async ({ scenario }) => {
		const seed = await scenario.billingMobile.createFlow({ state: "open" });
		const owner = await scenario.actor("owner");
		const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
		try {
			const page = await mobile.newPage();
			await page.goto(await signedMobileUrl("flow", seed.runId));
			await page.getByLabel("Inspection note").fill("This stale form must not persist");
			const closed = await owner.db.from("whatsapp_flow_runs")
				.update(closure === "expired" ? { expires_at: new Date(Date.now() - 60_000).toISOString() } : { status: "cancelled" })
				.eq("id", seed.runId).eq("tenant_id", scenario.tenants.a)
				.select("status,expires_at,manual_submission_id,response_values,completed_at").single();
			expect(closed.error).toBeNull();
			await page.getByRole("button", { name: "Enviar respuesta" }).click();
			await expect(page.getByRole("heading", { name: "Respuesta no disponible" })).toBeVisible();
			await expect(page.getByText(closure === "cancelled" ? "Esta solicitud fue cancelada." : "El plazo para responder esta solicitud venció.", { exact: true })).toBeVisible();
			const results = await owner.db.from("whatsapp_manual_submissions").select("id").eq("contact_id", seed.contactId);
			expect(results.error).toBeNull();
			expect(results.data).toEqual([]);
			const after = await owner.db.from("whatsapp_flow_runs").select("status,expires_at,manual_submission_id,response_values,completed_at").eq("id", seed.runId).single();
			expect(after.error).toBeNull();
			expect(after.data).toEqual(closed.data);
		} finally { await mobile.close(); }
	});
}

test("MOBILE-04 two already opened copies of a signed flow cannot insert duplicate submissions", async ({ scenario }) => {
	const seed = await scenario.billingMobile.createFlow({ state: "open" });
	const owner = await scenario.actor("owner");
	const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
	try {
		const first = await mobile.newPage();
		const second = await mobile.newPage();
		const signed = await signedMobileUrl("flow", seed.runId);
		await first.goto(signed);
		await second.goto(signed);
		await first.getByLabel("Inspection note").fill("First accepted response");
		await second.getByLabel("Inspection note").fill("Repeated response");
		await first.getByRole("button", { name: "Enviar respuesta" }).click();
		await expect(first).toHaveURL(new RegExp(`/whatsapp/flow/${seed.runId}/thanks`));
		const repeated = second.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/whatsapp/flow/${seed.runId}`));
		await second.getByRole("button", { name: "Enviar respuesta" }).click();
		await repeated;
		await expect(second.getByText("Esta respuesta ya fue enviada.", { exact: true })).toBeVisible();
		const results = await owner.db.from("whatsapp_manual_submissions").select("id,parsed_values").eq("contact_id", seed.contactId);
		expect(results.error).toBeNull();
		expect(results.data).toHaveLength(1);
		expect(results.data?.[0]?.parsed_values).toMatchObject({ note: "First accepted response" });
		const run = await owner.db.from("whatsapp_flow_runs").select("status,manual_submission_id,response_values").eq("id", seed.runId).single();
		expect(run.error).toBeNull();
		expect(run.data).toMatchObject({ status: "completed", manual_submission_id: results.data?.[0]?.id, response_values: { note: "First accepted response" } });
	} finally { await mobile.close(); }
});

test("MOBILE-06 simultaneous signed flow submissions persist one response and a matching run", async ({ scenario }) => {
	const seed = await scenario.billingMobile.createFlow({ state: "open" });
	const owner = await scenario.actor("owner");
	const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
	try {
		const first = await mobile.newPage();
		const second = await mobile.newPage();
		const signed = await signedMobileUrl("flow", seed.runId);
		await first.goto(signed);
		await second.goto(signed);
		await first.getByLabel("Inspection note").fill("Concurrent response A");
		await second.getByLabel("Inspection note").fill("Concurrent response B");
		const submissions: Route[] = [];
		await mobile.route(`**/whatsapp/flow/${seed.runId}*`, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			submissions.push(route);
			if (submissions.length === 2) await Promise.all(submissions.map((pending) => pending.continue()));
		});
		const responses = [
			first.waitForResponse((response) => response.request().method() === "POST"),
			second.waitForResponse((response) => response.request().method() === "POST"),
		];
		await Promise.all([
			first.getByRole("button", { name: "Enviar respuesta" }).click(),
			second.getByRole("button", { name: "Enviar respuesta" }).click(),
		]);
		for (const response of await Promise.all(responses)) {
			await response.finished();
			expect(response.status()).toBeLessThan(400);
		}
		expect(submissions).toHaveLength(2);
		const results = await owner.db.from("whatsapp_manual_submissions").select("id,parsed_values").eq("contact_id", seed.contactId);
		expect(results.error).toBeNull();
		expect(results.data).toHaveLength(1);
		expect(results.data?.[0]?.parsed_values).toEqual({ note: expect.stringMatching(/^Concurrent response [AB]$/), confirmed: true });
		const run = await owner.db.from("whatsapp_flow_runs").select("status,manual_submission_id,response_values").eq("id", seed.runId).single();
		expect(run.error).toBeNull();
		expect(run.data).toEqual({ status: "completed", manual_submission_id: results.data?.[0]?.id, response_values: results.data?.[0]?.parsed_values });
		const audit = await owner.db.from("whatsapp_chat_actions").select("status,manual_submission_id,parsed_params,resolved_at").eq("id", seed.chatActionId).single();
		expect(audit.error).toBeNull();
		expect(audit.data).toEqual({
			status: "completed", manual_submission_id: results.data?.[0]?.id, parsed_params: { responseValues: results.data?.[0]?.parsed_values },
			resolved_at: expect.any(String),
		});
	} finally { await mobile.close(); }
});

for (const resultMode of ["manual_submission", "review_only"] as const) {
	test(`MOBILE-05 recurring ${resultMode} response keeps assigned obra and review outcome`, async ({ scenario }) => {
		test.setTimeout(90_000);
		const seed = await scenario.billingMobile.createRecurring({ resultMode });
		const owner = await scenario.actor("owner");
		const other = await scenario.actor("otherOwner");
		const mobile = await scenario.newAnonymousContext({ viewport: { width: 375, height: 844 } });
		try {
			const page = await mobile.newPage();
			await page.goto(await signedMobileUrl("respond", seed.runId));
			await expect(page.getByRole("heading", { name: seed.title })).toBeVisible();
			await page.getByLabel("Comentario").fill("Received through assigned recurring form");
			await page.getByRole("button", { name: "Enviar respuesta" }).click();
			await expect(page).toHaveURL(new RegExp(`/whatsapp/respond/${seed.runId}/thanks`));
			const result = await owner.db.from("whatsapp_manual_submissions").select("id,tenant_id,obra_id,folder_path,status,parsed_values").eq("contact_id", seed.contactId);
			expect(result.error).toBeNull();
			expect(result.data).toHaveLength(1);
			expect(result.data?.[0]).toMatchObject({
				tenant_id: scenario.tenants.a, obra_id: seed.obraId, folder_path: seed.folderPath,
				status: resultMode === "review_only" ? "needs_review" : "ready_to_apply",
				parsed_values: { received: true, comment: "Received through assigned recurring form" },
			});
			expect(result.data?.[0]?.parsed_values).toEqual({ received: true, comment: "Received through assigned recurring form" });
			const audit = await owner.db.from("whatsapp_chat_actions").select("status,manual_submission_id").eq("id", seed.chatActionId).single();
			expect(audit.error).toBeNull();
			expect(audit.data).toEqual({
				status: resultMode === "review_only" ? "needs_review" : "completed", manual_submission_id: result.data?.[0]?.id,
			});
			const run = await owner.db.from("whatsapp_recurring_runs").select("status,chat_action_id,completed_at").eq("id", seed.runId).single();
			expect(run.error).toBeNull();
			expect(run.data).toMatchObject({ status: "completed", chat_action_id: seed.chatActionId });
			expect(run.data?.completed_at).toEqual(expect.any(String));
			const foreign = await other.db.from("whatsapp_manual_submissions").select("id").eq("contact_id", seed.contactId);
			expect(foreign.error).toBeNull();
			expect(foreign.data).toEqual([]);
			const fresh = await scenario.newContext("owner");
			try {
				const history = await fresh.newPage();
				await history.goto("/admin/whatsapp?tab=historial");
				await expect(history.locator("pre").filter({ hasText: "Received through assigned recurring form" })).toBeVisible();
				await expect(history.getByText("Formulario respondido desde link de WhatsApp.", { exact: true }).first()).toBeVisible();
			} finally { await fresh.close(); }
		} finally { await mobile.close(); }
	});
}


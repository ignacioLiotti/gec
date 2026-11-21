import { createObraViaBulkApi } from "../helpers/obras";
import { expect, test } from "../fixtures/test";
import type { APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	buildInsurancePolicyWorkbook,
	confirmInsuranceImport,
	findInsurancePolicy,
	listInsurancePolicies,
	previewInsuranceImport,
} from "./financial-workflows";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type FullSyncObra = {
	id?: string;
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
	customData?: Record<string, unknown>;
	onFinishFirstMessage?: string | null;
	onFinishSecondMessage?: string | null;
	onFinishSecondSendAt?: string | null;
};

async function setObraPercentageViaFullSync(
	request: APIRequestContext,
	obraId: string,
	porcentaje: number,
) {
	const listResponse = await request.get("/api/obras");
	expect(listResponse.ok()).toBe(true);
	const list = (await listResponse.json()) as { detalleObras?: FullSyncObra[] };
	const activeObras = list.detalleObras ?? [];
	expect(activeObras.some((obra) => obra.id === obraId)).toBe(true);
	const response = await request.put("/api/obras", {
		data: {
			fullSync: true,
			detalleObras: activeObras.map((obra) => ({
				...obra,
				porcentaje: obra.id === obraId ? porcentaje : obra.porcentaje,
			})),
		},
	});
	expect(response.ok()).toBe(true);
}

async function readStoredPolicy(db: Pick<SupabaseClient, "from">, policyId: string) {
	const { data, error } = await db
		.from("insurance_policies")
		.select(
			"id, obra_finished_at, calculated_cancellation_date, last_notified_at, cancellation_requested_at, cancellation_notes, notes, is_cancelled",
		)
		.eq("id", policyId)
		.single();
	if (error) throw new Error(`read stored policy ${policyId}: ${error.message}`);
	return data;
}

async function openPoliciesWorkspace(page: import("@playwright/test").Page) {
	await page.goto("/dashboard", {
		waitUntil: "domcontentloaded",
		timeout: 60_000,
	});
	const tab = page.getByRole("tab", { name: "Polizas de seguro" });
	await expect(tab).toBeVisible({ timeout: 60_000 });
	await tab.click();
}

async function searchPolicy(page: import("@playwright/test").Page, policyNumber: string) {
	const search = page.getByPlaceholder("Buscar poliza, obra, riesgo...");
	await expect(search).toBeVisible({ timeout: 60_000 });
	await search.fill(policyNumber);
	const row = page.locator("tr", { hasText: policyNumber }).first();
	await expect(row).toBeVisible({ timeout: 20_000 });
	return row;
}

test.describe("insurance policy import and cancellation", () => {
	test("keeps completion-derived policy dates correct for an editor across denial, replay, and undo", async ({ scenario }) => {
		const owner = await scenario.actor("owner");
		const editor = await scenario.actor("editor");
		const viewer = await scenario.actor("viewer");
		const otherOwner = await scenario.actor("otherOwner");
		const obraName = `${scenario.namespace} poliza finalizacion`;
		const obra = await createObraViaBulkApi(owner.request, {
			designacionYUbicacion: obraName,
			porcentaje: 25,
		});
		const deletedObra = await createObraViaBulkApi(owner.request, {
			designacionYUbicacion: `${scenario.namespace} poliza obra eliminada`,
		});
		const unrelatedObraName = `${scenario.namespace} poliza no relacionada`;
		await createObraViaBulkApi(owner.request, {
			designacionYUbicacion: unrelatedObraName,
		});
		const foreignObraName = `${scenario.namespace} poliza tenant extranjero`;
		await createObraViaBulkApi(otherOwner.request, {
			designacionYUbicacion: foreignObraName,
		});

		await scenario.permissions.seedUserOverride("viewer", "obras:edit", {
			tenant: "a",
			decision: "deny",
		});
		const editorCanEdit = await editor.db.rpc("has_permission", {
			tenant: editor.tenantId,
			perm_key: "obras:edit",
		});
		expect(editorCanEdit.error).toBeNull();
		expect(editorCanEdit.data).toBe(true);
		const editorCanManagePolicies = await editor.db.rpc("has_permission", {
			tenant: editor.tenantId,
			perm_key: "insurance-policies:manage",
		});
		expect(editorCanManagePolicies.error).toBeNull();
		expect(editorCanManagePolicies.data).toBe(false);

		const viewerCompletion = await viewer.request.post(`/api/obras/${obra.id}/complete`);
		expect(viewerCompletion.status()).toBe(403);
		const foreignCompletion = await otherOwner.request.post(`/api/obras/${obra.id}/complete`);
		expect(foreignCompletion.status()).toBe(404);
		const deleteObra = await owner.request.delete(`/api/obras/${deletedObra.id}`);
		expect(deleteObra.ok()).toBe(true);
		const deletedCompletion = await editor.request.post(`/api/obras/${deletedObra.id}/complete`);
		expect(deletedCompletion.status()).toBe(404);

		const policyNumber = `${scenario.namespace}-POL-COMPLETE`;
		const definitivePolicyNumber = `${scenario.namespace}-POL-DEFINITIVE`;
		const unconfiguredPolicyNumber = `${scenario.namespace}-POL-UNCONFIGURED`;
		const unrelatedPolicyNumber = `${scenario.namespace}-POL-UNRELATED`;
		const foreignPolicyNumber = `${scenario.namespace}-POL-FOREIGN`;
		const workbook = buildInsurancePolicyWorkbook([
			{ policyNumber, obra: obraName },
			{ policyNumber: definitivePolicyNumber, obra: obraName },
			{ policyNumber: unconfiguredPolicyNumber, obra: obraName },
			{ policyNumber: unrelatedPolicyNumber, obra: unrelatedObraName },
		]);
		const preview = await previewInsuranceImport(owner.request, workbook, `${scenario.namespace}-completion.xlsx`);
		await confirmInsuranceImport(owner.request, preview.preview);
		const foreignWorkbook = buildInsurancePolicyWorkbook([
			{ policyNumber: foreignPolicyNumber, obra: foreignObraName },
		]);
		const foreignPreview = await previewInsuranceImport(
			otherOwner.request,
			foreignWorkbook,
			`${scenario.namespace}-foreign-completion.xlsx`,
		);
		await confirmInsuranceImport(otherOwner.request, foreignPreview.preview);
		const policy = await findInsurancePolicy(owner.request, policyNumber);
		const definitivePolicy = await findInsurancePolicy(owner.request, definitivePolicyNumber);
		const unconfiguredPolicy = await findInsurancePolicy(owner.request, unconfiguredPolicyNumber);
		const unrelatedPolicy = await findInsurancePolicy(owner.request, unrelatedPolicyNumber);
		const foreignPolicy = await findInsurancePolicy(otherOwner.request, foreignPolicyNumber);
		const configurePolicy = await owner.request.patch(`/api/insurance-policies/${policy.id}`, {
			data: {
				cancellationRuleType: "days_after",
				cancellationRuleOffset: 10,
				cancellationRequestedAt: "2026-10-19",
				cancellationNotes: "conservar gestion de baja",
				notes: "conservar nota operativa",
			},
		});
		expect(configurePolicy.ok()).toBe(true);
		const configureDefinitivePolicy = await owner.request.patch(
			`/api/insurance-policies/${definitivePolicy.id}`,
			{
				data: {
					cancellationRuleType: "months_after",
					cancellationRuleOffset: 1,
					definitiveReceptionDate: "2026-08-15",
					notes: "base definitiva conservada",
				},
			},
		);
		expect(configureDefinitivePolicy.ok()).toBe(true);
		const unrelatedWitness = {
			obra_finished_at: "2026-07-01",
			calculated_cancellation_date: "2026-07-04",
			notes: "no tocar misma organizacion",
		};
		const seedUnrelated = await owner.db
			.from("insurance_policies")
			.update(unrelatedWitness)
			.eq("id", unrelatedPolicy.id)
			.select("id")
			.single();
		expect(seedUnrelated.error).toBeNull();
		const foreignWitness = {
			obra_finished_at: "2026-06-01",
			calculated_cancellation_date: "2026-06-02",
			notes: "no tocar otro tenant",
		};
		const seedForeign = await otherOwner.db
			.from("insurance_policies")
			.update(foreignWitness)
			.eq("id", foreignPolicy.id)
			.select("id")
			.single();
		expect(seedForeign.error).toBeNull();

		const completion = await editor.request.post(`/api/obras/${obra.id}/complete`);
		expect(completion.ok()).toBe(true);
		const completionBody = (await completion.json()) as { finishedAt: string };
		const expectedCancellation = new Date(`${completionBody.finishedAt}T00:00:00.000Z`);
		expectedCancellation.setUTCDate(expectedCancellation.getUTCDate() + 10);
		let completedPolicy = await readStoredPolicy(owner.db, policy.id);
		expect(completedPolicy).toMatchObject({
			obra_finished_at: completionBody.finishedAt,
			calculated_cancellation_date: expectedCancellation.toISOString().slice(0, 10),
			last_notified_at: null,
			cancellation_requested_at: "2026-10-19",
			cancellation_notes: "conservar gestion de baja",
			notes: "conservar nota operativa",
			is_cancelled: false,
		});
		expect(await readStoredPolicy(owner.db, definitivePolicy.id)).toMatchObject({
			obra_finished_at: completionBody.finishedAt,
			calculated_cancellation_date: "2026-09-15",
			notes: "base definitiva conservada",
		});
		expect(await readStoredPolicy(owner.db, unconfiguredPolicy.id)).toMatchObject({
			obra_finished_at: completionBody.finishedAt,
			calculated_cancellation_date: null,
		});
		expect(await readStoredPolicy(owner.db, unrelatedPolicy.id)).toMatchObject(unrelatedWitness);
		expect(await readStoredPolicy(otherOwner.db, foreignPolicy.id)).toMatchObject(foreignWitness);

		const historicalFinishedAt = "2026-09-01";
		const historicalCancellationDate = "2026-09-11";
		const historicalNotificationAt = "2026-09-12T12:00:00.000Z";
		const seedHistoricalDate = await owner.db
			.from("insurance_policies")
			.update({
				obra_finished_at: historicalFinishedAt,
				calculated_cancellation_date: historicalCancellationDate,
				last_notified_at: historicalNotificationAt,
			})
			.eq("id", policy.id)
			.select("id")
			.single();
		expect(seedHistoricalDate.error).toBeNull();
		const replay = await editor.request.post(`/api/obras/${obra.id}/complete`);
		expect(replay.ok()).toBe(true);
		completedPolicy = await readStoredPolicy(owner.db, policy.id);
		expect(completedPolicy).toMatchObject({
			obra_finished_at: historicalFinishedAt,
			calculated_cancellation_date: historicalCancellationDate,
			cancellation_notes: "conservar gestion de baja",
			notes: "conservar nota operativa",
		});
		expect(new Date(String(completedPolicy.last_notified_at)).getTime()).toBe(
			new Date(historicalNotificationAt).getTime(),
		);

		const undoCompletion = await editor.request.patch(`/api/obras/${obra.id}`, {
			data: { porcentaje: 50 },
		});
		expect(undoCompletion.ok()).toBe(true);
		const incompletePolicy = await readStoredPolicy(owner.db, policy.id);
		expect(incompletePolicy).toMatchObject({
			obra_finished_at: null,
			calculated_cancellation_date: null,
			cancellation_requested_at: "2026-10-19",
			cancellation_notes: "conservar gestion de baja",
			notes: "conservar nota operativa",
			is_cancelled: false,
			last_notified_at: null,
		});
		expect(await readStoredPolicy(owner.db, definitivePolicy.id)).toMatchObject({
			obra_finished_at: null,
			calculated_cancellation_date: "2026-09-15",
			notes: "base definitiva conservada",
		});
		expect(await readStoredPolicy(owner.db, unconfiguredPolicy.id)).toMatchObject({
			obra_finished_at: null,
			calculated_cancellation_date: null,
		});
		expect(await readStoredPolicy(owner.db, unrelatedPolicy.id)).toMatchObject(unrelatedWitness);
		expect(await readStoredPolicy(otherOwner.db, foreignPolicy.id)).toMatchObject(foreignWitness);

		const recomplete = await editor.request.patch(`/api/obras/${obra.id}`, {
			data: { porcentaje: 100 },
		});
		expect(recomplete.ok()).toBe(true);
		const recompletedPolicy = await readStoredPolicy(owner.db, policy.id);
		expect(recompletedPolicy.obra_finished_at).toBe(new Date().toISOString().slice(0, 10));

		await setObraPercentageViaFullSync(editor.request, obra.id, 40);
		expect(await readStoredPolicy(owner.db, policy.id)).toMatchObject({
			obra_finished_at: null,
			calculated_cancellation_date: null,
		});
		expect(await readStoredPolicy(owner.db, definitivePolicy.id)).toMatchObject({
			obra_finished_at: null,
			calculated_cancellation_date: "2026-09-15",
		});
		await setObraPercentageViaFullSync(editor.request, obra.id, 100);
		const bulkCompletedAt = new Date().toISOString().slice(0, 10);
		expect(await readStoredPolicy(owner.db, policy.id)).toMatchObject({
			obra_finished_at: bulkCompletedAt,
			calculated_cancellation_date: expect.any(String),
		});
		expect(await readStoredPolicy(owner.db, unconfiguredPolicy.id)).toMatchObject({
			obra_finished_at: bulkCompletedAt,
			calculated_cancellation_date: null,
		});
		expect(await readStoredPolicy(owner.db, unrelatedPolicy.id)).toMatchObject(unrelatedWitness);
		expect(await readStoredPolicy(otherOwner.db, foreignPolicy.id)).toMatchObject(foreignWitness);
	});

	test("imports matched and unmatched policies, then requests and confirms cancellation across reloads", async ({
		page,
		request,
		scenario,
	}) => {
		const obraName = `${scenario.namespace} poliza vinculada`;
		const obra = await createObraViaBulkApi(request, {
			designacionYUbicacion: obraName,
		});
		const matchedPolicyNumber = `${scenario.namespace}-POL-M`;
		const unmatchedPolicyNumber = `${scenario.namespace}-POL-U`;
		const workbook = buildInsurancePolicyWorkbook([
			{ policyNumber: matchedPolicyNumber, obra: obraName },
			{ policyNumber: unmatchedPolicyNumber, obra: "Obra inexistente E2E" },
		]);

		await openPoliciesWorkspace(page);
		const previewResponse = page.waitForResponse(
			(response) => response.url().endsWith("/api/insurance-policies/import") && response.request().method() === "POST",
		);
		await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles({
			name: `${scenario.namespace}-polizas.xlsx`,
			mimeType: XLSX_MIME,
			buffer: workbook,
		});
		expect((await previewResponse).ok()).toBe(true);
		const review = page.getByRole("dialog", { name: "Revisar importacion de polizas" });
		await expect(review).toBeVisible();
		await expect(review.locator("tr", { hasText: matchedPolicyNumber })).toContainText(obraName);
		await expect(review.locator("tr", { hasText: unmatchedPolicyNumber })).toContainText("No se encontró obra adecuada");

		const confirmResponse = page.waitForResponse(
			(response) => response.url().endsWith("/api/insurance-policies/import") && response.request().method() === "POST",
		);
		await review.getByRole("button", { name: "Confirmar importacion" }).click();
		expect((await confirmResponse).ok()).toBe(true);
		await expect(review).toBeHidden();

		await expect.poll(async () => (await findInsurancePolicy(request, matchedPolicyNumber)).obra_id).toBe(obra.id);
		const unmatched = await findInsurancePolicy(request, unmatchedPolicyNumber);
		expect(unmatched.obra_id).toBeNull();
		expect(unmatched.import_match_status).toBe("unmatched");
		const perObraResponse = await request.get(`/api/obras/${obra.id}/insurance-policies`);
		expect(perObraResponse.ok()).toBe(true);
		const perObraBody = await perObraResponse.text();
		expect(perObraBody).toContain(matchedPolicyNumber);
		expect(perObraBody).not.toContain(unmatchedPolicyNumber);

		let row = await searchPolicy(page, matchedPolicyNumber);
		await row.getByRole("button", { name: "Editar" }).click();
		let dialog = page.getByRole("dialog", { name: matchedPolicyNumber });
		const cancellationSection = dialog.locator("section", { hasText: "Gestión de baja" });
		await cancellationSection.getByRole("button", { name: "Editar" }).click();
		await dialog.getByLabel("Baja solicitada").fill("2026-10-20");
		await dialog.getByLabel("Notas de gestión").fill("Solicitud enviada al productor");
		const matched = await findInsurancePolicy(request, matchedPolicyNumber);
		const matchedCancellation = page.waitForResponse(
			(response) => response.url().endsWith(`/api/insurance-policies/${matched.id}`) && response.request().method() === "PATCH",
		);
		await dialog.getByRole("button", { name: "Guardar cambios" }).click();
		expect((await matchedCancellation).ok()).toBe(true);

		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
		await openPoliciesWorkspace(page);
		row = await searchPolicy(page, matchedPolicyNumber);
		await expect(row).toContainText("Baja solicitada");
		await row.getByRole("button", { name: "Editar" }).click();
		dialog = page.getByRole("dialog", { name: matchedPolicyNumber });
		const confirmSection = dialog.locator("section", { hasText: "Gestión de baja" });
		await confirmSection.getByRole("button", { name: "Editar" }).click();
		await dialog.getByLabel("Baja confirmada").fill("2026-10-21");
		await dialog.getByLabel("Notas de gestión").fill("Baja confirmada por el productor");
		const confirmCancellation = page.waitForResponse(
			(response) => response.url().endsWith(`/api/insurance-policies/${matched.id}`) && response.request().method() === "PATCH",
		);
		await dialog.getByRole("button", { name: "Guardar cambios" }).click();
		expect((await confirmCancellation).ok()).toBe(true);

		await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
		await openPoliciesWorkspace(page);
		row = await searchPolicy(page, matchedPolicyNumber);
		await expect(row).toContainText("Baja confirmada");
		const confirmed = await findInsurancePolicy(request, matchedPolicyNumber);
		expect(confirmed).toMatchObject({
			cancellation_requested_at: "2026-10-20",
			cancellation_confirmed_at: "2026-10-21",
			cancellation_notes: "Baja confirmada por el productor",
		});
	});

	test("enforces tenant and insurance-policies:manage denials while preserving owner recovery", async ({ scenario }) => {
		const owner = await scenario.actor("owner");
		const viewer = await scenario.actor("viewer");
		const otherOwner = await scenario.actor("otherOwner");
		const obraName = `${scenario.namespace} poliza permisos`;
		const obra = await createObraViaBulkApi(owner.request, { designacionYUbicacion: obraName });
		const policyNumber = `${scenario.namespace}-POL-PERM`;
		const workbook = buildInsurancePolicyWorkbook([{ policyNumber, obra: obraName }]);
		const preview = await previewInsuranceImport(owner.request, workbook, `${scenario.namespace}-owner.xlsx`);
		await confirmInsuranceImport(owner.request, preview.preview);
		const policy = await findInsurancePolicy(owner.request, policyNumber);
		expect(policy.obra_id).toBe(obra.id);

		const otherPolicies = await listInsurancePolicies(otherOwner.request, policyNumber);
		expect(otherPolicies).toEqual([]);
		const otherPatch = await otherOwner.request.patch(`/api/insurance-policies/${policy.id}`, {
			data: { cancellationRequestedAt: "2026-10-20" },
		});
		expect([403, 404]).toContain(otherPatch.status());

		await scenario.permissions.seedUserOverride("viewer", "insurance-policies:manage", {
			tenant: "a",
			decision: "deny",
		});
		const deniedPatch = await viewer.request.patch(`/api/insurance-policies/${policy.id}`, {
			data: {
				cancellationRequestedAt: "2026-10-20",
				cancellationNotes: "viewer no autorizado",
			},
		});
		expect.soft(deniedPatch.status(), "insurance-policies:manage deny must be enforced by PATCH").toBe(403);
		const deniedImport = await viewer.request.post("/api/insurance-policies/import", {
			multipart: {
				file: {
					name: `${scenario.namespace}-viewer.xlsx`,
					mimeType: XLSX_MIME,
					buffer: workbook,
				},
			},
		});
		expect.soft(deniedImport.status(), "insurance-policies:manage deny must be enforced by import").toBe(403);
		const deniedCreate = await viewer.request.post(`/api/obras/${obra.id}/insurance-policies`, {
			data: { policyNumber: `${scenario.namespace}-POL-VIEWER` },
		});
		expect.soft(deniedCreate.status(), "insurance-policies:manage deny must be enforced by create").toBe(403);
		const deniedDelete = await viewer.request.delete(`/api/insurance-policies/${policy.id}`);
		expect.soft(deniedDelete.status(), "insurance-policies:manage deny must be enforced by delete").toBe(403);
		const afterDeniedPatch = await findInsurancePolicy(owner.request, policyNumber);
		expect.soft(afterDeniedPatch.cancellation_notes).not.toBe("viewer no autorizado");

		const ownerRecovery = await owner.request.patch(`/api/insurance-policies/${policy.id}`, {
			data: {
				cancellationRequestedAt: "2026-10-22",
				cancellationNotes: "owner recupera el flujo",
			},
		});
		expect(ownerRecovery.ok()).toBe(true);
		const recovered = await findInsurancePolicy(owner.request, policyNumber);
		expect(recovered).toMatchObject({
			cancellation_requested_at: "2026-10-22",
			cancellation_notes: "owner recupera el flujo",
		});

		const ownerCreateNumber = `${scenario.namespace}-POL-OWNER-CREATE`;
		const ownerCreate = await owner.request.post(`/api/obras/${obra.id}/insurance-policies`, {
			data: { policyNumber: ownerCreateNumber },
		});
		expect(ownerCreate.ok()).toBe(true);
		expect((await findInsurancePolicy(owner.request, ownerCreateNumber)).obra_id).toBe(obra.id);
		const ownerDelete = await owner.request.delete(`/api/insurance-policies/${policy.id}`);
		expect(ownerDelete.ok()).toBe(true);
		expect((await listInsurancePolicies(owner.request, policyNumber)).some((item) => item.id === policy.id)).toBe(false);
	});
});

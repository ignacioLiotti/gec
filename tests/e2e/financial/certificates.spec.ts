import { createObraViaBulkApi } from "../helpers/obras";
import { expect, test } from "../fixtures/test";
import {
	createCertificate,
	checkFormTableCheckbox,
	editFormTableCell,
	formTableCell,
	listObraCertificates,
	patchCertificate,
} from "./financial-workflows";

test.describe("certificate invoicing and collection", () => {
	test("creates certificates and carries invoicing through collection without changing the certified total", async ({
		page,
		request,
		scenario,
	}) => {
		const obraName = `${scenario.namespace} certificado financiero`;
		const obra = await createObraViaBulkApi(request, {
			designacionYUbicacion: obraName,
			entidadContratante: "Ente E2E financiero",
		});
		const first = await createCertificate(request, obra.id, {
			nExp: `${scenario.namespace}-EXP-1`,
			nCertificate: 1,
			amount: 95_000.5,
			month: "2026-09",
		});
		await createCertificate(request, obra.id, {
			nExp: `${scenario.namespace}-EXP-2`,
			nCertificate: 2,
			amount: 50_000.25,
			month: "2026-10",
		});

		const created = await listObraCertificates(request, obra.id);
		expect(created.certificates.map((certificate) => certificate.n_certificado)).toEqual([1, 2]);
		expect(created.certificates.map((certificate) => certificate.monto)).toEqual([
			95_000.5,
			50_000.25,
		]);
		expect(created.total).toBe(145_000.75);

		await page.goto("/certificados", { waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Certificados por obra" })).toBeVisible();
		await page.getByTestId("form-table-search").fill(obraName);
		await expect(page.locator(`tr[data-row-id="${first.id}"]`)).toBeVisible();

		await checkFormTableCheckbox(page, first.id, "facturado");
		await editFormTableCell(page, first.id, "fecha_facturacion", "fecha_facturacion", "2026-10-01");
		await editFormTableCell(page, first.id, "nro_factura", "nro_factura", "FC-E2E-001");
		await editFormTableCell(page, first.id, "concepto", "concepto", "Avance certificado septiembre");
		const invoiceSave = page.waitForResponse(
			(response) => response.url().endsWith(`/api/certificados/${first.id}`) && response.request().method() === "PATCH",
		);
		await page.getByTestId("form-table-save").click();
		expect((await invoiceSave).status()).toBe(200);

		await page.reload({ waitUntil: "domcontentloaded" });
		await page.getByTestId("form-table-search").fill("FC-E2E-001");
		await expect(formTableCell(page, first.id, "nro_factura")).toContainText("FC-E2E-001");
		await expect(formTableCell(page, first.id, "facturado")).toContainText("Sí");

		await checkFormTableCheckbox(page, first.id, "cobrado");
		await editFormTableCell(page, first.id, "fecha_pago", "fecha_pago", "2026-10-15");
		const collectionSave = page.waitForResponse(
			(response) => response.url().endsWith(`/api/certificados/${first.id}`) && response.request().method() === "PATCH",
		);
		await page.getByTestId("form-table-save").click();
		expect((await collectionSave).status()).toBe(200);

		await page.reload({ waitUntil: "domcontentloaded" });
		await page.getByTestId("form-table-search").fill("FC-E2E-001");
		await expect(formTableCell(page, first.id, "facturado")).toContainText("Sí");
		await expect(formTableCell(page, first.id, "cobrado")).toContainText("Sí");

		const collected = await listObraCertificates(request, obra.id);
		const collectedFirst = collected.certificates.find((certificate) => certificate.id === first.id);
		expect(collectedFirst).toMatchObject({
			facturado: true,
			fecha_facturacion: "2026-10-01",
			nro_factura: "FC-E2E-001",
			concepto: "Avance certificado septiembre",
			cobrado: true,
			fecha_pago: "2026-10-15",
		});
		expect(collected.total).toBe(145_000.75);
	});

	test("enforces certificate create, edit, and delete boundaries while allowing owner recovery", async ({ scenario }) => {
		const owner = await scenario.actor("owner");
		const viewer = await scenario.actor("viewer");
		const otherOwner = await scenario.actor("otherOwner");
		const ownerObra = await createObraViaBulkApi(owner.request, {
			designacionYUbicacion: `${scenario.namespace} certificado permisos`,
		});
		const otherObra = await createObraViaBulkApi(otherOwner.request, {
			designacionYUbicacion: `${scenario.namespace} certificado tenant B`,
		});
		const deletedObra = await createObraViaBulkApi(owner.request, {
			designacionYUbicacion: `${scenario.namespace} certificado obra eliminada`,
		});
		const certificate = await createCertificate(owner.request, ownerObra.id, {
			nExp: `${scenario.namespace}-PERM`,
			nCertificate: 1,
			amount: 10_000,
			month: "2026-10",
		});
		const otherCertificate = await createCertificate(otherOwner.request, otherObra.id, {
			nExp: `${scenario.namespace}-OTHER`,
			nCertificate: 1,
			amount: 20_000,
			month: "2026-10",
		});

		const crossTenantRead = await listObraCertificates(owner.request, otherObra.id);
		expect(crossTenantRead.certificates).toEqual([]);
		expect(crossTenantRead.total).toBe(0);
		const crossTenantPatch = await patchCertificate(owner.request, otherCertificate.id, {
			concepto: "intento cruzado",
		});
		expect.soft(
			crossTenantPatch.status(),
			"cross-tenant certificate PATCH must hide the record",
		).toBe(404);
		const crossTenantCreate = await owner.request.post(`/api/obras/${otherObra.id}/certificates`, {
			data: {
				n_exp: `${scenario.namespace}-FOREIGN-OBRA`,
				n_certificado: 99,
				monto: 1,
				mes: "2026-10",
			},
		});
		expect.soft(
			crossTenantCreate.status(),
			"certificate create must prove the obra belongs to the active tenant",
		).toBe(404);

		const deleteParent = await owner.request.delete(`/api/obras/${deletedObra.id}`);
		expect(deleteParent.status()).toBe(200);
		const deletedParentCreate = await owner.request.post(`/api/obras/${deletedObra.id}/certificates`, {
			data: {
				n_exp: `${scenario.namespace}-DELETED-OBRA`,
				n_certificado: 1,
				monto: 1,
				mes: "2026-10",
			},
		});
		expect.soft(
			deletedParentCreate.status(),
			"certificate create must reject a deleted parent obra",
		).toBe(404);

		await scenario.permissions.seedUserOverride("viewer", "certificados:edit", {
			tenant: "a",
			decision: "deny",
		});
		await scenario.permissions.seedUserOverride("viewer", "certificados:admin", {
			tenant: "a",
			decision: "deny",
		});
		const deniedCreate = await viewer.request.post(`/api/obras/${ownerObra.id}/certificates`, {
			data: {
				n_exp: `${scenario.namespace}-VIEWER-CREATE`,
				n_certificado: 2,
				monto: 1,
				mes: "2026-10",
			},
		});
		expect.soft(deniedCreate.status(), "certificados:edit deny must block certificate creation").toBe(403);
		const deniedEdit = await patchCertificate(viewer.request, certificate.id, {
			concepto: "cambio no autorizado",
		});
		expect.soft(deniedEdit.status(), "certificados:edit deny must be enforced by the mutation route").toBe(403);
		const deniedDelete = await viewer.request.delete(`/api/certificados/${certificate.id}`);
		expect.soft(deniedDelete.status(), "certificados:admin deny must block certificate deletion").toBe(403);
		const afterDeniedEdit = await listObraCertificates(owner.request, ownerObra.id);
		expect.soft(afterDeniedEdit.certificates[0]?.concepto).not.toBe("cambio no autorizado");

		const recovery = await patchCertificate(owner.request, certificate.id, {
			concepto: "recuperado por owner",
		});
		expect(recovery.ok()).toBe(true);
		const recovered = await listObraCertificates(owner.request, ownerObra.id);
		expect(recovered.certificates[0]?.concepto).toBe("recuperado por owner");

		const ownerDelete = await owner.request.delete(`/api/certificados/${certificate.id}`);
		expect(ownerDelete.status()).toBe(200);
		const afterOwnerDelete = await listObraCertificates(owner.request, ownerObra.id);
		expect(afterOwnerDelete.certificates).toEqual([]);
		expect(afterOwnerDelete.total).toBe(0);
	});
});

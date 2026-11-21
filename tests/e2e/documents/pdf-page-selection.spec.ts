import { z } from "zod";

import { expect, test } from "../fixtures/test";
import { withRegisteredOcrProviderFixture } from "../helpers/ocr-provider";

function twoPagePdf() {
	const firstPageStream = "BT /F1 12 Tf 24 72 Td (PAGE ONE MUST BE EXCLUDED) Tj ET\n";
	const secondPageStream = "BT /F1 12 Tf 24 72 Td (PAGE TWO SELECTED AMOUNT 42) Tj ET\n";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
		`<< /Length ${Buffer.byteLength(firstPageStream)} >>\nstream\n${firstPageStream}endstream`,
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
		`<< /Length ${Buffer.byteLength(secondPageStream)} >>\nstream\n${secondPageStream}endstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	let body = "%PDF-1.4\n";
	const offsets = [0];
	objects.forEach((value, index) => {
		offsets.push(Buffer.byteLength(body));
		body += `${index + 1} 0 obj\n${value}\nendobj\n`;
	});
	const xref = Buffer.byteLength(body);
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	body += offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("");
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return { name: "select-second-page.pdf", mimeType: "application/pdf", buffer: Buffer.from(body) };
}

test("cancels PDF extraction without rows then sends only the user's selected page scope to OCR", async ({ page, scenario }, testInfo) => {
	test.setTimeout(180_000);
	page.setDefaultTimeout(15_000);
	page.setDefaultNavigationTimeout(60_000);
	const owner = await scenario.actor("owner");
	const target = await scenario.lineage.createSingle("PDF page selection");
	const table = await owner.db.from("obra_tablas").select("settings").eq("id", target.tablaId).single();
	expect(table.error).toBeNull();
	const settings = z.object({ ocrFolder: z.string().min(1) }).parse(table.data?.settings);
	const label = settings.ocrFolder.split("/").at(-1)?.replace(/[-_]+/g, " ");
	if (!label) throw new Error("The extraction folder has no label.");
	const source = twoPagePdf();
	const sourcePath = `${target.obraId}/${settings.ocrFolder}/${source.name}`;
	await withRegisteredOcrProviderFixture({
		namespace: `${scenario.namespace}-selected-pdf-page`, source,
		requiredPromptText: "Analiza exclusivamente las paginas 2 del PDF. Ignora las demas paginas.",
		extraction: { tables: { [target.tablaId]: { items: [{ item_code: "PAGE-2", description: "Selected page", amount: 42 }] } } },
	}, async provider => {
		await page.goto(`/excel/${target.obraId}?tab=documentos`);
		await expect(page.getByRole("heading", { name: "Todos los documentos", exact: true })).toBeVisible();
		await page.getByTitle(new RegExp(`^${label}$`, "i")).first().click();
		const chooser = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: "Subir archivos", exact: true }).click();
		await (await chooser).setFiles(source);
		const dialog = page.getByRole("dialog", { name: "Seleccionar páginas para OCR" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText("PDF con 2 páginas", { exact: true })).toBeVisible();
		await dialog.getByRole("button", { name: "Limpiar", exact: true }).click();
		await expect(dialog.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
		await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
		await expect(dialog).toHaveCount(0);
		expect((await provider.read()).requests).toEqual([]);
		const empty = await owner.db.from("obra_tabla_rows").select("id").eq("tabla_id", target.tablaId);
		expect(empty.error).toBeNull();
		expect(empty.data).toEqual([]);
		const uploaded = await owner.db.storage.from("obra-documents").download(sourcePath);
		expect(uploaded.error).toBeNull();
		if (!uploaded.data) throw new Error("The canceled extraction lost its uploaded PDF.");
		expect(Buffer.from(await uploaded.data.arrayBuffer()).equals(source.buffer)).toBe(true);
		await page.getByRole("button").filter({ hasText: source.name }).first().click();
		await expect(page.locator(".react-pdf__Page canvas").first()).toBeVisible();
		await expect(page.locator(".react-pdf__Page__textContent").first()).toContainText("PAGE ONE MUST BE EXCLUDED");
		await page.getByRole("button", { name: "Reprocesar OCR", exact: true }).click();
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Limpiar", exact: true }).click();
		await dialog.getByTestId("pdf-page-option-2").click();
		await expect(dialog.getByText("Seleccionadas: 2.", { exact: true })).toBeVisible();
		await testInfo.attach("second-page-selected", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
		const imported = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/obras/${target.obraId}/tablas/import/ocr-multi`);
		await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
		expect((await imported).status()).toBe(200);
		const observed = await provider.read();
		expect(observed.requests).toHaveLength(1);
		expect(observed.requests[0]?.promptRequirementMet).toBe(true);
		const rows = await owner.db.from("obra_tabla_rows").select("data, source").eq("tabla_id", target.tablaId);
		expect(rows.error).toBeNull();
		expect(rows.data).toEqual([{ source: "ocr", data: { item_code: "PAGE-2", description: "Selected page", amount: 42, __docBucket: "obra-documents", __docPath: sourcePath, __docFileName: source.name, __docSelectedPages: [2] } }]);
	});
});

import { readFile } from "node:fs/promises";
import { expect, test } from "../fixtures/test";

test("exports invoice months and the historical certificate month as numeric amounts", async ({ page }) => {
  test.setTimeout(100_000);
  const columns = [
    { id: "billed", label: "Facturado", dataType: "boolean" },
    { id: "amount", sourceFieldKey: "monto_certificado" },
    { id: "date", sourceFieldKey: "fecha_certificacion" },
    { id: "number", sourceFieldKey: "nro_certificado" },
  ];
  await page.route("**/api/certificados/facturacion?year=2026", (route) => route.fulfill({ json: {
    rows: [{ obra_id: "obra-52", n_certificado: 1, monto: 1000000, fecha_facturacion: "2026-01-15", obras: { n: 52 } }],
  } }));
  await page.route("**/api/macro-tables", (route) => route.fulfill({ json: {
    macroTables: [{ id: "historic", name: "Certificados - Contable", columns }],
  } }));
  await page.route("**/api/macro-tables/historic/rows?*", (route) => route.fulfill({ json: {
    rows: [
      { _obraId: "obra-52", _obraName: "52", billed: true, amount: "900", date: "12/01/2026", number: 1 },
      { _obraId: "obra-52", _obraName: "52", billed: true, amount: "2.000.000,25", date: "21/02/2026", number: 2 },
      { _obraId: "obra-103", _obraName: "103", billed: true, amount: "30000000", date: "2026-03-12", number: 1 },
      { _obraId: "obra-103", _obraName: "103", billed: false, amount: "50", date: "2026-02-12", number: 2 },
    ],
    pagination: { hasNextPage: false },
  } }));
  await page.goto("/certificados");
  await page.getByRole("spinbutton", { name: "Año de facturación" }).fill("2026");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar facturación mensual" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("certificados-facturados-2026.xlsx");
  const path = await download.path();
  const xlsx = await import("xlsx");
  const book = xlsx.read(await readFile(path), { type: "buffer" });
  const summary = xlsx.utils.sheet_to_json<Array<string | number>>(book.Sheets["Por obra y mes"], { header: 1 });
  expect(summary[1].slice(0, 4)).toEqual(["52", 1000000, 2000000.25, 0]);
  expect(summary[2].slice(0, 4)).toEqual(["103", 0, 0, 30000000]);
  expect(book.SheetNames).toContain("Criterios");
});

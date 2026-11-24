import { expect, test } from "../fixtures/test";
import { buildExcelObraName, createObraViaBulkApi } from "../helpers/obras";

test("sends the exact storage filename to trash through Documentos", async ({ page, scenario }) => {
  test.setTimeout(120_000);
  const owner = await scenario.actor("owner");
  const obra = await createObraViaBulkApi(owner.request, {
    designacionYUbicacion: buildExcelObraName(scenario.namespace + " exact delete"),
  });
  const filename = "Factura Noviembre.TXT";
  const path = obra.id + "/ordenes-de-compra/" + filename;
  const upload = await owner.db.storage.from("obra-documents").upload(path, Buffer.from("documento de prueba"), { contentType: "text/plain" });
  expect(upload.error).toBeNull();

  await page.goto("/excel/" + obra.id + "?tab=documentos-new&folder=ordenes-de-compra");
  const card = page.getByRole("button").filter({ hasText: filename }).first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("tab", { name: "Documentos", exact: true })).toHaveCount(1);
  await card.click({ button: "right" });
  await page.getByRole("button", { name: "Enviar a papelera", exact: true }).click();
  const deletion = page.waitForResponse((response) => response.url().endsWith("/documents/deletes") && response.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Enviar a papelera", exact: true }).click();
  const result = await deletion;
  expect(result.status(), await result.text()).toBe(200);
  expect(await result.json()).toMatchObject({ storagePath: path, deletedPaths: [path] });
  await expect(card).toHaveCount(0);
});

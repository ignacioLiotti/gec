import { expect, test } from "../fixtures/test";

test("hides unpublished templates from generation and publishes them again without changing their config", async ({ scenario }) => {
  test.setTimeout(120_000);
  const owner = await scenario.actor("owner");
  const catalog = await owner.request.get("/api/document-generation/templates");
  expect(catalog.ok()).toBe(true);
  const { templates } = await catalog.json();
  const invoice = templates.find((entry: { documentType: string }) => entry.documentType === "INVOICE");
  expect(invoice.status).toBe("active");

  const page = await owner.context.newPage();
  await page.goto("/document-generation/config");
  const changeResponse = () => page.waitForResponse((response) =>
    response.url().endsWith("/api/document-generation/templates") && response.request().method() === "PATCH",
  );
  const configuration = page.getByRole("button").filter({ has: page.getByText(invoice.name, { exact: true }) });
  const tile = configuration.locator("..");
  const hiding = changeResponse();
  await tile.getByRole("button", { name: "Pasar a borrador" }).click({ timeout: 40_000 });
  const response = await hiding;
  expect(response.status(), await response.text()).toBe(200);
  const hidden = (await response.json()).template;
  expect(hidden).toMatchObject({ status: "draft", contentHtml: invoice.contentHtml, tenantScoped: true });
  expect(hidden.schema).toEqual(invoice.schema);
  await expect(tile.getByText("Borrador", { exact: true })).toBeVisible();

  const bootstrap = await owner.request.get("/api/document-generation/bootstrap?documentType=INVOICE");
  expect(bootstrap.ok()).toBe(true);
  const { allTemplates, context } = await bootstrap.json();
  expect(allTemplates.map((entry: { documentType: string }) => entry.documentType)).not.toContain("INVOICE");
  expect(allTemplates.map((entry: { documentType: string }) => entry.documentType)).toContain("PURCHASE_ORDER");
  expect(context.allowedDocumentTypes).not.toContain("INVOICE");

  const publishing = changeResponse();
  await tile.getByRole("button", { name: "Publicar plantilla" }).click();
  const publish = await publishing;
  expect(publish.status(), await publish.text()).toBe(200);
  const refreshed = await owner.request.get("/api/document-generation/bootstrap?documentType=INVOICE");
  expect((await refreshed.json()).context.selectedTemplate).toMatchObject({ id: hidden.id, status: "active" });
  await expect(tile.getByText("Publicada", { exact: true })).toBeVisible();
  await page.close();
});

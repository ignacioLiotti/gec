import { z } from "zod";

import { expect, test } from "../fixtures/test";

/**
 * The template assistant calls OpenAI, which the isolated test stack cannot
 * reach. The browser request is answered here with replies recorded from the
 * real model, so the test covers the builder flow: file drop, applying a
 * validated spec, follow-up edits, undo and publishing.
 */

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function invoiceSpec(name: string) {
  return {
    version: 1,
    name,
    documentType: "FACTURA_COMPRA_E2E",
    targetFolderPath: "documentos-e2e",
    sections: [
      { kind: "header" },
      {
        kind: "fields",
        title: "Proveedor",
        fields: [
          { key: "proveedor", label: "Proveedor", type: "text", required: true },
          { key: "cuit", label: "CUIT", type: "text" },
          { key: "quien_recibe", label: "Quien recibe", type: "reference", reference: { source: "usuarios", display: "nombre", match: "email" } },
          { key: "email_quien_recibe", label: "Email de quien recibe", type: "lookup", lookup: { from: "quien_recibe", attribute: "email" } },
        ],
      },
      {
        kind: "table",
        key: "items",
        title: "Ítems",
        columns: [
          { key: "descripcion", label: "Descripción", type: "text" },
          { key: "cantidad", label: "Cantidad", type: "number" },
          { key: "precio_unitario", label: "Precio unitario", type: "money" },
        ],
      },
      { kind: "signatures", labels: ["Quien recibe"] },
    ],
  };
}

const requestSchema = z.object({
  spec: z.object({ sections: z.array(z.unknown()) }).passthrough(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  attachment: z.object({ name: z.string(), mimeType: z.string(), dataUrl: z.string() }).nullable(),
});

test("the template assistant builds a template from a document and edits it by chat", async ({ scenario }, testInfo) => {
  test.setTimeout(150_000);
  const owner = await scenario.actor("owner");
  const name = `${scenario.namespace} Factura asistente`;

  // Without OPENAI_API_KEY the endpoint explains it is not configured.
  const unconfigured = await owner.request.post("/api/document-generation/assistant", {
    data: { spec: invoiceSpec(name), messages: [{ role: "user", content: "Hola" }] },
  });
  expect(unconfigured.status()).toBe(503);

  const page = await owner.context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);

  const requests: Array<z.infer<typeof requestSchema>> = [];
  const replies = [
    { reply: "Armé **Factura de compra** con proveedor, quien recibe, ítems y firma.", changes: ["+ Proveedor", "+ tabla Ítems"], spec: invoiceSpec(name) },
    (() => {
      const spec = invoiceSpec(name);
      (spec.sections[2] as { columns: unknown[] }).columns.push({ key: "total", label: "Total", type: "formula", formula: "[cantidad] * [precio_unitario]" });
      return { reply: "Agregué **Total** a la tabla.", changes: ["+ columna Total", "fx Cantidad × Precio unitario"], spec: { ...spec, style: { accent: "#2563eb" } } };
    })(),
  ];
  await page.route("**/api/document-generation/assistant", async (route) => {
    requests.push(requestSchema.parse(route.request().postDataJSON()));
    const reply = replies[requests.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });

  await page.goto("/document-generation/builder?new=1");
  await page.getByRole("button", { name: "Asistente", exact: true }).click();
  await expect(page.getByText("Soltá una foto o PDF del documento")).toBeVisible();
  // The side panels fade out and stop taking focus or clicks.
  await expect(page.locator("aside[inert]")).toHaveCount(2);

  // 1. Dropping a document creates the template.
  await page.locator('label input[type="file"]').setInputFiles({ name: "factura.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
  await expect(page.getByText("factura.png").first()).toBeVisible();
  // The assistant shows the printed document itself.
  await expect(page.getByText("Quien recibe:", { exact: true })).toBeVisible();
  await expect(page.locator("[data-k=\"c:items.descripcion\"]")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath("assistant-document.png") });
  await expect(page.getByText("Armé")).toBeVisible();
  expect(requests[0].attachment?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  expect(requests[0].messages.at(-1)).toEqual({ role: "user", content: "Armá una plantilla a partir de factura.png." });

  // 2. A follow-up edit goes with the current spec and the conversation.
  await page.getByRole("textbox", { name: "Pedido al asistente" }).fill("Agregá una columna Total y usá azul");
  await page.getByRole("button", { name: "Enviar" }).click();
  const totalColumn = page.locator("[data-k=\"c:items.total\"]");
  await expect(page.getByText("Agregué")).toBeVisible();
  await expect(totalColumn).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath("assistant-edit.png") });
  expect(requests[1].attachment).toBeNull();
  expect(requests[1].messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
  expect(JSON.stringify(requests[1].spec)).toContain("quien_recibe");

  // 3. Undo restores the spec before the last answer.
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(totalColumn).toHaveCount(0);
  await expect(page.getByText("Deshecho")).toBeVisible();

  // 4. Back in the editor the side panels return and the template publishes.
  await page.getByRole("button", { name: "Volver al editor" }).click();
  await expect(page.getByText("Agregar campo")).toBeVisible();
  const publishResponse = page.waitForResponse((response) => response.url().includes("/api/document-generation/templates") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  const published = await publishResponse;
  expect(published.status(), await published.text()).toBe(200);
  const template = z.object({ template: z.object({ schema: z.object({ fields: z.array(z.object({ key: z.string(), type: z.string() }).passthrough()) }).passthrough() }).passthrough() }).parse(await published.json()).template;
  expect(template.schema.fields.find((field) => field.key === "quien_recibe")?.type).toBe("reference");
});

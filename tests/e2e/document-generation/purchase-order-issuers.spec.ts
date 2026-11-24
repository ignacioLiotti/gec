import { expect, test } from "../fixtures/test";

test("publishes two different issuer templates once and preserves the base order", async ({ scenario }) => {
  const owner = await scenario.actor("owner");
  const catalog = await owner.request.get("/api/document-generation/templates");
  expect(catalog.ok()).toBe(true);
  const { templates } = await catalog.json();
  const original = templates.find((template: { key: string }) => template.key === "purchase-order-default");
  const sourceHtml = '<div class="brand"><span>GEC SA</span></div><p class="company-copy">GEC</p><p>{{orderNumber}}</p>';
  const base = await owner.db.from("document_generation_templates").insert({
    tenant_id: scenario.tenants.a,
    key: original.key,
    name: "OC original",
    version: 1,
    document_type: "PURCHASE_ORDER",
    target_folder_path: "ordenes-de-compra",
    status: "active",
    schema: original.schema,
    content_html: sourceHtml,
  });
  expect(base.error).toBeNull();

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await owner.request.post("/api/document-generation/templates/issuers");
    expect(result.status(), await result.text()).toBe(200);
    const rows = (await result.json()).templates as Array<{ key: string; contentHtml: string }>;
    const concret = rows.filter((row) => row.key === "purchase-order-concret-libres");
    const libresmat = rows.filter((row) => row.key === "purchase-order-libresmat");
    expect(concret).toHaveLength(1);
    expect(libresmat).toHaveLength(1);
    expect(concret[0].contentHtml).toContain("30-71173998-6");
    expect(libresmat[0].contentHtml).toContain("30-71523462-5");
    expect(concret[0].contentHtml).toContain("data:image/jpeg;base64,");
    expect(libresmat[0].contentHtml).toContain("{{orderNumber}}");
    expect(rows.find((row) => row.key === original.key)?.contentHtml).toBe(sourceHtml);
  }
});

import { expect, test } from "../fixtures/test";
import { buildExcelObraName, createObraViaBulkApi } from "../helpers/obras";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA2QAAAAASUVORK5CYII=",
  "base64",
);

test("reuses an authorized thumbnail after a page reload and hides it if access is denied", async ({ page, scenario }) => {
  test.setTimeout(120_000);
  const owner = await scenario.actor("owner");
  const obra = await createObraViaBulkApi(owner.request, {
    designacionYUbicacion: buildExcelObraName(`${scenario.namespace} thumbnails`),
  });
  const filename = "thumbnail-fixture.png";
  const path = `${obra.id}/ordenes-de-compra/${filename}`;
  const upload = await owner.db.storage.from("obra-documents").upload(path, PNG, { contentType: "image/png" });
  expect(upload.error).toBeNull();

  const batchPattern = `**/api/obras/${obra.id}/documents/access/batch`;
  let authorizations = 0;
  let coverRequests = 0;
  let denyAccess = false;
  await page.route(batchPattern, (route) => {
    authorizations++;
    return denyAccess ? route.fulfill({ status: 403 }) : route.continue();
  });
  page.on("request", (request) => {
    if (request.url().includes("/documents/access?") && request.url().includes("thumbnail=1")) coverRequests++;
  });

  await page.goto(`/excel/${obra.id}?tab=documentos-new&folder=ordenes-de-compra`);
  const cover = page.getByRole("img", { name: filename, exact: true });
  await expect(cover).toHaveAttribute("src", /^blob:/, { timeout: 25_000 });
  await expect.poll(() => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
  expect(coverRequests).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("sintesis-document-thumbnails");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      if (!open.result.objectStoreNames.contains("thumbnails")) {
        open.result.close();
        resolve(0);
        return;
      }
      const query = open.result.transaction("thumbnails").objectStore("thumbnails").count();
      query.onerror = () => reject(query.error);
      query.onsuccess = () => resolve(query.result);
      query.transaction?.addEventListener("complete", () => open.result.close());
    };
  }))).toBe(1);

  const coldRequests = coverRequests;
  const coldAuthorizations = authorizations;
  await page.reload();
  await expect(cover).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1);
  expect(coverRequests).toBe(coldRequests);
  expect(authorizations).toBeGreaterThan(coldAuthorizations);

  denyAccess = true;
  const denial = page.waitForResponse((response) => response.url().endsWith("/documents/access/batch") && response.status() === 403);
  await page.reload();
  await denial;
  await expect(cover).toHaveCount(0);
});

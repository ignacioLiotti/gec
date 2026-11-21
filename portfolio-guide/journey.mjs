import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const base = process.env.GUIDE_URL || "http://127.0.0.1:4175";
const output = path.join(import.meta.dirname, "artifacts");
const browser = await chromium.launch({
  channel: process.env.GUIDE_BROWSER || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const frame = page.frameLocator("iframe");
const journey = () =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("sintesis-guide:journey")),
  );
try {
  await page.goto(base + "/");
  await page
    .getByRole("button", { name: "Start the 3-minute tour", exact: true })
    .last()
    .click();
  await expect(
    frame.getByRole("heading", { name: /35 pólizas vencidas/ }),
  ).toBeVisible();
  await expect(frame.locator("body")).not.toContainText("13.600000000000001");
  await expect(
    frame.getByRole("button", { name: "Desvío: +13,6 pp", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open certificate", exact: true })
    .click();
  const amount = frame.getByTestId("cell-input-certificate-01-amount");
  await expect(amount).toHaveValue("17.000.000,00");
  const divider = frame.getByRole("separator", { name: "Ancho del documento" });
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "47");
  const point = await divider.boundingBox();
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x - 50, point.y + point.height / 2);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await divider.getAttribute("aria-valuenow")))
    .toBeLessThan(47);
  await amount.fill("19000000");
  await amount.press("Tab");
  await page
    .getByRole("button", { name: "Design & code", exact: true })
    .click();
  await page
    .getByText("Read the local persistence code", { exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "sessionStorage.setItem",
  );
  await page.screenshot({
    path: path.join(output, "guide-design-notes.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Design & code", exact: true }),
  ).toBeFocused();
  await expect(amount).toHaveValue("19.000.000,00");
  await frame
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    frame.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  expect((await journey()).rowsSaved).toBe(false);
  await amount.fill("18000000");
  await amount.press("Tab");
  await page.setViewportSize({ width: 390, height: 844 });
  await frame.getByRole("tab", { name: "Datos extraídos" }).click();
  await expect(amount).toHaveValue("18.000.000,00");
  await frame.getByRole("tab", { name: "Documento fuente" }).click();
  await frame
    .getByRole("tab", { name: "Documento fuente" })
    .press("ArrowRight");
  await expect(amount).toHaveValue("18.000.000,00");
  await expect(
    frame.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeEnabled();
  await frame
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect.poll(async () => (await journey()).rowsSaved).toBe(true);
  await page.screenshot({
    path: path.join(output, "guide-mobile-review.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () =>
        document.body.scrollWidth <= innerWidth &&
        document.body.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(output, "guide-split-review.png"),
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Open report", exact: true }).click();
  await expect(
    frame.getByRole("cell", { name: "$ 18.000.000,00", exact: true }).first(),
  ).toBeVisible();
  await expect.poll(async () => (await journey()).reportOpened).toBe(true);
  expect((await journey()).exported).toBe(false);
  await expect(
    frame.getByRole("button", { name: "Filtros", exact: true }),
  ).toHaveCount(1);
  const downloading = page.waitForEvent("download");
  await frame.getByRole("button", { name: "CSV", exact: true }).click();
  const download = await downloading;
  await download.saveAs(path.join(output, "guided-report.csv"));
  expect(
    fs.readFileSync(path.join(output, "guided-report.csv"), "utf8"),
  ).toContain("18000000");
  await expect(page.getByText(/Case complete\./)).toBeVisible();
  await page.screenshot({
    path: path.join(output, "guide-completed-report.png"),
    animations: "disabled",
  });
  await page.reload();
  await expect(page.getByText(/Case complete\./)).toBeVisible();
  await page.getByRole("button", { name: "Exit tour", exact: true }).click();
  await expect(page.getByRole("region", { name: "Guided case" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("sintesis-guide:certificates"))[0]
          .amount,
    ),
  ).toBe(18000000);
  expect(errors).toEqual([]);
  console.log(
    "PASS Guided correction, wrong-save guard, resize, notes/focus, mobile edit preservation, persisted progress and real CSV export",
  );
} catch (error) {
  await page.screenshot({
    path: path.join(output, "journey-failure.png"),
    animations: "disabled",
  });
  throw error;
} finally {
  fs.writeFileSync(
    path.join(output, "journey-results.json"),
    JSON.stringify({ errors }, null, 2),
  );
  await browser.close();
}

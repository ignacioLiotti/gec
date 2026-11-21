import { chromium, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
const base = process.env.GUIDE_URL || "http://127.0.0.1:4175";
const output = path.join(import.meta.dirname, "artifacts");
const browser = await chromium.launch({
  channel: process.env.GUIDE_BROWSER || "chrome",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto(base + "/?screen=operations");
  await expect(
    page.getByRole("heading", { name: /35 pólizas vencidas/ }),
  ).toBeVisible();
  const kpi = page.getByRole("button", { name: /Contrato total/i });
  await kpi.focus();
  await expect(page.getByRole("dialog")).toContainText("Contrato");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /AGO/ }).click();
  await expect(page.getByRole("button", { name: /AGO/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("status")).toContainText("AGO · 7 pólizas");
  await page.screenshot({
    path: path.join(output, "operations-open-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  // Same viewport, narrower parent: responsiveness follows the component, not the window.
  await page.locator("main").evaluate((e) => {
    e.style.width = "620px";
  });
  expect(
    await page.locator("main").evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: path.join(output, "operations-narrow-container.png"),
    animations: "disabled",
  });
  await page.locator("main").evaluate((e) => {
    e.style.width = "";
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(output, "operations-open-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  const metric = page.getByRole("button", {
    name: "Avance físico: 68%",
    exact: true,
  });
  await metric.scrollIntoViewIfNeeded();
  await metric.focus();
  await expect(
    page.getByRole("dialog", { name: "Avance físico" }),
  ).toContainText("Progreso de obra");
  const tooltip = page.getByRole("dialog", { name: "Avance físico" });
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: path.join(output, "operations-mobile-tooltip.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await metric.click();
  await expect(
    page.getByRole("dialog", { name: "Avance físico" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(metric).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/#operations");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: /35 pólizas vencidas/ }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(output, "guide-operations-open.png"),
    animations: "disabled",
  });
  await frame.getByRole("link", { name: /24 Torre Madero/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the source within reach" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS Operations: month selection, KPI/metric details, Escape, mobile tooltip containment, narrow parent and document drilldown",
  );
} catch (error) {
  await page.screenshot({
    path: path.join(output, "operations-failure.png"),
    animations: "disabled",
  });
  throw error;
} finally {
  fs.writeFileSync(
    path.join(output, "operations-results.json"),
    JSON.stringify({ errors }, null, 2),
  );
  await browser.close();
}

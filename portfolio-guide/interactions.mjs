import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const base = process.env.GUIDE_URL || "http://127.0.0.1:4175";
const output = path.join(import.meta.dirname, "artifacts");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.GUIDE_BROWSER || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  timezoneId: "America/Argentina/Buenos_Aires",
  reducedMotion: "reduce",
});
const errors = [],
  network = [],
  passed = [];
context.on("page", (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text());
      console.log("BROWSER ERROR", page.url(), m.text(), m.location());
    }
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
});
context.on("request", (r) => {
  if (
    r.url().includes("/api/") ||
    (!r.url().startsWith(base) && !/^(data:|blob:)/.test(r.url()))
  )
    network.push(r.url());
});
const page = await context.newPage();
const record = (label) => {
  passed.push(label);
  console.log("PASS " + label);
};
try {
  await page.goto(base + "/#operations");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: /35 pólizas vencidas/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#guide-content")).toBeFocused();
  expect(new URL(page.url()).hash).toBe("#operations");
  await frame.getByRole("button", { name: /AGO/ }).click();
  await frame.getByRole("button", { name: /Avance físico: 68%/ }).focus();
  await expect(frame.getByRole("dialog", { name: "Avance físico" })).toBeVisible();
  await page.screenshot({
    path: path.join(output, "guide-operations.png"),
    animations: "disabled",
  });
  await frame.getByRole("link", { name: /24 Torre Madero/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the source within reach" }),
  ).toBeVisible();
  record("Guide navigation, keyboard skip link and operational detail");

  const sheet = frame.getByRole("region", { name: "Datos extraídos" });
  const amount = sheet.getByTestId("cell-input-certificate-01-amount");
  await amount.fill("19000000");
  await amount.press("Tab");
  await expect(
    sheet.getByRole("button", { name: "Guardar cambios" }),
  ).toBeEnabled();
  await sheet.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    sheet.getByRole("button", { name: "Guardar cambios" }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("sintesis-guide:certificates"))[0]
            .amount,
      ),
    )
    .toBe(19000000);
  await page.screenshot({
    path: path.join(output, "guide-document-review.png"),
    animations: "disabled",
  });
  await expect(amount).toHaveValue("19.000.000,00");
  await frame.getByRole("button", { name: "Explorar conflicto" }).click();
  await expect(
    frame.getByText("Revisar continuidad", { exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("dialog", {
      name: "Certificados de avance · Torre Madero.svg",
      exact: true,
    })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await frame.getByRole("link", { name: "Generar reporte" }).click();
  await expect(
    frame.getByRole("cell", { name: "$ 19.000.000,00", exact: true }),
  ).toBeVisible();
  await expect(
    frame.getByRole("cell", { name: "1/5/2026", exact: true }),
  ).toBeVisible();
  record("Source review, conflict fixture and saved rows feeding the report");
  await page.getByRole("link", { name: "Full screen", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "$ 19.000.000,00", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to guide", exact: true }).click();
  await expect(
    frame.getByRole("cell", { name: "$ 19.000.000,00", exact: true }),
  ).toBeVisible();
  record("Full screen and return retain local rows");

  await frame.getByRole("textbox").nth(2).fill("Review packet · July 2026");
  await expect(
    frame.getByText("Review packet · July 2026", { exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Agrupar por Concepto", exact: true })
    .click();
  await frame.getByRole("button", { name: "Presets", exact: true }).click();
  await frame
    .getByRole("textbox", { name: "Nombre del preset" })
    .fill("July review");
  await frame
    .getByRole("button", { name: "Guardar preset", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("sintesis-guide:presets") || "[]")
            .length,
      ),
    )
    .toBe(1);
  for (const [button, extension] of [
    ["CSV", "csv"],
    ["Excel", "xlsx"],
  ]) {
    const pending = page.waitForEvent("download");
    await frame.getByRole("button", { name: button, exact: true }).click();
    const download = await pending;
    const file = path.join(output, "report." + extension);
    await download.saveAs(file);
    expect(fs.statSync(file).size).toBeGreaterThan(100);
    if (extension === "csv")
      expect(fs.readFileSync(file, "utf8")).toContain("19000000");
    else {
      const book = XLSX.readFile(file);
      expect(
        JSON.stringify(
          XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]),
        ),
      ).toContain("19000000");
    }
  }
  await frame.locator("body").evaluate(() => {
    window.print = () => {
      window.__printed = document.getElementById(
        "guide-print-document",
      )?.textContent;
    };
  });
  await frame
    .getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  await expect
    .poll(() => frame.locator("body").evaluate(() => window.__printed))
    .toContain("Review packet");
  await expect(frame.locator("body")).not.toHaveClass(/guide-printing/);
  record(
    "Report editing, grouping, local preset and CSV/XLSX contents; browser print handoff",
  );

  await frame.getByRole("button", { name: "Compartir", exact: true }).click();
  await frame
    .getByRole("button", { name: "Generar enlace", exact: true })
    .click();
  const shareInput = frame.getByRole("dialog").locator("input[readonly]");
  await expect(shareInput).toHaveValue(/shared=/);
  const sharedUrl = await shareInput.inputValue();
  const cleanContext = await browser.newContext();
  const shared = await cleanContext.newPage();
  await shared.goto(sharedUrl);
  await expect(
    shared.getByText("Review packet · July 2026", { exact: true }),
  ).toBeVisible();
  await expect(
    shared.getByRole("cell", { name: "$ 19.000.000,00", exact: true }),
  ).toBeVisible();
  await expect(
    shared.getByRole("button", { name: "Compartir", exact: true }),
  ).toBeDisabled();
  await shared.goto(base + "/?screen=reports&shared=invalid");
  await expect(shared.getByRole("alert")).toContainText("inválido");
  await cleanContext.close();
  record(
    "Shared report snapshot works in a clean browser context; malformed link handled",
  );

  await page.goto(base + "/?screen=obras");
  await page.getByRole("searchbox").fill("Torre");
  await expect(page.getByRole("link", { name: /Distrito Norte/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("cell", { name: "$ 100.000.000,00", exact: true })
    .dblclick();
  const contractInput = page.locator(
    '[data-column-id="contratoMasAmpliaciones"] input',
  );
  await contractInput.fill("110000000");
  await contractInput.press("Tab");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar cambios" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "$ 110.000.000,00", exact: true }),
  ).toBeVisible();
  record("Obras search, typed edit, save and reload persistence");

  await page.goto(base + "/?screen=setup");
  await page
    .getByRole("button", { name: "A veces fotos", exact: true })
    .click();
  await page.getByRole("button", { name: "Varía", exact: true }).click();
  await page
    .getByRole("button", { name: "Usar esta configuración", exact: true })
    .click();
  await expect(page.locator(".definition-output pre")).toContainText(
    "Avance certificado",
  );
  expect(
    JSON.parse(await page.locator(".definition-output pre").innerText()),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Restablecer propuesta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Usar esta configuración", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Usar otro ejemplo", exact: true }),
  ).toBeDisabled();
  record(
    "Sample selections produce configuration and reset to the review step",
  );

  await page.goto(base + "/?screen=data-flow");
  await page
    .getByRole("button", { name: "Todo el flujo", exact: true })
    .click();
  await page.getByRole("button", { name: "Avanzado", exact: true }).click();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: base,
  });
  await page.getByRole("button", { name: "Local", exact: true }).click();
  const code = await page.evaluate(() => navigator.clipboard.readText());
  const config = JSON.parse(code);
  config.calculations[0].label = "Contrato del ejemplo";
  await page
    .getByRole("textbox", { name: "Pegá tu JSON aquí…" })
    .fill(JSON.stringify(config));
  await page
    .getByRole("button", { name: "Importar JSON", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("pre")).toContainText("Contrato del ejemplo");
  record("Data-flow import and local save");

  const denied = await page.evaluate(async () => ({
    unknown: (await fetch("/api/guide-unsupported")).status,
    external: (await fetch("https://example.com/guide-unsupported")).status,
  }));
  expect(denied).toEqual({ unknown: 403, external: 403 });
  await page.goto(base + "/#documents");
  await page.getByRole("button", { name: "Reset data", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Sample data restored.");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("sintesis-guide:certificates"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("sintesis-guide:obras")),
  ).toBeNull();
  await expect(
    frame.getByTestId("cell-input-certificate-01-amount"),
  ).toHaveValue("18.000.000,00");
  record(
    "Reset restores fixtures; unknown and external fetch operations stay local",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/#overview");
  await expect(
    page.getByRole("heading", { name: /From construction documents/ }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(output, "guide-mobile.png"),
    animations: "disabled",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Explore", { exact: true }).selectOption("reports");
  await expect(
    page.getByRole("heading", { name: "Finish with something usable" }),
  ).toBeVisible();
  await expect(
    frame.getByRole("heading", { name: "Certificados de avance" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  record("Mobile guide navigation and containment at 390px");
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
} catch (error) {
  await page.screenshot({
    path: path.join(output, "failure.png"),
    animations: "disabled",
  });
  fs.writeFileSync(
    path.join(output, "failure.txt"),
    await page.locator("body").ariaSnapshot(),
  );
  throw error;
} finally {
  fs.writeFileSync(
    path.join(output, "interaction-results.json"),
    JSON.stringify({ passed, errors, network }, null, 2),
  );
  await browser.close();
}

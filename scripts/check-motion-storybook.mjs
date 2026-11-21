import { expect, chromium } from "@playwright/test";
import puppeteer from "puppeteer";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import { createHash } from "node:crypto";

export async function checkMotionComparison(page, base) {
  const errors = [];
  const failedRequests = [];
  const onError = error => errors.push(error.message);
  const onResponse = response => { if (response.status() >= 400 && response.url().startsWith(base)) failedRequests.push(`${response.status()} ${response.url()}`); };
  page.on("pageerror", onError);
  page.on("response", onResponse);
  const manifest = JSON.parse(fs.readFileSync("stories/motion/vendor/manifest.json", "utf8"));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(`stories/motion/vendor/${file.library}/${file.file}`);
    expect(createHash("sha256").update(bytes).digest("hex"), `Pinned source ${file.file}`).toBe(file.localSha256);
  }
  const normal = page.getByTestId("sample-animated");
  const quiet = page.getByTestId("sample-quiet");
  const select = async id => {
    await page.getByLabel("Componente", { exact: true }).selectOption(id);
    await expect(page.locator(".motion-lab-workbench")).toHaveAttribute("data-example", id);
    await expect(normal.getByText("Cargando muestra…")).toHaveCount(0);
    await expect(normal.locator(".motion-reference > *").first()).toBeVisible();
  };
  let renders = 0;
  for (const theme of ["light", "dark"]) {
    await page.goto(`${base}/iframe.html?id=motion-comparacion--playground&viewMode=story&globals=theme:${theme}`);
    await expect(page.locator(".motion-lab")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".motion-lab-entry")).toHaveCount(40);
    const options = await page.getByLabel("Componente", { exact: true }).locator("option").evaluateAll(nodes => nodes.map(node => node.value));
    expect(options).toHaveLength(40);
    for (const id of options) {
      await select(id);
      const variants = page.getByLabel("Variante", { exact: true });
      const values = await variants.count() ? await variants.locator("option").evaluateAll(nodes => nodes.map(node => node.value)) : [null];
      for (const variant of values) {
        if (variant) await variants.selectOption(variant);
        await expect(normal.getByText("Cargando muestra…")).toHaveCount(0);
        await expect(normal.locator(".motion-reference > *").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${theme}/${id}: page overflow`).toBe(true);
        renders++;
      }
    }

    await select("interior-loading-button");
    const visual = locator => locator.evaluate(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { width: r.width, height: r.height, color: s.color, background: s.backgroundColor, border: s.border, font: s.font, shadow: s.boxShadow }; });
    const button = normal.getByRole("button", { name: "Guardar cambios", exact: true });
    const initial = await visual(button);
    expect(await visual(quiet.getByRole("button", { name: "Guardar cambios", exact: true }))).toEqual(initial);
    await button.click();
    const busy = normal.locator('button[aria-busy="true"]');
    await expect(busy).toBeVisible();
    await expect(busy).toHaveAttribute("aria-disabled", "true");
    // Native focus is retained while repeat activation is guarded by the source.
    await expect(busy).toBeFocused();
    const during = await visual(busy);
    expect(during.width).toBe(initial.width);
    expect(during.height).toBe(initial.height);
    await expect(normal.getByRole("button", { name: "Guardado", exact: true })).toBeVisible();
    await page.getByLabel("Variante", { exact: true }).selectOption("Error");
    await normal.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(normal.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
    await page.getByLabel("Variante", { exact: true }).selectOption("Deshabilitado");
    await expect(normal.getByRole("button")).toBeDisabled();

    // Inspect actual animation parameters in the browser, not only screenshots.
    await select("beautiful-LoadingState");
    const animatedPixel = normal.locator('[style*="mr-beautiful-pixel-on"]').first();
    expect(await animatedPixel.evaluate(el => getComputedStyle(el).animationDuration)).toBe("0.65s");
    await page.getByLabel("Variante", { exact: true }).selectOption("Orbit");
    expect(await animatedPixel.evaluate(el => getComputedStyle(el).animationDuration)).toBe("0.95s");
    expect(await quiet.locator('[style*="mr-beautiful-pixel-on"]').first().evaluate(el => getComputedStyle(el).animationIterationCount)).toBe("1");

    await select("beautiful-Switch");
    const toggle = normal.getByRole("switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const thumb = toggle.locator("span");
    expect(await thumb.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0.2s");
    expect(await thumb.evaluate(el => getComputedStyle(el).transitionTimingFunction)).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
    await expect.poll(() => thumb.evaluate(el => getComputedStyle(el).transform)).toBe("matrix(1, 0, 0, 1, 16, 0)");
    await toggle.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await select("interior-modal");
    const trigger = normal.getByRole("button", { name: "Delete project" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await select("interior-tabs");
    const tabs = normal.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    await select("interior-hold-to-confirm");
    const hold = normal.getByRole("button");
    await hold.focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(200); // Intentional early release, below the source's 1800 ms threshold.
    await page.keyboard.up("Space");
    await expect(hold).toHaveAttribute("aria-disabled", "false");
    await page.keyboard.down("Space");
    await expect(hold).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.up("Space");

    await select("interior-filter-grid");
    await normal.getByRole("radio", { name: /^Docs,/ }).click();
    await normal.getByRole("radio", { name: /^Images,/ }).click();
    await expect(normal.getByText("hero-wide", { exact: true })).toBeVisible();
    await expect(normal.getByText("brand-deck", { exact: true })).toHaveCount(0);

    await select("beautiful-ToolChips");
    await expect(normal.getByRole("button", { name: /Read image/ })).toBeVisible();
    await normal.getByRole("button", { name: /Thinking.*Planning/ }).click();
    await expect(normal.getByText("Weekend demand carries pistachio, so it churns first.")).toBeVisible();
    await expect(normal.locator('[data-diffchip]').first()).toBeVisible();
    expect(await normal.locator(".motion-reference").evaluate(el => getComputedStyle(el).getPropertyValue("--ease-out-strong").match(/[.\d]+/g).map(Number))).toEqual([0.23, 1, 0.32, 1]);
    expect(await normal.locator('[data-diffchip] button').first().evaluate(el => parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThan(0);
    await page.screenshot({ path: `.codex-tmp/motion-v2-${theme}.png` });
  }

  await page.getByLabel("Buscar componente", { exact: true }).fill("zz-no-match");
  await expect(page.getByText("No hay componentes con estos filtros.")).toBeVisible();
  await page.getByLabel("Buscar componente", { exact: true }).fill("");
  await page.getByLabel("Biblioteca", { exact: true }).selectOption("beautiful");
  await expect(page.locator(".motion-lab-entry")).toHaveCount(14);
  await page.getByLabel("Biblioteca", { exact: true }).selectOption("Todas");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await select("beautiful-LoadingState");
  await expect(normal.locator(".motion-reference")).toHaveAttribute("data-reduced", "true");
  expect(await normal.locator('[style*="mr-beautiful-pixel-on"]').first().evaluate(el => getComputedStyle(el).animationIterationCount)).toBe("1");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.setViewportSize({ width: 375, height: 900 });
  for (const id of ["interior-loading-button", "interior-tabs", "beautiful-RecordsTable", "beautiful-FilterTable", "beautiful-Button"]) {
    await select(id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Mobile/${id}`).toBe(true);
  }
  await select("interior-loading-button");
  await page.screenshot({ path: ".codex-tmp/motion-v2-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 960 });
  page.off("pageerror", onError);
  page.off("response", onResponse);
  expect(errors, "Runtime errors").toEqual([]);
  expect(failedRequests, "Failed local requests").toEqual([]);
  return { components: 40, renders, pinnedFiles: manifest.files.length, errors, failedRequests, interactions: "passed" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: puppeteer.executablePath(), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    console.log(JSON.stringify(await checkMotionComparison(page, process.env.STORYBOOK_URL ?? "http://localhost:6006"), null, 2));
  } finally { await browser.close(); }
}


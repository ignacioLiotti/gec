import { chromium, expect } from "@playwright/test";
import puppeteer from "puppeteer";
import { pathToFileURL } from "node:url";

export async function checkMotionScreens(page, base) {
  const errors = [],
    requests = [];
  const onError = (error) => errors.push(error.message);
  const onRequest = (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  };
  page.on("pageerror", onError);
  page.on("request", onRequest);
  const open = async (story, theme = "light") => {
    await page.goto(
      `${base}/iframe.html?id=motion-pantallas--${story}&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator(".screen-app")).toBeVisible({ timeout: 30000 });
  };
  for (const theme of ["light", "dark"]) {
    for (const story of ["excel", "obra", "documentos", "general"]) {
      await page.setViewportSize({ width: 1440, height: 1050 });
      await open(story, theme);
      // Let the source entrance and three staggered extraction steps settle.
      await page.waitForTimeout(2300);
      await page.screenshot({
        path: `.codex-tmp/motion-screen-${story}-${theme}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 812 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${story}/${theme}: mobile overflow`,
      ).toBe(true);
    }
  }
  await page.screenshot({
    path: ".codex-tmp/motion-screen-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await open("playground");
  const identity = await page.locator('.screen-app').evaluate(el => {
    const sidebar = el.querySelector('[data-slot="sidebar"]');
    return { orange: getComputedStyle(el).getPropertyValue('--orange-primary').trim(), sidebar: getComputedStyle(sidebar).backgroundColor, brandText: sidebar.textContent };
  });
  expect(identity.orange).toBe('21 100% 50%');
  expect(identity.sidebar).toBe('rgb(240, 239, 234)');
  expect(identity.brandText).toContain('Plataforma de gestión');
  await page.getByLabel("Buscar obras", { exact: true }).fill("inexistente");
  await expect(page.getByText("Sin obras con estos filtros")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await page.getByRole("button", { name: "Nueva obra", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Crear obra", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Designación y ubicación", { exact: true })
    .fill("Edificio de prueba");
  await page.getByRole("button", { name: "Crear obra", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edificio de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Torre Madero · Dique 2" }).click();
  await expect(
    page.getByRole("heading", { name: "Notas de obra" }),
  ).toBeVisible();
  await page
    .getByLabel("Nueva nota", { exact: true })
    .fill("Revisión coordinada para mañana.");
  await page.getByRole("button", { name: "Agregar nota" }).click();
  await expect(
    page.getByText("Revisión coordinada para mañana."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar datos" }).click();
  await page
    .getByLabel("Designación y ubicación", { exact: true })
    .fill("Torre Madero · Actualizada");
  await page
    .getByLabel("Certificado a la fecha (ARS)", { exact: true })
    .fill("3200000000");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Torre Madero · Actualizada",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Documentos New", exact: true }).click();
  const selectedTab = page.getByRole('tab', { name: 'Documentos New', exact: true });
  await expect(selectedTab).toHaveAttribute('data-state', 'active');
  await expect(selectedTab).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(selectedTab).toHaveCSS('border-radius', '12px');
  await expect(selectedTab.locator('svg')).toHaveCount(1);
  await page
    .getByRole("button", { name: "Certificado 08 · Agosto.pdf" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(el => getComputedStyle(el).getPropertyValue('--orange-primary').trim())).toBe('21 100% 50%');
  await page
    .getByRole("button", { name: "Confirmar revisión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Volver a documentos", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  // Interior retains its closed panel for the exit spring, with inert content.
  await expect(page.locator('[role="dialog"]')).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "Certificado 08 · Agosto.pdf" }),
  ).toBeFocused();
  await page.getByRole("treeitem", { name: /Facturas/ }).click();
  await expect(
    page.getByRole("button", { name: "Factura 0004-00001258.pdf" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Verificados", exact: true }).click();
  await expect(
    page.getByText("No hay documentos con estos filtros"),
  ).toBeVisible();
  await page.getByLabel("Movimiento reducido", { exact: true }).check();
  expect(
    await page
      .locator(".motion-screens .motion-reference")
      .evaluateAll((nodes) =>
        nodes.every((node) => node.dataset.reduced === "true"),
      ),
  ).toBe(true);
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await page.getByLabel("Simular error al guardar", { exact: true }).check();
  await page.getByRole("button", { name: "Editar datos" }).click();
  await page
    .getByLabel("Designación y ubicación", { exact: true })
    .fill("Borrador con error");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "El borrador sigue disponible",
  );
  await expect(
    page.getByLabel("Designación y ubicación", { exact: true }),
  ).toHaveValue("Borrador con error");
  await expect(
    page.getByRole("heading", {
      name: "Torre Madero · Actualizada",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Simular error al guardar", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Borrador con error", exact: true }),
  ).toBeVisible();
  page.off("pageerror", onError);
  page.off("request", onRequest);
  expect(errors, "Screen runtime errors").toEqual([]);
  expect(requests, "Examples must not call product APIs").toEqual([]);
  return {
    screens: 4,
    themeAndViewportRenders: 16,
    interactions: "passed",
    errors,
    apiRequests: requests,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const browser = await chromium.launch({
    executablePath: puppeteer.executablePath(),
    headless: true,
  });
  try {
    console.log(
      JSON.stringify(
        await checkMotionScreens(
          await browser.newPage(),
          process.env.STORYBOOK_URL ?? "http://localhost:6006",
        ),
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import puppeteer from "puppeteer";
import { checkMotionComparison } from "./check-motion-storybook.mjs";
import { checkMotionScreens } from "./check-motion-screens.mjs";

// Exercise the production artifact, including every story in both product themes.
const root = path.resolve("storybook-static");
const index = JSON.parse(await readFile(path.join(root, "index.json"), "utf8"));
const stories = Object.values(index.entries).filter(
  (entry) => entry.type === "story",
);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  try {
    const target = file === root ? path.join(root, "index.html") : file;
    const data = await readFile(target);
    res
      .writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: puppeteer.executablePath(),
  headless: true,
});
const failures = [];
const warnings = new Set();
const jobs = stories.flatMap((story) =>
  ["light", "dark"].map((theme) => ({ story, theme })),
);
let completed = 0;
try {
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      let errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
        if (message.type() === "warning") warnings.add(message.text());
      });
      while (jobs.length) {
        const { story, theme } = jobs.shift();
        errors = [];
        try {
          await page.goto(
            `${base}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
          );
          await page.waitForFunction(
            () =>
              document.querySelector("#storybook-root")?.childElementCount ||
              document.querySelector(".sb-errordisplay")?.textContent,
            null,
            { timeout: 15000 },
          );
          await expect(page.locator(".sb-canvas")).toBeAttached();
          await expect(page.locator("html")).toHaveClass(
            theme === "dark" ? /dark/ : /^(?!.*\bdark\b).*$/,
          );
          if (errors.length) throw new Error(errors.join("\n"));
        } catch (error) {
          failures.push({ id: story.id, theme, error: error.message });
        }
        completed++;
        if (completed % 100 === 0)
          console.log(`Rendered ${completed}/${stories.length * 2}`);
      }
      await page.close();
    }),
  );

  console.log(
    JSON.stringify(
      { stories: stories.length, renders: completed, failures },
      null,
      2,
    ),
  );
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  async function open(id) {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`);
    await expect(page.locator(".sb-canvas")).toBeAttached();
  }
  await open("app-ui-checkbox--unchecked");
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await open("app-ui-checkbox--indeterminate");
  await expect(page.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  await expect(page.locator(".lucide-minus")).toBeVisible();
  await expect(page.locator(".lucide-check")).toBeHidden();
  await open("app-ui-tray--interactive");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "false");
  await open("patterns-shared-behavior--composition");
  await expect(page.getByRole("link", { name: "Documents 3" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manual" })).toHaveAttribute("aria-pressed", "true");
  await open("patterns-shared-behavior--permission-choice");
  await page.getByRole("button", { name: "Bloquear" }).click();
  await expect(page.getByRole("button", { name: "Bloquear" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Heredar" })).toHaveAttribute("aria-pressed", "false");
  await open("patterns-shared-behavior--nested-menus");
  await page.getByRole("button", { name: "Open editor" }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Review", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveText("Review");
  await page.getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Duplicated");
  await expect(page.getByRole("button", { name: "Row actions" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open editor" })).toBeFocused();
  await open("app-ui-select--default");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Review", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveText("Review");
  await open("app-ui-dialog--default");
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open dialog" })).toBeFocused();
  await open("app-ui-tabs--default");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByRole("tabpanel")).toHaveText("Recent changes");
  await open("app-ui-command--default");
  await page.getByRole("combobox").fill("no-matching-document");
  await expect(page.getByText("No documents found.")).toBeVisible();
  try {
    await open("app-ui-sortable--vertical");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "Move Contract" }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "Move Contract" }),
    ).toHaveAttribute("aria-pressed", "true");
    // dnd-kit attaches its keyboard listener asynchronously after activation.
    // Allow that task and the drag overlay's layout to settle before moving.
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[role="status"]')).toContainText("position 2");
    await page.keyboard.press("Space");
    await expect(
      page.locator('[data-slot="sortable-item-handle"]').first(),
    ).toHaveText("Invoice");
  } catch (error) {
    failures.push({
      id: "app-ui-sortable--vertical",
      interaction: "keyboard reorder",
      error: error.message,
    });
  }
  await open("app-ui-button--playground");
  const tokenSource = await readFile("design-system/tokens/index.ts", "utf8");
  const colorExpressions = [...tokenSource.slice(0, tokenSource.indexOf("  spacing:")).matchAll(/\w+: "((?:hsl\(var|var)\(--[^"\n]+)"/g)].map(match => match[1]);
  const contrastResults = [];
  for (const theme of ["light", "dark"]) {
    for (const component of ["button", "badge", "lightbutton"]) {
      await page.goto(`${base}/iframe.html?id=app-ui-${component}--playground&viewMode=story&globals=theme:${theme}`);
      await expect(page.locator(".sb-sample").first()).toBeVisible();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);
      // Theme changes animate backgrounds. Measure the settled, visible state.
      await page.evaluate(async () => {
        await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
      });
      const results = await page.evaluate(({ colorExpressions }) => {
        const root = getComputedStyle(document.documentElement);
        const invalidTokens = colorExpressions.filter(expression => {
          let resolved = expression;
          for (let i = 0; i < 5 && resolved.includes("var("); i++) resolved = resolved.replace(/var\((--[^)]+)\)/g, (_, name) => root.getPropertyValue(name).trim());
          return !CSS.supports("color", resolved);
        });
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        function rgba(color) { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); }
        function over(fg, bg) { return [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])); }
        function background(el) { if (!el) return [255, 255, 255]; return over(rgba(getComputedStyle(el).backgroundColor), background(el.parentElement)); }
        function luminance(rgb) { return rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); }
        const contrasts = [...document.querySelectorAll(".sb-sample")].map(sample => {
          const el = sample.querySelector('[data-slot="button"], [data-slot="badge"], [data-slot="light-button"]');
          const bg = background(el), fg = over(rgba(getComputedStyle(el).color), bg);
          const a = luminance(fg), b = luminance(bg);
          return { variant: sample.querySelector("code")?.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        });
        return { invalidTokens, contrasts };
      }, { colorExpressions });
      if (results.invalidTokens.length) throw new Error(`Invalid ${theme} tokens: ${results.invalidTokens.join(", ")}`);
      for (const result of results.contrasts) {
        contrastResults.push({ theme, component, ...result });
        if (result.ratio < 4.5) failures.push({ theme, component, ...result, interaction: "text contrast" });
      }
    }
  }
  console.log(JSON.stringify({ contrastResults }, null, 2));
  await open("app-ui-button--playground");
  await page.screenshot({
    path: ".codex-tmp/storybook-buttons.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".sb-canvas")).toBeAttached();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflows) throw new Error("Button gallery overflows at 375px");
  await page.screenshot({
    path: ".codex-tmp/storybook-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 960 });
  await checkMotionComparison(page, base);
  console.log(JSON.stringify(await checkMotionScreens(page, base), null, 2));
  console.log(
    JSON.stringify(
      {
        stories: stories.length,
        renders: completed,
        failures,
        warnings: [...warnings],
        interactions: failures.some((failure) => failure.interaction)
          ? "failed, see failures"
          : "passed",
      },
      null,
      2,
    ),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}


import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const base = process.env.GUIDE_URL || "http://127.0.0.1:4175";
const output = path.join(import.meta.dirname, "artifacts");
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    channel: process.env.GUIDE_BROWSER || "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
  });
  const results = [];
  try {
    for (const screen of [
      "overview",
      "operations",
      "obras",
      "documents",
      "reports",
      "data-flow",
      "setup",
    ]) {
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(r.status() + " " + r.url());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("request", (r) => {
        if (
          r.url().includes("/api/") ||
          (!r.url().startsWith(base) &&
            !r.url().startsWith("data:") &&
            !r.url().startsWith("blob:"))
        )
          requests.push(r.url());
      });
      await page.goto(
        base + (screen === "overview" ? "/" : "/?screen=" + screen),
      );
      await page.waitForFunction(
        () =>
          document.body.innerText.length > 200 &&
          !document.body.innerText.includes("Loading product component"),
        { timeout: 30000 },
      );
      if (screen === "overview")
        await page
          .frameLocator("iframe")
          .getByRole("heading", { name: /35 pólizas vencidas/ })
          .waitFor({ timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      const text = await page.locator("body").innerText();
      const snapshot = await page.locator("body").ariaSnapshot();
      await page.screenshot({
        path: path.join(output, screen + ".png"),
        fullPage: false,
        animations: "disabled",
      });
      const result = { screen, errors, requests, text, snapshot };
      fs.writeFileSync(
        path.join(output, screen + ".json"),
        JSON.stringify(result, null, 2),
      );
      results.push(result);
      console.log(
        JSON.stringify({
          screen,
          errors,
          requests,
          excerpt: text.slice(0, 1200),
        }),
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
  if (
    results.some(
      (r) =>
        r.errors.length ||
        r.requests.length ||
        r.text.includes("This screen could not load"),
    )
  )
    process.exitCode = 1;
})();

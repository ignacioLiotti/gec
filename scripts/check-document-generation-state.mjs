import assert from "node:assert/strict";
import puppeteer from "puppeteer";

function requireLoopbackHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Document generation checks require a valid HTTP(S) loopback Storybook URL.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !loopbackHosts.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password
  ) {
    throw new Error("Document generation checks require an HTTP(S) loopback Storybook URL.");
  }

  return url.href.replace(/\/$/, "");
}

const baseUrl = requireLoopbackHttpUrl(
  process.argv[2] || process.env.STORYBOOK_URL || "http://127.0.0.1:6006",
);
const storyUrl = (story) => `${baseUrl}/iframe.html?id=product-document-generation-runtime--${story}&viewMode=story`;

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(10_000);
const faviconUrl = new URL("/favicon.ico", baseUrl).href;
await page.setRequestInterception(true);
page.on("request", (request) => {
  if (request.url() === faviconUrl) {
    void request.respond({ status: 204 });
  } else {
    void request.continue();
  }
});
const browserSignals = { consoleErrors: [], pageErrors: [], failedResources: [] };
page.on("console", (message) => {
  if (message.type() === "error") browserSignals.consoleErrors.push(message.text());
});
page.on("pageerror", (error) => browserSignals.pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400) {
    browserSignals.failedResources.push({ status: response.status(), url: response.url() });
  }
});

async function open(story = "state-machine") {
  await page.goto(storyUrl(story), { waitUntil: "networkidle0" });
  await page.waitForFunction(() => Boolean(window.__DOCUMENT_GENERATION_FIXTURE__));
  await page.waitForSelector('[data-inline-field="title"]');
}

async function titleValue() {
  return page.$eval('[data-inline-field="title"]', (element) => element.value);
}

async function replaceTitle(value, { blur = false } = {}) {
  const selector = '[data-inline-field="title"]';
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value);
  if (blur) await page.keyboard.press("Tab");
}

async function buttonByText(text) {
  const buttons = await page.$$("button");
  const matches = await Promise.all(
    buttons.map(async (button) => ({ button, text: await button.evaluate((node) => node.textContent ?? "") })),
  );
  return matches.find((entry) => entry.text.includes(text))?.button ?? null;
}

async function hold(kind) {
  await page.evaluate((requestKind) => window.__DOCUMENT_GENERATION_FIXTURE__.hold(requestKind), kind);
}

async function releaseNext(kind, failureMessage) {
  return page.evaluate(
    ({ requestKind, message }) => window.__DOCUMENT_GENERATION_FIXTURE__.releaseNext(requestKind, message),
    { requestKind: kind, message: failureMessage },
  );
}

async function requests(kind) {
  return page.evaluate(
    (requestKind) => window.__DOCUMENT_GENERATION_FIXTURE__.requests().filter((request) => request.kind === requestKind),
    kind,
  );
}

async function waitForPending(kind, count = 1) {
  await page.waitForFunction(
    ({ requestKind, expected }) =>
      window.__DOCUMENT_GENERATION_FIXTURE__
        ?.requests()
        .filter((request) => request.kind === requestKind && request.state === "pending").length >= expected,
    {},
    { requestKind: kind, expected: count },
  );
}

const results = [];

async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({ name, status: "failed", error: error instanceof Error ? error.message : String(error) });
  }
}

try {
  await check("draft recovery loads the saved snapshot", async () => {
    await open("draft-recovery");
    assert.equal(await titleValue(), "Borrador recuperado");
    const draftRequests = await requests("draft");
    assert.equal(draftRequests.filter((request) => request.method === "POST").length, 0);
  });

  await check("generated editing loads the server document and keeps the draft control disabled", async () => {
    await open("generated-editing");
    assert.equal(await titleValue(), "Documento rechazado editable");
    const save = await buttonByText("Guardar borrador");
    if (save) assert.equal(await save.evaluate((button) => button.hidden), true, "Draft save must be hidden");
    const download = await buttonByText("Descargar");
    assert.ok(download, "Download button not found");
    assert.equal(await download.evaluate((button) => button.disabled), true);
  });

  await check("typing stays focused and survives a delayed autosave response", async () => {
    await open();
    const originalControl = await page.$('[data-inline-field="title"]');
    assert.ok(originalControl, "Title control not found");
    await hold("draft");
    await replaceTitle("primera revision", { blur: true });
    await waitForPending("draft");
    await replaceTitle("revision mientras guarda");
    assert.equal(await titleValue(), "revision mientras guarda", "Typing must be visible before the delayed response resolves");
    assert.equal(await page.evaluate((control) => control === document.querySelector('[data-inline-field="title"]'), originalControl), true);
    const selection = await originalControl.evaluate((control) => [control.selectionStart, control.selectionEnd]);
    const before = await page.evaluate(() => document.activeElement?.getAttribute("data-inline-field"));
    assert.equal(before, "title");
    assert.equal(await releaseNext("draft"), true);
    await page.waitForFunction(() => !window.__DOCUMENT_GENERATION_FIXTURE__.requests().some((request) => request.kind === "draft" && request.state === "pending"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await titleValue(), "revision mientras guarda");
    assert.equal(await page.evaluate((control) => control === document.querySelector('[data-inline-field="title"]'), originalControl), true);
    assert.deepEqual(await originalControl.evaluate((control) => [control.selectionStart, control.selectionEnd]), selection);
    const after = await page.evaluate(() => document.activeElement?.getAttribute("data-inline-field"));
    assert.equal(after, "title");
  });

  await check("manual save preserves focused typing", async () => {
    await open();
    await replaceTitle("valor antes del guardado", { blur: true });
    await hold("draft");
    const save = await buttonByText("Guardar borrador");
    assert.ok(save, "Save draft button not found");
    await save.click();
    await waitForPending("draft");
    const draftPostsBeforeTyping = (await requests("draft")).filter((request) => request.method === "POST");
    assert.equal(draftPostsBeforeTyping.length, 1, "Strict Mode must not duplicate the manual save POST");
    assert.equal(await save.evaluate((button) => button.disabled), true);
    await replaceTitle("edicion enfocada durante guardado");
    assert.equal(await titleValue(), "edicion enfocada durante guardado", "Typing must be visible before manual save resolves");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-inline-field")), "title");
    assert.equal(await releaseNext("draft"), true);
    await page.waitForFunction(() => !window.__DOCUMENT_GENERATION_FIXTURE__.requests().some((request) => request.kind === "draft" && request.state === "pending"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await titleValue(), "edicion enfocada durante guardado");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-inline-field")), "title");
  });

  await check("save before generate uses the latest saved snapshot", async () => {
    await open();
    await replaceTitle("snapshot inicial", { blur: true });
    const save = await buttonByText("Guardar borrador");
    assert.ok(save, "Save draft button not found");
    await save.click();
    await page.waitForFunction(() => window.__DOCUMENT_GENERATION_FIXTURE__.requests().some((request) => request.kind === "draft" && request.state === "resolved"));
    const firstDraft = (await requests("draft"))[0];
    assert.equal(firstDraft.method, "POST");
    assert.equal(firstDraft.body?.inputData?.title, "snapshot inicial");
    await replaceTitle("snapshot mas reciente", { blur: true });
    const generateAfterEdit = await buttonByText("Generar documento");
    assert.ok(generateAfterEdit, "Generate button not found");
    await generateAfterEdit.click();
    await page.waitForFunction(() => window.__DOCUMENT_GENERATION_FIXTURE__.requests().some((request) => request.kind === "generate" && request.state === "resolved"));
    const generatedInput = await page.evaluate(() => window.__DOCUMENT_GENERATION_FIXTURE__.generatedInput());
    assert.equal(generatedInput?.title, "snapshot mas reciente");
    await page.waitForFunction(() => document.body.textContent?.includes("orden-runtime.pdf"));
    assert.match(await page.evaluate(() => document.body.textContent ?? ""), /Documento generado y guardado en la carpeta/);
  });

  await check("late assist cannot overwrite focused typing", async () => {
    await open();
    const originalControl = await page.$('[data-inline-field="title"]');
    assert.ok(originalControl, "Title control not found");
    await hold("assist");
    const assist = await buttonByText("Completar con documentos");
    assert.ok(assist, "Assist button not found");
    await assist.click();
    await waitForPending("assist");
    await replaceTitle("texto escrito durante asistencia");
    assert.equal(await titleValue(), "texto escrito durante asistencia", "Typing must be visible before assist resolves");
    assert.equal(await page.evaluate((control) => control === document.querySelector('[data-inline-field="title"]'), originalControl), true);
    const selection = await originalControl.evaluate((control) => [control.selectionStart, control.selectionEnd]);
    assert.equal(await releaseNext("assist"), true);
    await page.waitForFunction(() => !window.__DOCUMENT_GENERATION_FIXTURE__.requests().some((request) => request.kind === "assist" && request.state === "pending"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await titleValue(), "texto escrito durante asistencia");
    assert.equal(await page.evaluate((control) => control === document.querySelector('[data-inline-field="title"]'), originalControl), true);
    assert.deepEqual(await originalControl.evaluate((control) => [control.selectionStart, control.selectionEnd]), selection);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-inline-field")), "title");
  });

  await check("same-draft template switch does not overlap writes", async () => {
    await open();
    await hold("draft");
    await replaceTitle("autosave pendiente", { blur: true });
    await waitForPending("draft");
    const triggers = await page.$$('[role="combobox"]');
    assert.ok(triggers.length >= 4, `Expected four context controls, found ${triggers.length}`);
    await triggers[3].click();
    await page.waitForSelector('[role="option"]');
    const options = await page.$$('[role="option"]');
    const compact = await Promise.all(options.map(async (option) => ({ option, text: await option.evaluate((node) => node.textContent ?? "") })))
      .then((entries) => entries.find((entry) => entry.text.includes("compacta"))?.option);
    assert.ok(compact, "Compact template option not found");
    await compact.click();
    await new Promise((resolve) => setTimeout(resolve, 1_700));
    const draftRequests = await requests("draft");
    assert.equal(draftRequests.filter((request) => request.state === "pending").length, 1);
    const firstDraftRequest = draftRequests.find((request) => request.state === "pending");
    assert.ok(firstDraftRequest, "Initial template persistence not found");
    assert.equal(await releaseNext("draft"), true);
    await page.waitForFunction(
      (previousRequestId) => window.__DOCUMENT_GENERATION_FIXTURE__
        .requests()
        .some((request) =>
          request.kind === "draft" &&
          request.id !== previousRequestId &&
          request.state === "pending"),
      {},
      firstDraftRequest.id,
    );
    const persistedRequests = (await requests("draft")).filter((request) => request.method === "POST");
    assert.equal(persistedRequests.length, 2, "Template switch must enqueue exactly one follow-up persistence");
    const switchedTemplateRequest = persistedRequests.find((request) => request.id !== firstDraftRequest.id);
    assert.ok(switchedTemplateRequest, "Switched-template persistence not found");
    assert.equal(switchedTemplateRequest.body?.templateId, "template-compact");
    assert.equal(switchedTemplateRequest.body?.inputData?.title, "autosave pendiente");
    assert.equal(await releaseNext("draft"), true);
    await page.waitForFunction(
      (requestId) => window.__DOCUMENT_GENERATION_FIXTURE__
        .requests()
        .some((request) => request.id === requestId && request.state === "resolved"),
      {},
      switchedTemplateRequest.id,
    );
    const savedDraft = await page.evaluate(
      () => window.__DOCUMENT_GENERATION_FIXTURE__.savedDraft("draft-runtime"),
    );
    assert.equal(savedDraft?.title, "autosave pendiente");
  });

  await check("delayed bootstrap owns template availability", async () => {
    await open();
    await hold("bootstrap");
    const triggers = await page.$$('[role="combobox"]');
    assert.ok(triggers.length >= 4, "Context controls not found");
    await triggers[0].click();
    await page.waitForSelector('[role="option"]');
    const options = await page.$$('[role="option"]');
    const campus = await Promise.all(options.map(async (option) => ({ option, text: await option.evaluate((node) => node.textContent ?? "") })))
      .then((entries) => entries.find((entry) => entry.text.includes("Campus Rio"))?.option);
    assert.ok(campus, "Second work option not found");
    await campus.click();
    await waitForPending("bootstrap");
    const loadingControls = await page.$$('[role="combobox"]');
    assert.ok(loadingControls.length >= 4, "Template control not found while loading");
    assert.equal(await loadingControls[3].evaluate((control) => control.disabled), true);
    assert.equal(await releaseNext("bootstrap"), true);
    await page.waitForFunction(() => {
      const controls = [...document.querySelectorAll('[role="combobox"]')];
      return controls.length >= 4 && !controls[3].disabled && document.body.textContent?.includes("Campus Rio");
    });
  });

  await check("stale context save failure cannot alter the new context or toast", async () => {
    await open();
    await hold("draft");
    await replaceTitle("contexto anterior", { blur: true });
    await waitForPending("draft");
    const triggers = await page.$$('[role="combobox"]');
    assert.ok(triggers.length >= 1, "Work context control not found");
    await triggers[0].click();
    await page.waitForSelector('[role="option"]');
    const options = await page.$$('[role="option"]');
    const campus = await Promise.all(options.map(async (option) => ({ option, text: await option.evaluate((node) => node.textContent ?? "") })))
      .then((entries) => entries.find((entry) => entry.text.includes("Campus Rio"))?.option);
    assert.ok(campus, "Second work option not found");
    await campus.click();
    await page.waitForFunction(() => document.body.textContent?.includes("Campus Rio"));
    assert.equal(await releaseNext("draft", "stale save failure"), true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal((await page.$$("[data-sonner-toast]")).length, 0);
    assert.match(await page.evaluate(() => document.body.textContent ?? ""), /Campus Rio/);
  });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl, results, browserSignals }, null, 2));
if (
  results.some((result) => result.status === "failed") ||
  browserSignals.pageErrors.length > 0 ||
  browserSignals.consoleErrors.length > 0 ||
  browserSignals.failedResources.length > 0
) process.exitCode = 1;

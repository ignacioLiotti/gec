const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

const moduleRoot = process.env.PLAYWRIGHT_MODULE_ROOT || path.resolve(__dirname, '../..');
const localRequire = createRequire(path.join(moduleRoot, 'package.json'));
const { chromium } = localRequire('@playwright/test');
const baseURL = process.env.FLOW_LAB_URL || 'http://127.0.0.1:4318';
const output = path.join(__dirname, 'verification');
const checks = [];
const errors = [];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => {
      if (!request.url().startsWith(baseURL) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) errors.push(`Unexpected network: ${request.url()}`);
    });
    const check = (name) => checks.push(name);
    const waitText = (text) => page.locator('#preview').getByText(text, { exact: false }).first().waitFor();
    const action = (id) => page.locator(`[data-action="${id}"]`).click();
    const openFlow = async (id) => { await page.locator(`[data-flow="${id}"]`).click(); await page.locator('#proposal-mode').click(); };
    const screenshot = (name) => page.screenshot({ path: path.join(output, name), fullPage: true });
    const assertNoOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page has horizontal overflow');

    assert.equal((await page.goto(baseURL)).status(), 200);
    await page.locator('[data-action="upload"]').waitFor();
    await action('upload');
    await page.locator('[name="amount"]').fill('126500');
    await page.locator('#current-mode').click();
    await waitText('Mapa de la implementación actual');
    await page.locator('#proposal-mode').click();
    assert.equal(await page.locator('[name="amount"]').inputValue(), '126500');
    check('Capture draft survives version toggles');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#restart').click();
    assert.equal(await page.locator('[name="amount"]').inputValue(), '126500');
    check('Cancel reset preserves unsaved data');
    await screenshot('01-capture-desktop.png');
    await page.getByRole('button', { name: 'Guardar datos', exact: true }).click();
    await waitText('Cambios guardados');
    await waitText('126.500');
    await action('source');
    await page.getByLabel('Documento fuente de ejemplo').waitFor();
    check('Capture saves correction and keeps original source');

    await openFlow('generate');
    await action('choose-template');
    await page.locator('[name="subject"]').fill('Pedido de hormigón para etapa 3');
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await waitText('Pedido de hormigón para etapa 3');
    await screenshot('02-generate-desktop.png');
    await action('generate');
    await waitText('Documento generado · en revisión');
    await action('open-review');
    await action('mark-read');
    await waitText('El aviso fue leído. La tarea sigue pendiente.');
    check('Generation leads to review; read status does not resolve task');

    await openFlow('ask');
    await action('ask');
    await waitText('12 meses');
    await action('source');
    await waitText('Cláusula 4. Plazo de ejecución: 12 meses');
    await screenshot('03-ask-desktop.png');
    await page.locator('[name="scope"]').selectOption('parque');
    assert.equal(await page.locator('#preview .paper').count(), 0);
    await action('ask');
    await waitText('8 meses');
    check('Query scope resets answer and source; second example uses its own source');

    await openFlow('report');
    const downloadPromise = page.waitForEvent('download');
    await action('download-report');
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'compras-ejemplo.csv');
    const csv = await fs.readFile(await download.path(), 'utf8');
    assert.ok(csv.includes('125000') && csv.includes('310000'));
    await action('share');
    await page.locator('[name="expiry"]').selectOption('1 día');
    await action('confirm-share');
    assert.equal(await page.locator('[name="expiry"]').inputValue(), '1 día');
    await waitText('Enlace simulado preparado');
    await screenshot('04-report-desktop.png');
    await page.locator('[name="period"]').selectOption('Agosto 2026');
    assert.equal(await page.locator('[data-action="download-report"]').count(), 0);
    assert.equal(await page.locator('[data-action="confirm-share"]').count(), 0);
    check('Report download content, share preview, and empty-period actions');

    await openFlow('configure');
    await action('analyze');
    for (const item of await page.locator('[name="field"]').all()) await item.uncheck();
    await page.getByRole('button', { name: 'Probar resultado' }).click();
    await waitText('Elegí al menos un dato');
    await page.locator('[name="field"][value="Total"]').check();
    await page.getByRole('button', { name: 'Probar resultado' }).click();
    await screenshot('05-configure-desktop.png');
    await action('apply-config');
    await waitText('Campos elegidos: Total');
    check('Configuration requires fields, previews selection and states application scope');

    await openFlow('inbox');
    await page.locator('#restart').click();
    await screenshot('06-inbox-desktop.png');
    await action('review-task');
    await action('resolve-task');
    await waitText('Revisión resuelta en el ejemplo');
    await action('back-inbox');
    assert.equal(await page.locator('[data-action="review-task"]').count(), 0);
    await action('policy-task');
    await action('resolve-task');
    await waitText('El saldo observado se mantiene como dato independiente');
    await action('back-inbox');
    await waitText('No quedan tareas pendientes en este ejemplo');
    check('Inbox document approval and policy cancellation remain distinct');

    for (const id of ['capture', 'generate', 'ask', 'report', 'configure', 'inbox']) {
      await openFlow(id);
      for (const fixture of ['empty', 'loading', 'error', 'readonly', 'normal']) {
        await page.locator('#fixture').selectOption(fixture);
        assert.ok((await page.locator('#preview').innerText()).length > 50);
        await assertNoOverflow();
        if (fixture === 'readonly') assert.equal(await page.locator('#preview [data-action]').count(), 0);
        if (fixture === 'error') { await action('normal'); assert.equal(await page.locator('#fixture').inputValue(), 'normal'); }
      }
    }
    check('All 6 scenarios: normal, empty, loading, recoverable error and restricted states');
    await page.locator('[data-toggle="capture"]').uncheck();
    await page.locator('[data-toggle="ask"]').uncheck();
    await page.reload();
    assert.equal(await page.locator('[data-toggle="capture"]').isChecked(), false);
    assert.equal(await page.locator('[data-toggle="ask"]').isChecked(), false);
    assert.equal(await page.locator('[data-toggle="generate"]').isChecked(), true);
    check('Independent experiment preferences persist through reload');

    await page.setViewportSize({ width: 390, height: 844 });
    await openFlow('capture');
    await action('upload');
    await page.locator('[name="amount"]').waitFor();
    await assertNoOverflow();
    await screenshot('07-capture-mobile.png');
    for (const id of ['generate', 'ask', 'report', 'configure', 'inbox']) { await openFlow(id); await assertNoOverflow(); }
    await screenshot('08-inbox-mobile.png');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await openFlow('capture');
    await page.locator('.preview-region').evaluate(el => { el.style.width = '390px'; });
    assert.equal(await page.locator('.document-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
    await page.locator('.preview-region').evaluate(el => { el.style.width = ''; });
    assert.equal(await page.locator('.document-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    check('Mobile overflow and component layout at narrow/wide widths in same viewport');
    await page.locator('#current-mode').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#current-mode').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'proposal-mode');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#proposal-mode').getAttribute('aria-pressed'), 'true');
    check('Keyboard version controls preserve focus and announce selected mode');
    assert.deepEqual(errors, []);
    check('No browser errors or external network requests');
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ date: new Date().toISOString(), baseURL, browser: 'Edge / Playwright', checks, errors, limitation: 'Prototype only. No authenticated app, storage, OCR provider or production behavior was exercised.' }, null, 2));
    process.stdout.write(`${checks.length} verification groups passed.\n${checks.map(c => `- ${c}`).join('\n')}\n`);
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });

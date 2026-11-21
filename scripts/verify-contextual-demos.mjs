import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.CONTEXTUAL_DEMOS_URL || 'http://127.0.0.1:4320';
const url = `${base}/portfolio/previews/contextual-flows`;
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../deliverables/contextual-flow-demos');
const checks = [];
const errors = [];
const productCalls = [];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce', acceptDownloads: true });
    // A browser with an expired local session used to wait for Supabase retries.
    // This is deliberately invalid fixture data, never a real credential.
    const expiredSession = {
      access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vLWxvY2FsIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjF9.fake-signature',
      refresh_token: 'expired-demo-fixture-not-a-credential',
      expires_at: 1, expires_in: 3600, token_type: 'bearer',
      user: { id: '00000000-0000-0000-0000-000000000000' },
    };
    const expiredCookie = `base64-${Buffer.from(JSON.stringify(expiredSession)).toString('base64url')}`;
    await page.context().addCookies([{ name: 'sb-127-auth-token', value: expiredCookie, url: base }]);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/\/api\/(document-generation|document-ai|obras)\b|\/auth\/v1\/|:54321\//.test(request.url())) productCalls.push(`${request.method()} ${request.url()}`); });
    page.setDefaultTimeout(12000);
    const check = name => checks.push(name);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const flow = async (name) => page.getByRole('navigation', { name: 'Recorridos de demostración' }).getByRole('button', { name: new RegExp(name) }).click();
    const mode = async (name) => page.getByRole('tab', { name, exact: true }).click();
    const text = value => page.getByText(value, { exact: false }).filter({ visible: true }).first().waitFor();
    const screenshot = name => page.screenshot({ path: path.join(output, name), fullPage: true });
    const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Unexpected horizontal page overflow');

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert.equal(response.status(), 200);
    await page.waitForLoadState('networkidle');
    const loadingStarted = performance.now();
    const warmResponse = await page.context().request.get(url, { timeout: 5000 });
    assert.equal(warmResponse.status(), 200);
    const warmLoadMs = Math.round(performance.now() - loadingStarted);
    assert.equal((await page.context().cookies()).find(cookie => cookie.name === 'sb-127-auth-token')?.value, expiredCookie);
    check(`Expired session cookie: warm page response in ${warmLoadMs} ms, cookie unchanged`);
    await button('Generar documento aquí').click();
    await page.getByRole('textbox', { name: 'Proveedor', exact: true }).fill('Proveedor de prueba <b>texto</b>');
    await page.getByRole('textbox', { name: 'Detalle del pedido', exact: true }).fill('Pedido para etapa 3');
    await mode('Selección manual');
    assert.equal(await page.getByRole('textbox', { name: 'Detalle del pedido', exact: true }).inputValue(), 'Pedido para etapa 3');
    await page.getByRole('combobox', { name: 'Obra', exact: true }).selectOption('demo-ribera');
    await page.getByRole('combobox', { name: 'Tipo de documento', exact: true }).selectOption('PURCHASE_ORDER');
    await page.getByRole('combobox', { name: 'Carpeta destino', exact: true }).selectOption('Compras');
    await page.getByRole('combobox', { name: 'Plantilla', exact: true }).selectOption('oc-standard');
    await screenshot('01-generation-manual.png');
    await mode('Desde la obra');
    await button('Guardar borrador').click();
    await text('Borrador guardado en la demo');
    await flow('Consultar documentos');
    await flow('Generar un documento');
    assert.equal(await page.getByRole('textbox', { name: 'Detalle del pedido', exact: true }).inputValue(), 'Pedido para etapa 3');
    await button('Revisar documento').click();
    const preview = page.frameLocator('iframe[title="Vista previa de la orden de compra"]');
    await preview.getByText('Proveedor de prueba <b>texto</b>').waitFor();
    assert.equal(await preview.locator('b').count(), 0);
    await screenshot('02-generation-contextual.png');
    await button('Generar y volver a Compras').click();
    await text('En revisión');
    await button('Abrir documento').click();
    const downloadPromise = page.waitForEvent('download');
    await button('Descargar HTML de ejemplo').click();
    const download = await downloadPromise;
    const generated = await fs.readFile(await download.path(), 'utf8');
    assert.ok(generated.includes('Pedido para etapa 3') && generated.includes('&lt;b&gt;texto&lt;/b&gt;'));
    await page.keyboard.press('Escape');
    await expect(button('Abrir documento')).toBeFocused();
    check('Generation: both flows, preserved draft, shared renderer escapes input, real HTML download, review state and dialog focus');

    await page.getByLabel('Caso de prueba', { exact: true }).filter({ visible: true }).selectOption('multiple');
    await button('Generar documento aquí').click();
    assert.equal(await page.getByRole('combobox', { name: 'Plantilla', exact: true }).inputValue(), '');
    await page.getByRole('combobox', { name: 'Plantilla', exact: true }).selectOption('oc-materials');
    await button('Revisar documento').click();
    await preview.getByText('Plantilla: Orden de compra de materiales').waitFor();
    await button('Editar datos').click();
    await page.locator('#generation-case').selectOption('none');
    await text('No hay plantillas para esta carpeta');
    assert.equal(await button('Revisar documento').count(), 0);
    await page.locator('#generation-case').selectOption('readonly');
    await text('No tenés permiso para generar');
    await page.locator('#generation-case').selectOption('error');
    await button('Revisar documento').click();
    await button('Generar y volver a Compras').click();
    await text('No se pudo generar el archivo');
    await button('Editar datos').click();
    assert.equal(await page.getByRole('textbox', { name: 'Detalle del pedido', exact: true }).inputValue(), 'Pedido para etapa 3');
    await page.locator('#generation-case').selectOption('one');
    check('Generation: multiple/zero templates, restricted action and failed generation retain form data');

    await flow('Consultar documentos');
    await mode('Selección manual');
    assert.equal(await button('Consultar').isDisabled(), true);
    await page.getByRole('combobox', { name: 'Obra incluida', exact: true }).selectOption('demo-ribera');
    await button('Consultar').click();
    await text('El contrato establece 12 meses');
    await mode('Desde la obra');
    await button('Contrato de obra · página 3').click();
    await page.frameLocator('iframe[title="Contrato de obra · página 3"]').getByText('12 meses', { exact: true }).waitFor();
    await screenshot('03-query-source.png');
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Carpetas incluidas', exact: true }).selectOption('Compras');
    assert.equal(await button('Contrato de obra · página 3').count(), 0);
    await button('Consultar').click();
    await text('No hay evidencia para responder');
    await button('Monto de la factura').click();
    await button('Consultar').click();
    await text('Es el importe del documento de ejemplo');
    await page.getByRole('combobox', { name: 'Carpetas incluidas', exact: true }).selectOption('Planos');
    await text('No hay documentos en Planos');
    assert.equal(await button('Consultar').count(), 0);
    await page.getByRole('combobox', { name: 'Carpetas incluidas', exact: true }).selectOption('Contratos');
    await page.locator('#query-case').selectOption('error');
    await button('Consultar').click();
    await text('No se amplió la consulta a otras obras');
    await page.locator('#query-case').selectOption('readonly');
    assert.equal(await button('Consultar').count(), 0);
    await page.locator('#query-case').selectOption('normal');
    check('Query: explicit manual scope, contextual source, scope changes invalidate response, no evidence/empty/error/restricted states');

    await flow('Cargar y revisar');
    await page.locator('#capture-case').selectOption('ocr-error');
    await button('Cargar factura de ejemplo').click();
    await text('El archivo está guardado; la extracción falló');
    await button('Reintentar extracción').click();
    await page.getByRole('spinbutton', { name: 'Total (ARS)', exact: true }).fill('125000');
    await text('Tenés cambios sin guardar');
    await mode('Selección manual');
    await page.getByRole('tab', { name: 'Tabla de datos', exact: true }).click();
    assert.equal(await page.getByRole('spinbutton', { name: 'Total (ARS)', exact: true }).inputValue(), '125000');
    await mode('Desde la obra');
    await page.locator('#capture-case').selectOption('save-error');
    await button('Guardar datos').click();
    await text('No se pudieron guardar los datos');
    await page.locator('#capture-case').selectOption('normal');
    await screenshot('04-capture-review.png');
    await button('Guardar datos').click();
    await text('Datos guardados · $');
    await button('Ver original').click();
    await page.frameLocator('iframe[title="Factura original de ejemplo"]').getByText('$ 125.000,00', { exact: true }).first().waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#capture-case').selectOption('readonly');
    assert.equal(await button('Guardar datos').isDisabled(), true);
    assert.equal(await page.getByRole('spinbutton', { name: 'Total (ARS)', exact: true }).getAttribute('readonly'), '');
    await page.locator('#capture-case').selectOption('normal');
    check('Capture: upload/processing, retry without duplicate upload, correction retained across variants, save failure, immutable original and read-only controls');

    await page.getByRole('switch', { name: 'Activar mejora: Generar un documento' }).uncheck();
    await page.getByRole('switch', { name: 'Activar mejora: Consultar documentos' }).uncheck();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('switch', { name: 'Activar mejora: Generar un documento' }).isChecked(), false);
    assert.equal(await page.getByRole('switch', { name: 'Activar mejora: Consultar documentos' }).isChecked(), false);
    assert.equal(await page.getByRole('switch', { name: 'Activar mejora: Cargar y revisar' }).isChecked(), true);
    check('Independent demo flags survive reload through the URL');

    await page.setViewportSize({ width: 390, height: 844 });
    await button('Cargar factura de ejemplo').click();
    await page.getByRole('spinbutton', { name: 'Total (ARS)', exact: true }).waitFor();
    await noOverflow();
    await screenshot('05-capture-mobile.png');
    await flow('Generar un documento');
    await mode('Desde la obra');
    await button('Generar documento aquí').click();
    await noOverflow();
    await screenshot('06-generation-mobile.png');
    await flow('Consultar documentos');
    await mode('Desde la obra');
    await button('Consultar').click();
    await button('Contrato de obra · página 3').click();
    await noOverflow();
    await screenshot('07-query-mobile.png');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1050 });
    await flow('Cargar y revisar');
    const panel = page.getByRole('region', { name: 'Demo de carga y revisión' });
    await panel.evaluate(el => { el.style.width = '390px'; });
    const grid = panel.locator('[class*="split"]');
    assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
    await panel.evaluate(el => { el.style.width = ''; });
    assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    check('Mobile forms and source dialog, no horizontal overflow, component-owned responsive layout');

    assert.deepEqual(productCalls, []);
    assert.deepEqual(errors, []);
    check('No product API requests or browser errors');
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ date: new Date().toISOString(), url, checks, errors, productCalls, scope: 'Next.js demos only, no authenticated product workflows or OCR service calls.' }, null, 2));
    process.stdout.write(`${checks.length} verification groups passed\n${checks.join('\n')}\n`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, errors, productCalls, body: await page.locator('body').innerText() }, null, 2));
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });

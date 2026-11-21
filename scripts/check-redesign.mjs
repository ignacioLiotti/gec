import { chromium, expect } from '@playwright/test';
import puppeteer from 'puppeteer';
const base = 'http://localhost:6006';
const index = await (await fetch(`${base}/index.json`)).json();
const entries = Object.values(index.entries).filter(e => e.type === 'story' && /^(App UI|Shared system|Patterns)\//.test(e.title));
const browser = await chromium.launch({ executablePath: puppeteer.executablePath(), headless: true });
const failures = [];
const jobs = process.argv.includes('--screens-only') ? [] : entries.flatMap(e => ['light','dark'].map(theme => ({id:e.id,theme})));
const screens = ['inicio','excel','obra','documentos','general','macrotablas','reportes'];
jobs.push(...screens.flatMap(s => ['light','dark'].map(theme => ({id:`rediseno-pantallas--${s}`,theme}))));
const count = jobs.length;
try {
 await Promise.all(Array.from({length:4}, async () => {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  while(jobs.length) {
   const {id,theme} = jobs.shift(); errors = [];
   try {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};design:paper`);
    await expect(page.locator('.sb-canvas')).toBeAttached();
    await expect(page.locator('#storybook-root > .sb-canvas')).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-design','paper');
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b).*$/);
    if(id.startsWith('rediseno-pantallas')) {
     await expect(page.locator('.paper-workspace')).toHaveCount(1);
     await expect(page.locator('.paper-brand')).toHaveCSS('font-size','21px');
     await expect(page.locator('.paper-main')).toHaveCSS('border-radius','17px');
     await expect(page.getByText('Pantallas con Interior + Beautiful',{exact:true})).toHaveCount(0);
     await expect(page.locator('.screen-example-controls,.screen-app')).toHaveCount(0);
     await page.screenshot({path:`.codex-tmp/${id}-${theme}.png`,fullPage:true});
    }
    expect(errors).toEqual([]);
   } catch(e) { failures.push({id,theme,error:e.message}); }
   if(jobs.length % 50 === 0) console.log(`Remaining renders: ${jobs.length}`);
  }
  await page.close();
 }));
 expect(failures).toEqual([]);
 const page = await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto(`${base}/iframe.html?id=rediseno-pantallas--excel&viewMode=story`);
 const createButton = page.getByRole('button',{name:'Nueva obra',exact:true});
 await expect(createButton).toHaveCSS('background-image', /linear-gradient/);
 await createButton.click();
 await page.getByLabel('Designación y ubicación',{exact:true}).fill('Obra de prueba Papel');
 await page.getByRole('button',{name:'Crear obra',exact:true}).click();
 await expect(page.getByRole('button',{name:'Obra de prueba Papel',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Torre Madero · Dique 2',exact:true}).click();
 await expect(page.locator('.paper-sidebar a[aria-current="page"]')).toHaveText('Obra');
 await page.getByRole('tab',{name:'Documentos New',exact:true}).click();
 await page.getByRole('button',{name:'Certificado 08 · Agosto.pdf',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar revisión',exact:true}).click();
 await expect(page.getByRole('button',{name:'Volver a documentos',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Volver a documentos',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.setViewportSize({width:1600,height:1100});
 await page.goto(`${base}/iframe.html?id=rediseno-propuesta--revision&viewMode=story`);
 await page.getByRole('button',{name:'Biblioteca completa',exact:true}).click();
 await expect(page.getByLabel('Componente y variante').locator('option')).toHaveCount(entries.length);
 await expect(page.frameLocator('iframe[title="Componente actual"]').locator('html')).toHaveAttribute('data-design','current');
 await expect(page.frameLocator('iframe[title="Componente propuesto"]').locator('html')).toHaveAttribute('data-design','paper');
 await page.screenshot({path:'.codex-tmp/redesign-comparison.png',fullPage:true});
 await page.getByLabel('Componente y variante').selectOption('app-ui-dialog--default');
 const proposed = page.frameLocator('iframe[title="Componente propuesto"]');
 await proposed.getByRole('button',{name:'Open dialog',exact:true}).click();
 await expect(proposed.getByRole('dialog')).toBeVisible();
 await expect(proposed.getByRole('dialog')).toHaveCSS('border-radius','15px');
 await proposed.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(proposed.getByRole('dialog')).toHaveCount(0);
 await expect(proposed.getByRole('button',{name:'Open dialog',exact:true})).toBeFocused();
 await page.goto(`${base}/iframe.html?id=rediseno-pantallas--macrotablas&viewMode=story`);
 await expect(page.locator('.redesign-data-screen tbody tr')).toHaveCount(4);
 await page.getByRole('button',{name:'Ver registro',exact:true}).click();
 await expect(page.locator('.redesign-data-screen tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Vista previa',exact:true}).click();
 await expect(page.locator('.redesign-report-paper')).toContainText('Distrito Norte');
 const download = page.waitForEvent('download');
 await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 expect((await download).suggestedFilename()).toBe('sintesis-propuesta-ejemplo.csv');
 await page.getByRole('button',{name:'Volver a datos',exact:true}).click();
 await expect(page.locator('.redesign-data-screen tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Limpiar',exact:true}).click();
 await page.getByLabel('Buscar obra').fill('Madero');
 await page.getByLabel('Período',{exact:true}).selectOption('Julio 2026');
 await expect(page.locator('.redesign-data-screen tbody tr')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'.codex-tmp/redesign-mobile.png',fullPage:true});
 await page.goto(`${base}/iframe.html?id=vibe-papel-y-luz--playground&viewMode=story`);
 await expect(page.locator('.paper-nav-active')).toHaveCSS('box-shadow','none');
 await expect(page.locator('.paper-gloss-tooltip')).toHaveCSS('backdrop-filter','blur(18px) saturate(1.15)');
 const darkGlass = await page.locator('.paper-gloss-tooltip').evaluate(e=>getComputedStyle(e).backgroundColor);
 expect(darkGlass).toBe('rgba(48, 51, 43, 0.44)');
 await page.getByLabel('Cambiar material del gráfico').click();
 await expect(page.locator('.paper-chart')).toHaveAttribute('data-dark','false');
 await expect(page.locator('.paper-gloss-tooltip')).toHaveCSS('color','rgb(48, 53, 43)');
 console.log(JSON.stringify({families:new Set(entries.map(e=>e.title)).size,variants:entries.length,renders:count,comparison:'passed',filterPreviewDownload:'passed',mobile:'passed',frostedTooltip:'passed',failures}));
} finally { await browser.close(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../helpers/http-server.js';
import { chromium, launchOptions, observe, loadAll, assertClean } from '../helpers/champion-browser.js';

const approved = JSON.parse(await readFile(new URL('../../docs/phase-1.1/image-audit.json', import.meta.url)));
approved.records.push(...JSON.parse(await readFile(new URL('../../docs/phase-2/image-audit.json', import.meta.url))).records);
const output = resolve(process.env.F1_IMAGE_AUDIT_DIR || join(tmpdir(), 'f1-champion-image-audit'));
const imageProvider = /^https:\/\/(thumb|upload)\.wikimedia\.org\//;

test('live champion photograph audit: real HTTP, reviewed bytes and Chrome decoding', { timeout: 180000 }, async t => {
  await mkdir(output, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch(launchOptions);
  const report = { generatedAt: new Date().toISOString(), browser: browser.version(),
    photographs: [], scenarios: {}, console: [], httpErrors: [], requestFailures: [], exceptions: [], cspViolations: [] };
  t.after(async () => {
    await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    await server.close();
  });
  async function setup(label, options = {}) {
    const context = await browser.newContext(options);
    await observe(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); report.exceptions.push({ scenario: label, error: error.message }); });
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) report.console.push({ scenario: label, type: message.type(), text: message.text(), location: message.location() });
    });
    page.on('response', response => {
      if (response.status() >= 400) report.httpErrors.push({ scenario: label, url: response.url(), status: response.status() });
    });
    page.on('requestfailed', request => report.requestFailures.push({ scenario: label, url: request.url(), error: request.failure()?.errorText }));
    return { context, page, errors };
  }
  async function clean(page, errors, scenario) {
    const state = await page.evaluate(() => imageAudit);
    report.cspViolations.push(...state.violations.map(violation => ({ scenario, ...violation })));
    await assertClean(page, errors);
  }
  async function screenshots(page, label) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})));
    });
    for (const [part, fraction] of [['first', 0], ['middle', 0.5], ['last', 1]]) {
      await page.evaluate(fraction => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * fraction, behavior: 'instant' }), fraction);
      await page.screenshot({ path: join(output, `${label}-${part}.png`) });
    }
  }

  await t.test('desktop: all 35 real photographs decode, match approved sources and never use placeholders', async () => {
    const { context, page, errors } = await setup('desktop', { viewport: { width: 1440, height: 1000 } });
    await page.goto(`${server.origin}/F1/champions.html`, { waitUntil: 'domcontentloaded' });
    const images = await loadAll(page);
    // Validate response bytes independently of the DOM: HTML errors and replaced subjects must fail.
    for (const record of approved.records) {
      const actual = images.find(image => image.name === record.name);
      const response = await context.request.get(record.replacement.url, { timeout: 20000 });
      const bytes = await response.body();
      const result = { ...actual, status: response.status(), contentType: response.headers()['content-type'], bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), jpegSignature: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9 };
      report.photographs.push(result);
    }
    for (const image of report.photographs) {
      const expected = approved.records.find(record => record.name === image.name).replacement;
      assert.equal(image.status, 200, image.name);
      assert.equal(image.contentType?.split(';')[0], 'image/jpeg', image.name);
      assert.ok(image.jpegSignature, image.name);
      assert.equal(image.sha256, expected.sha256, `${image.name}: changed image bytes require renewed identity review`);
      assert.equal(image.url, expected.url, image.name);
      assert.equal(image.fallback, false, image.name);
      assert.ok(image.width > 0 && image.height > 0, image.name);
      assert.equal(image.width, expected.width, image.name);
      assert.equal(image.height, expected.height, image.name);
    }
    await page.locator('.portrait').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshots(page, 'desktop');
    await clean(page, errors, 'desktop');
    report.scenarios.desktop = { genuine: 35, fallbacks: 0, failures: 0 };

    // A labeled overview makes visual identity review possible without treating a byte check as face recognition.
    const sheet = await context.newPage();
    await sheet.setViewportSize({ width: 1200, height: 1000 });
    await sheet.setContent('<!doctype html><html><head><title>Champion identity review</title><style>body{font:16px Arial;background:#171717;color:white;margin:16px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}figure{margin:0;text-align:center}img{width:160px;height:180px;object-fit:contain}figcaption{min-height:40px}</style></head><body><main></main></body></html>');
    await sheet.evaluate(records => {
      const main = document.querySelector('main');
      records.forEach(record => {
        const figure = document.createElement('figure');
        const image = document.createElement('img');
        image.src = record.replacement.url; image.alt = record.name;
        const caption = document.createElement('figcaption'); caption.textContent = record.name;
        figure.append(image, caption); main.append(figure);
      });
    }, approved.records);
    await sheet.waitForFunction(() => document.images.length === 35 && [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await sheet.screenshot({ path: join(output, 'identity-contact-sheet.png'), fullPage: true });
    await context.close();
  });

  await t.test('mobile: 35 genuine photographs, accessible credits, no overflow and reduced-motion support', async () => {
    const { context, page, errors } = await setup('mobile', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`${server.origin}/F1/champions.html`);
    const images = await loadAll(page);
    assert.equal(images.filter(image => !image.fallback && image.width > 0 && image.height > 0).length, 35);
    assert.equal(await page.locator('.photo-credit a').count(), 70);
    assert.ok(await page.locator('.bottom-nav').isVisible());
    assert.equal(await page.locator('.champion-card').first().evaluate(element => getComputedStyle(element).animationName), 'none');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await screenshots(page, 'mobile');
    await clean(page, errors, 'mobile');
    report.scenarios.mobile = { genuine: 35, fallbacks: 0, failures: 0, widths: [320, 390], reducedMotion: true };
    await context.close();
  });

  await t.test('intentionally unavailable third-party source produces exactly one local fallback', async () => {
    const { context, page, errors } = await setup('intentional-failure', { serviceWorkers: 'block' });
    const broken = approved.records[0];
    await context.route(url => url.href === broken.replacement.url, route => route.abort('failed'));
    await page.goto(`${server.origin}/F1/champions.html`);
    const images = await loadAll(page);
    const fallback = images.find(image => image.name === broken.name);
    assert.ok(fallback.fallback && fallback.width > 0 && fallback.height > 0);
    assert.equal(images.filter(image => !image.fallback && image.width > 0).length, 34);
    assert.deepEqual(await page.evaluate(() => imageAudit.failures), { [`Foto de ${broken.name}`]: 1 });
    await clean(page, errors, 'intentional-failure');
    report.scenarios.intentionalFailure = { genuine: 34, fallbacks: 1, expectedSourceFailures: 1, retriesPerImage: 1 };
    await context.close();
  });

  await t.test('offline navigation retains all 35 records, decoded local fallbacks and the 27-resource shell', async () => {
    const { context, page, errors } = await setup('offline');
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    await context.route(imageProvider, route => route.abort('internetdisconnected'));
    assert.equal((await page.goto(`${server.origin}/F1/champions.html?sort=name`)).status(), 200);
    const images = await loadAll(page);
    assert.equal(images.filter(image => image.fallback && image.width > 0).length, 35);
    const cached = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find(name => name.endsWith('static-v6')));
      return (await cache.keys()).map(request => request.url);
    });
    assert.equal(cached.length, 27);
    assert.ok(cached.every(url => url.startsWith(`${server.origin}/F1/`)));
    assert.equal((await page.goto(`${server.origin}/F1/404.html`)).status(), 200);
    await clean(page, errors, 'offline');
    report.scenarios.offline = { records: 35, fallbacks: 35, shellEntries: cached.length, crossOriginCacheEntries: 0 };
    await context.close();
  });
  t.diagnostic(`Evidence and gallery screenshots: ${output}`);
  t.diagnostic(`Normal desktop photograph loads: ${report.photographs.filter(image => !image.fallback && image.width > 0).length}; placeholders are reported separately.`);
});

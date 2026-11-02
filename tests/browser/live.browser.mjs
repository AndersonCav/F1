import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { startServer } from '../helpers/http-server.js';

const pwModule = await import(process.env.F1_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.F1_PLAYWRIGHT_MODULE).href : 'playwright');
const chromium = pwModule.chromium || pwModule.default?.chromium;
const launchOptions = { headless: true,
  ...(process.env.F1_BROWSER_EXECUTABLE ? { executablePath: process.env.F1_BROWSER_EXECUTABLE }
    : (process.env.F1_BROWSER_CHANNEL !== undefined ? (process.env.F1_BROWSER_CHANNEL ? { channel: process.env.F1_BROWSER_CHANNEL } : {})
    : { channel: 'chrome' })) };

test('live external services with real browser network and no resource mocks', { timeout: 120000 }, async t => {
  const server = await startServer();
  const browser = await chromium.launch(launchOptions);
  t.after(async () => { await browser.close(); await server.close(); });
  const context = await browser.newContext();
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const responses = [];
  const failures = [];
  const errors = [];
  page.on('response', response => {
    if (!response.url().startsWith(server.origin)) responses.push({ url: response.url(), status: response.status() });
  });
  page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => cspViolations.push({ directive: event.effectiveDirective, uri: event.blockedURI }));
  });
  for (const [path, content] of [
    ['index.html', '.standings-table'], ['drivers.html', '.driver-card'], ['teams.html', '.team-card'],
    ['champions.html', '.champion-card'], ['calendar.html', '.calendar-item'], ['404.html', '.error-card']
  ]) {
    await t.test(`live ${path}`, async () => {
      await page.goto(`${server.origin}/F1/${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('.skeleton-card'));
      assert.equal(await page.locator(content).first().isVisible(), true, `${path} should render real content`);
      assert.deepEqual(await page.evaluate(() => cspViolations), []);
      if (path === 'champions.html') {
        await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
        await page.waitForFunction(() => [...document.images].every(image => image.complete));
        const images = await page.evaluate(() => [...document.images].map(image => ({ url: image.currentSrc, loaded: image.naturalWidth > 0 })));
        const fallbacks = images.filter(image => image.url.endsWith('/placeholder-driver.svg')).length;
        assert.equal(images.length, 35);
        assert.ok(images.every(image => image.loaded), 'Every genuine photograph must decode');
        assert.equal(fallbacks, 0, 'A placeholder does not count as a recovered photograph');
        t.diagnostic(`Champion photographs: ${images.length} decoded; ${fallbacks} local fallbacks.`);
      }
      if (process.env.F1_SCREENSHOT_DIR && ['index.html', 'champions.html', '404.html'].includes(path)) {
        if (path !== 'index.html') await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => {})));
        });
        await page.screenshot({ path: `${process.env.F1_SCREENSHOT_DIR}/${path}.png` });
      }
    });
  }
  const summary = {};
  for (const response of responses) {
    const key = `${new URL(response.url).hostname} HTTP ${response.status}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  const failed = {};
  for (const failure of failures) {
    const key = `${new URL(failure.url).hostname} ${failure.error}`;
    failed[key] = (failed[key] || 0) + 1;
  }
  t.diagnostic(`Real external HTTP summary: ${JSON.stringify(summary)}`);
  t.diagnostic(`Real failed requests: ${JSON.stringify(failed)}`);
  // One representative response per failing external origin distinguishes provider errors from CSP.
  for (const host of [...new Set(failures.filter(failure => !failure.url.startsWith(server.origin)).map(failure => new URL(failure.url).hostname))]) {
    const url = failures.find(failure => new URL(failure.url).hostname === host).url;
    try {
      const response = await context.request.get(url, { timeout: 10000 });
      t.diagnostic(`Provider probe: ${JSON.stringify({ url, status: response.status(), type: response.headers()['content-type'] })}`);
    } catch (error) { t.diagnostic(`Provider probe failed for ${host}: ${error.message}`); }
  }
  assert.deepEqual(errors, []);
});

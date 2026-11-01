import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../helpers/http-server.js';
import { chromium, launchOptions, observe, loadAll, assertClean } from '../helpers/champion-browser.js';
import { CHAMPIONS_HISTORY } from '../../assets/js/static-data.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>';
async function fixtures(context, fail = false) {
  await observe(context);
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\//, route => fail ? route.abort('failed') : route.fulfill({ contentType: 'image/svg+xml', body: svg }));
}

test('controlled champion image reliability (fixture images are not photograph evidence)', { timeout: 120000 }, async t => {
  const server = await startServer();
  const browser = await chromium.launch(launchOptions);
  t.after(async () => { await browser.close(); await server.close(); });

  await t.test('lazy dimensions, accessible source/license credits and correct association survive sorting/filtering', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.locator('.champion-card').first().waitFor();
    assert.equal(await page.locator('.champion-card').count(), 35);
    for (const sort of ['titles', 'name', 'firstYear']) {
      await page.locator('#sort-select').selectOption(sort);
      for (const filter of ['all', '1', '2', '3plus', '5plus']) {
        await page.locator('#titles-filter').selectOption(filter);
        const cards = await page.locator('.champion-card').evaluateAll(cards => cards.map(card => ({
          name: card.querySelector('.name').textContent, src: card.querySelector('img').src,
          alt: card.querySelector('img').alt, lazy: card.querySelector('img').loading,
          width: Number(card.querySelector('img').getAttribute('width')), height: Number(card.querySelector('img').getAttribute('height')),
          links: [...card.querySelectorAll('.photo-credit a')].map(a => ({ href: a.href, text: a.textContent }))
        })));
        assert.ok(cards.length > 0);
        for (const card of cards) {
          const data = CHAMPIONS_HISTORY.find(record => record.name === card.name);
          assert.equal(card.src, data.photo);
          assert.equal(card.alt, `Foto de ${data.name}`);
          assert.equal(card.lazy, 'lazy');
          assert.equal(card.width, 100);
          assert.equal(card.height, 100);
          assert.deepEqual(card.links, [{ href: new URL(data.photoCredit.sourceUrl).href, text: data.photoCredit.attribution },
            { href: new URL(data.photoCredit.licenseUrl).href, text: data.photoCredit.license }]);
        }
      }
    }
    await assertClean(page, errors);
    await context.close();
  });

  await t.test('all 35 unavailable sources use one decoded local fallback, preserving alt and dimensions', async () => {
    const context = await browser.newContext();
    await fixtures(context, true);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.origin}/F1/champions.html`);
    const images = await loadAll(page);
    assert.ok(images.every(image => image.fallback && image.width > 0 && image.height > 0 && image.alt === `Foto de ${image.name}`));
    await page.evaluate(async () => {
      const { setImageFallback } = await import('./assets/js/static-data.js');
      document.querySelectorAll('.portrait').forEach(image => { setImageFallback(image); setImageFallback(image); });
    });
    const failures = await page.evaluate(() => imageAudit.failures);
    assert.equal(Object.keys(failures).length, 35);
    assert.ok(Object.values(failures).every(count => count === 1));
    await assertClean(page, errors);
    await context.close();
  });

  await t.test('offline gallery degrades to the shell placeholder without caching any photographs', async () => {
    const context = await browser.newContext();
    await fixtures(context, true);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await context.setOffline(true);
    assert.equal((await page.reload()).status(), 200);
    const images = await loadAll(page);
    assert.equal(images.filter(image => image.fallback && image.width > 0).length, 35);
    const entries = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find(name => name.endsWith('static-v5')));
      return (await cache.keys()).map(request => request.url);
    });
    assert.equal(entries.length, 25);
    assert.ok(entries.every(url => url.startsWith(`${server.origin}/F1/`)));
    await assertClean(page, errors);
    await context.close();
  });

  await t.test('Phase 1 v3 upgrades to v5 after old clients close, preserving unrelated caches', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    server.state.release = 'phase1';
    let page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload();
    await page.locator('.champion-card').first().waitFor();
    assert.ok((await page.locator('.portrait').first().getAttribute('src')).includes('/512px-'));
    await page.evaluate(async () => (await caches.open('other-app-v1')).put('/keep', new Response('keep')));
    server.state.release = 'current';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting);
    assert.ok((await page.locator('.portrait').first().getAttribute('src')).includes('/512px-'));
    let nextWorker;
    for (const worker of context.serviceWorkers()) {
      if (await worker.evaluate(() => CACHE_VERSION) === 'v5') nextWorker = worker;
    }
    assert.ok(nextWorker);
    await page.close();
    // Keep all old clients closed until the waiting release has actually activated.
    await nextWorker.evaluate(async () => {
      const deadline = Date.now() + 30000;
      while (self.registration.waiting || self.registration.installing || self.registration.active?.state !== 'activated') {
        if (Date.now() > deadline) throw new Error('v5 did not activate after old clients closed');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
    page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.waitForFunction(async () => (await caches.keys()).includes('f1-portal:/F1/:static-v5'));
    await page.waitForFunction(async () => !(await caches.keys()).includes('f1-portal:/F1/:static-v3'));
    const images = await loadAll(page);
    assert.deepEqual(images.filter(image => image.url !== CHAMPIONS_HISTORY.find(champion => champion.name === image.name).photo), []);
    const names = await page.evaluate(() => caches.keys());
    assert.ok(!names.includes('f1-portal:/F1/:static-v3'));
    assert.ok(names.includes('other-app-v1'));
    assert.equal(await page.evaluate(async () => (await (await caches.open('other-app-v1')).match('/keep')).text()), 'keep');
    await assertClean(page, errors);
    await context.close();
  });
});

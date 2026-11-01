import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { startServer } from '../helpers/http-server.js';

// Reuse an available Playwright installation. It is intentionally not a production dependency.
const { chromium } = await import(process.env.F1_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.F1_PLAYWRIGHT_MODULE).href : 'playwright');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>';
const driver = { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', nationality: 'Dutch', code: 'VER' };
const constructor = { constructorId: 'red_bull', name: 'Red Bull' };
const race = { season: '2026', round: '1', raceName: 'Brazilian Grand Prix', date: '2026-12-06', time: '17:00:00Z',
  Circuit: { circuitId: 'interlagos', circuitName: 'Interlagos', Location: { country: 'Brazil', locality: 'São Paulo' } },
  Results: [{ Driver: driver, position: '1', Time: { time: '1:30:00' } }] };
function apiData(url) {
  if (url.includes('constructorStandings')) return { MRData: { total: '1', offset: '0', StandingsTable: { season: '2026', StandingsLists: [{ season: '2026', round: '2', ConstructorStandings: [{ position: '1', points: '100', wins: '2', Constructor: constructor }] }] } } };
  if (url.includes('driverStandings')) return { MRData: { total: '1', offset: '0', StandingsTable: { season: '2026', StandingsLists: [{ season: '2026', round: '2', DriverStandings: [{ position: '1', points: '100', wins: '2', Driver: driver, Constructors: [constructor] }] }] } } };
  if (url.includes('drivers.json')) return { MRData: { total: '1', offset: '0', DriverTable: { season: '2026', Drivers: [driver] } } };
  return { MRData: { total: '1', offset: '0', RaceTable: { season: '2026', Races: [race] } } };
}
async function fixtures(context, state = {}) {
  await context.route('https://api.jolpi.ca/**', route => {
    state.apiRequests = (state.apiRequests || 0) + 1;
    return state.apiFails ? route.abort('failed') : route.fulfill({ json: apiData(route.request().url()) });
  });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.route(/^https:\/\/(media\.formula1\.com|flagsapi\.com|upload\.wikimedia\.org|thumb\.wikimedia\.org)\//,
    route => state.imagesFail ? route.abort('failed') : route.fulfill({ contentType: 'image/svg+xml', body: svg }));
  await context.addInitScript(offset => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
      static now() { return NativeDate.now() + offset; }
    };
    window.validation = { violations: [], rejections: [] };
    document.addEventListener('securitypolicyviolation', event => window.validation.violations.push({ directive: event.effectiveDirective, uri: event.blockedURI }));
    window.addEventListener('unhandledrejection', event => window.validation.rejections.push(String(event.reason)));
  }, Date.parse('2026-11-01T12:00:00Z') - Date.now());
}
async function controlled(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate(() => navigator.serviceWorker.ready);
}

test('Phase 1 real Chromium lifecycle, navigation, CSP, recovery and compatibility', { timeout: 180000 }, async t => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true,
    ...(process.env.F1_BROWSER_EXECUTABLE ? { executablePath: process.env.F1_BROWSER_EXECUTABLE } : { channel: 'chrome' }) });
  t.after(async () => { await browser.close(); await server.close(); });

  await t.test('fresh /F1/ installation, all pages, desktop/mobile links, reduced motion and inline style compatibility', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.origin}/F1/`);
    await controlled(page);
    await page.locator('.standings-table').first().waitFor();
    const caches = await page.evaluate(async () => {
      const name = (await window.caches.keys()).find(name => name.includes('static-v5'));
      return (await (await window.caches.open(name)).keys()).map(request => request.url);
    });
    assert.equal(caches.length, 25);
    assert.ok(caches.every(url => url.startsWith(`${server.origin}/F1/`)));
    assert.ok(!server.state.requests.some(request => request.status === 404));
    for (const path of ['drivers.html', 'teams.html', 'champions.html', 'calendar.html', 'index.html']) {
      await page.locator(`.sidebar a[href="${path}"]`).click();
      await page.waitForURL(`**/${path}`);
      await page.waitForFunction(() => !document.querySelector('.skeleton-card'));
      assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    }
    await page.goto(`${server.origin}/F1/drivers.html`);
    await page.locator('.driver-card').waitFor();
    assert.equal(await page.locator('.driver-number').evaluate(element => getComputedStyle(element).color), 'rgb(30, 91, 198)');
    await page.locator('.expand-btn').click();
    assert.equal(await page.locator('.expand-btn').getAttribute('aria-expanded'), 'true');
    await page.locator('#search-input').fill('no such driver');
    await page.locator('.empty-message').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.bottom-nav').isVisible(), true);
    await page.locator('.bottom-nav a[href="champions.html"]').click();
    await page.locator('.champion-card').first().waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.champion-card').first().evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
    assert.deepEqual(errors, []);
    await context.close();
  });

  await t.test('offline application-shell navigation, saved data, manual refresh failure and unknown nested route', async () => {
    const context = await browser.newContext();
    const state = {};
    await fixtures(context, state);
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/calendar.html`);
    await controlled(page);
    await page.locator('.calendar-item').waitFor();
    const before = await page.evaluate(() => localStorage.getItem('f1_current_schedule'));
    state.apiFails = true;
    state.imagesFail = true;
    await context.setOffline(true);
    await page.locator('#clear-cache-btn').click();
    await page.waitForURL('**/calendar.html');
    await page.locator('#cache-info').filter({ hasText: 'DADOS SALVOS' }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('f1_current_schedule')), before);
    await page.setViewportSize({ width: 320, height: 700 });
    assert.ok(await page.locator('#clear-cache-btn').evaluate(button => {
      const bounds = button.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }));
    for (const path of ['index.html', 'drivers.html?sort=name', 'teams.html', 'champions.html', 'calendar.html']) {
      const response = await page.goto(`${server.origin}/F1/${path}`);
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => !document.querySelector('.skeleton-card'));
      assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    }
    const response = await page.goto(`${server.origin}/F1/deep/missing`);
    assert.equal(response.status(), 404);
    assert.equal(await page.locator('link[rel="stylesheet"]').last().evaluate(link => link.sheet !== null), true);
    await page.locator('a.button').click();
    await page.waitForURL('**/F1/index.html');
    await context.close();
  });

  await t.test('API unavailability without saved data gives an accessible retry state', async () => {
    const context = await browser.newContext();
    await fixtures(context, { apiFails: true });
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/drivers.html`);
    await page.locator('[role="alert"]').waitFor();
    await page.locator('button.button').click();
    await page.locator('[role="alert"]').waitFor();
    assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    await context.close();
  });

  await t.test('successful manual refresh bypasses a fresh entry and records the new validation time', async () => {
    const context = await browser.newContext();
    const state = {};
    await fixtures(context, state);
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/calendar.html`);
    await controlled(page);
    await page.locator('.calendar-item').waitFor();
    const timestamp = await page.evaluate(() => JSON.parse(localStorage.getItem('f1_current_schedule')).timestamp);
    assert.equal(state.apiRequests, 2);
    await page.locator('#clear-cache-btn').click();
    await page.waitForFunction(previous => JSON.parse(localStorage.getItem('f1_current_schedule')).timestamp > previous, timestamp);
    assert.equal(state.apiRequests, 4);
    assert.ok(!(await page.url()).includes('f1-refresh'));
    await context.close();
  });

  await t.test('CSP actively blocks an unauthorized image origin', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.evaluate(() => {
      const image = new Image();
      image.src = 'https://unauthorized.invalid/image.png';
      document.body.append(image);
    });
    await page.waitForFunction(() => validation.violations.length > 0);
    assert.deepEqual(await page.evaluate(() => validation.violations), [{ directive: 'img-src', uri: 'https://unauthorized.invalid/image.png' }]);
    await context.close();
  });

  await t.test('all external images and the placeholder can fail without repeated retries', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await fixtures(context, { imagesFail: true });
    await context.route('**/assets/images/placeholder-driver.svg', route => route.abort('failed'));
    await context.addInitScript(() => {
      window.imageFailures = new Map();
      document.addEventListener('error', event => {
        if (event.target instanceof HTMLImageElement) {
          imageFailures.set(event.target, (imageFailures.get(event.target) || 0) + 1);
        }
      }, true);
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.locator('.champion-card').first().waitFor();
    await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => imageFailures.size === document.images.length && [...imageFailures.values()].every(count => count === 2));
    assert.ok(await page.evaluate(() => [...document.images].every(image => image.src.endsWith('/assets/images/placeholder-driver.svg'))));
    assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    await context.close();
  });

  await t.test('storage denial keeps network content and refresh functional', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }));
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/calendar.html`);
    await controlled(page);
    await page.locator('.calendar-item').waitFor();
    await page.locator('#clear-cache-btn').click();
    await page.waitForURL('**/calendar.html');
    await page.locator('.calendar-item').waitFor();
    assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    await context.close();
  });

  await t.test('local root installation and nested server 404 resolve assets/home correctly', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    const page = await context.newPage();
    await page.goto(`${server.origin}/`);
    await controlled(page);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), `${server.origin}/`);
    await page.goto(`${server.origin}/missing/F1/nested`);
    assert.equal(await page.locator('link[rel="stylesheet"]').last().evaluate(link => link.sheet !== null), true);
    assert.deepEqual(await page.evaluate(() => window.validation), { violations: [], rejections: [] });
    await page.locator('a.button').click();
    await page.waitForURL(`${server.origin}/index.html`);
    await context.close();
  });

  await t.test('missing required asset rejects installation without activating an incomplete shell', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    server.state.missingAsset = '/assets/js/api.js';
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('./sw.js');
      const worker = registration.installing;
      if (worker) await new Promise(resolve => worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant' || worker.state === 'activated') resolve();
      }));
      return { active: !!registration.active, caches: await caches.keys() };
    });
    assert.equal(state.active, false);
    assert.deepEqual(state.caches, []);
    server.state.missingAsset = null;
    await context.close();
  });

  await t.test('actual broken v2 baseline fails on its four obsolete asset paths', async () => {
    const { execFileSync } = await import('node:child_process');
    server.state.workerSource = execFileSync('git', ['show', 'e302381:sw.js'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
    const context = await browser.newContext();
    await fixtures(context);
    const page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('./sw.js');
      const worker = registration.installing;
      if (worker) await new Promise(resolve => worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant' || worker.state === 'activated') resolve();
      }));
      return !!registration.active;
    });
    assert.equal(active, false);
    server.state.workerSource = null;
    await context.close();
  });

  await t.test('actual v13 worker from eaa7335 upgrades after old clients close and preserves unrelated caches', async () => {
    const context = await browser.newContext();
    await fixtures(context);
    server.state.release = 'previous';
    let page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await controlled(page);
    assert.ok((await page.evaluate(() => caches.keys())).includes('f1-portal-v13'));
    await page.evaluate(async () => {
      await (await caches.open('other-project-v1')).put('/other/data', new Response('keep'));
      localStorage.setItem('unrelated-preference', 'keep');
    });
    server.state.release = 'current';
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting);
    await page.close();
    page = await context.newPage();
    await page.goto(`${server.origin}/F1/champions.html`);
    await controlled(page);
    await page.waitForFunction(async () => !(await caches.keys()).includes('f1-portal-v13'));
    const names = await page.evaluate(() => caches.keys());
    assert.ok(names.includes('other-project-v1'));
    assert.ok(names.includes('f1-portal:/F1/:static-v5'));
    assert.equal(await page.evaluate(async () => (await (await caches.open('other-project-v1')).match('/other/data')).text()), 'keep');
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-preference')), 'keep');
    await context.setOffline(true);
    assert.equal((await page.goto(`${server.origin}/F1/teams.html`)).status(), 200);
    await context.close();
  });
});

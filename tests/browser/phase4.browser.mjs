import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { build } from '../../scripts/build.mjs';
import { startServer } from '../helpers/http-server.js';
import { chromium, launchOptions, observe, assertClean } from '../helpers/champion-browser.js';
import { fixtureRoutes, auditNow } from '../helpers/phase4-fixtures.js';
import { computedContrast } from '../helpers/contrast.js';

const pages = ['index.html', 'drivers.html', 'teams.html', 'champions.html', 'calendar.html', '404.html'];
test('Phase 4 production-only UX and accessibility', { timeout: 240000 }, async t => {
  await build({ silent: true });
  const server = await startServer({ rootDir: 'dist/' });
  const browser = await chromium.launch(launchOptions);
  const evidence = { browser: browser.version(), generatedAt: new Date().toISOString(), axe: [], scenarios: [] };
  const output = new URL('../../docs/phase-4/validation/', import.meta.url);
  await mkdir(output, { recursive: true });
  t.after(async () => {
    await writeFile(new URL('browser-results.json', output), JSON.stringify(evidence, null, 2) + '\n');
    await browser.close(); await server.close();
  });
  async function session(options = {}, data = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block', reducedMotion: 'reduce', ...options });
    await fixtureRoutes(context, data);
    await observe(context);
    const page = await context.newPage();
    await page.clock.install({ time: new Date(auditNow) });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    return { context, page, errors };
  }
  async function ready(page, file) {
    await page.goto(`${server.origin}/F1/${file}`);
    const path = file.split('?')[0];
    if (path !== '404.html') await page.locator(path === 'index.html' ? '#next-race-state .card' : path === 'drivers.html' ? '.driver-card' : path === 'teams.html' ? '.team-card' : path === 'champions.html' ? '.champion-card' : '.calendar-item').first().waitFor();
  }
  async function finish(s, name) {
    await assertClean(s.page, s.errors);
    evidence.scenarios.push(name);
    await s.context.close();
  }
  for (const width of [390, 1440]) for (const file of pages) {
    await t.test(`axe WCAG 2.2 AA: ${file} at ${width}px`, async () => {
      const s = await session({ viewport: { width, height: 900 } });
      await ready(s.page, file);
      if (file === 'drivers.html' || file === 'teams.html') await s.page.locator('.expand-btn').first().click();
      if (file === 'champions.html') await s.page.locator('summary').first().click();
      // axe's CSS preloader fetches remote font CSS via connect-src. Computed local
      // styles are sufficient here; do not weaken the application's CSP for tests.
      const results = await new AxeBuilder({ page: s.page }).options({ preload: false }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      evidence.axe.push({ file, width, violations: results.violations, incomplete: results.incomplete.map(r => ({ id: r.id, impact: r.impact, nodes: r.nodes.map(n => n.target) })), passedRules: results.passes.length });
      assert.deepEqual(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
      await finish(s, `axe ${file} ${width}`);
    });
  }
  await t.test('computed text and required control contrasts meet AA, including gradient/grid worst cases', async () => {
    const s = await session();
    evidence.contrast = [];
    for (const file of pages) {
      await ready(s.page, file);
      if (file === 'drivers.html' || file === 'teams.html') await s.page.locator('.expand-btn').first().click();
      if (file === 'champions.html') await s.page.locator('summary').first().click();
      const samples = await s.page.evaluate(computedContrast);
      evidence.contrast.push({ file, samples });
      assert.deepEqual(samples.filter(sample => sample.ratio < sample.minimum), []);
    }
    await finish(s, 'computed contrasts');
  });
  await t.test('five destinations navigate with correct current-page state on mobile and desktop', async () => {
    const s = await session();
    for (const width of [390, 1440]) {
      await s.page.setViewportSize({ width, height: 900 });
      for (const file of pages.slice(0, 5)) {
        await ready(s.page, file);
        const nav = s.page.locator(width === 390 ? '.bottom-nav' : '.sidebar nav');
        assert.equal(await nav.locator('[aria-current="page"]').count(), 1);
        assert.equal(await nav.locator('[aria-current="page"]').getAttribute('href'), file);
        for (const link of await nav.locator('a').all()) {
          const box = await link.boundingBox();
          assert.ok(box.height >= 44 && box.width >= 44);
        }
        const target = file === 'index.html' ? 'drivers.html' : 'index.html';
        await nav.locator(`a[href="${target}"]`).click();
        assert.ok(s.page.url().endsWith(target));
      }
    }
    await finish(s, 'navigation and touch targets');
  });
  for (const file of ['drivers.html', 'teams.html']) {
    await t.test(`${file}: keyboard disclosure keeps focus, controls hidden panel and closes other card`, async () => {
      const s = await session();
      await ready(s.page, file);
      const buttons = s.page.locator('.expand-btn');
      const first = buttons.first();
      await first.focus();
      await s.page.keyboard.press('Enter');
      assert.equal(await first.getAttribute('aria-expanded'), 'true');
      assert.equal(await first.evaluate(b => b === document.activeElement), true);
      const id = await first.getAttribute('aria-controls');
      assert.equal(await s.page.locator(`#${id}`).isVisible(), true);
      await s.page.keyboard.press('Space');
      assert.equal(await s.page.locator(`#${id}`).isVisible(), false);
      await s.page.keyboard.press('Enter');
      await buttons.nth(1).click();
      assert.equal(await first.getAttribute('aria-expanded'), 'false');
      assert.equal(await s.page.locator(`#${id}`).isVisible(), false);
      assert.equal(await buttons.nth(1).evaluate(b => b === document.activeElement), true);
      await finish(s, `keyboard ${file}`);
    });
  }
  await t.test('driver query and sorting preserve focus/state; legacy poles URL falls back honestly', async () => {
    const s = await session();
    await ready(s.page, 'drivers.html?sort=poles&keep=yes');
    assert.equal(await s.page.locator('#sort-select').inputValue(), 'standing');
    assert.equal(await s.page.locator('option[value=poles]').evaluate(e => e.disabled), true);
    await s.page.fill('#search-input', 'norris');
    assert.equal(await s.page.locator('.driver-card').count(), 1);
    assert.equal(await s.page.locator('#search-input').evaluate(e => e === document.activeElement), true);
    await s.page.selectOption('#sort-select', 'points');
    assert.equal(new URL(s.page.url()).searchParams.get('keep'), 'yes');
    await s.page.reload();
    assert.equal(await s.page.locator('#search-input').inputValue(), 'norris');
    await finish(s, 'driver URL state');
  });
  await t.test('champion search composes with title filter/sort and preserves all photo credits', async () => {
    const s = await session();
    await ready(s.page, 'champions.html');
    assert.equal(await s.page.locator('.champion-card').count(), 35);
    assert.equal(await s.page.locator('.photo-credit a').count(), 70);
    const summary = s.page.locator('summary').first();
    await summary.focus();
    await s.page.keyboard.press('Enter');
    assert.equal(await s.page.locator('.photo-credit').first().isVisible(), true);
    await s.page.keyboard.press('Space');
    assert.equal(await s.page.locator('.photo-credit').first().isVisible(), false);
    assert.equal(await summary.evaluate(e => e === document.activeElement), true);
    await s.page.fill('#search-input', 'senna');
    assert.equal(await s.page.locator('.champion-card').count(), 1);
    await s.page.selectOption('#titles-filter', '5plus');
    await s.page.locator('.state-card-empty').waitFor();
    assert.equal(await s.page.locator('#titles-filter').evaluate(e => e === document.activeElement), false); // selectOption itself does not move focus
    await s.page.selectOption('#titles-filter', 'all');
    await s.page.selectOption('#sort-select', 'firstYear');
    await s.page.reload();
    await s.page.locator('.champion-card').waitFor();
    assert.equal(await s.page.locator('.name').textContent(), 'Ayrton Senna');
    assert.equal(await s.page.locator('#search-input').inputValue(), 'senna');
    await finish(s, 'champion combined controls');
  });
  await t.test('empty search and unavailable API offer understandable feedback and recovery', async () => {
    const s = await session();
    await ready(s.page, 'drivers.html');
    await s.page.fill('#search-input', 'nãoexiste');
    assert.match(await s.page.locator('.state-card-empty').textContent(), /Nenhum piloto/);
    await s.page.fill('#search-input', '');
    assert.equal(await s.page.locator('.driver-card').count(), 6);
    await s.context.unroute('https://api.jolpi.ca/**');
    await s.context.route('https://api.jolpi.ca/**', r => r.abort('failed'));
    await s.page.evaluate(() => localStorage.clear());
    await s.page.reload();
    await s.page.locator('.state-card.error').waitFor();
    assert.match(await s.page.locator('#season-label').textContent(), /indisponível/);
    await s.context.unroute('https://api.jolpi.ca/**');
    await fixtureRoutes(s.context);
    await s.page.getByRole('button', { name: 'Tentar novamente' }).click();
    await s.page.locator('.driver-card').first().waitFor();
    assert.equal(await s.page.locator('#drivers-state').evaluate(e => e === document.activeElement), true);
    await finish(s, 'empty and retry');
  });
  await t.test('calendar distinguishes published, upcoming and unknown; next link moves keyboard focus', async () => {
    const s = await session();
    await ready(s.page, 'calendar.html');
    assert.deepEqual(await s.page.locator('.calendar-item').evaluateAll(cards => cards.map(c => c.dataset.status)), ['completed', 'upcoming', 'scheduled']);
    assert.match(await s.page.locator('.race-date').last().textContent(), /Horário não informado/i);
    await s.page.getByRole('link', { name: 'Ir à próxima corrida programada' }).click();
    assert.equal(await s.page.locator('.calendar-item.next').evaluate(e => e === document.activeElement), true);
    assert.match(await s.page.locator('.race-date').nth(1).textContent(), /14:00/);
    await s.page.clock.fastForward(6 * 86400000 + 5 * 3600000 + 1000);
    assert.equal(await s.page.locator('#race-2026-21').getAttribute('data-status'), 'result_pending');
    assert.equal(await s.page.locator('#race-2026-21').evaluate(e => e === document.activeElement), true);
    await finish(s, 'calendar and local time');
  });
  await t.test('reflow and keyboard focus are visible above bottom navigation at narrow, enlarged and landscape layouts', async () => {
    const s = await session();
    for (const viewport of [{ width: 320, height: 900 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 844, height: 390 }]) {
      await s.page.setViewportSize(viewport);
      for (const file of pages) {
        await ready(s.page, file);
        if (viewport.width === 320) await s.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const geometry = await s.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
          offenders: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })) }));
        assert.equal(geometry.overflow, false, `${file} ${viewport.width}: ${JSON.stringify(geometry.offenders)}`);
      }
    }
    await s.page.setViewportSize({ width: 390, height: 844 });
    await ready(s.page, 'drivers.html');
    await s.page.keyboard.press('Tab');
    assert.equal(await s.page.locator('.skip-link').evaluate(e => e === document.activeElement), true);
    await s.page.keyboard.press('Enter');
    assert.equal(await s.page.locator('main').evaluate(e => e === document.activeElement), true);
    for (let i = 0; i < 18; i++) {
      await s.page.keyboard.press('Tab');
      const state = await s.page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active.closest('.bottom-nav') || active === document.body) return { skip: true };
        const box = active.getBoundingClientRect();
        const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
        return { bottom: box.bottom, navTop: nav.top, outline: getComputedStyle(active).outlineStyle };
      });
      if (!state.skip) { assert.ok(state.bottom <= state.navTop, JSON.stringify(state)); assert.notEqual(state.outline, 'none'); }
    }
    assert.equal(await s.page.locator('.driver-card').first().evaluate(e => getComputedStyle(e).animationName), 'none');
    await finish(s, 'reflow, skip link, focus visibility, reduced motion');
  });
  await t.test('stress: long names, circuit titles, large points and missing images reflow without clipped controls', async () => {
    const s = await session({ viewport: { width: 320, height: 900 } });
    await ready(s.page, 'drivers.html');
    await s.page.locator('.name').first().evaluate(e => { e.textContent = 'Nome composto extremamente longo para validar a apresentação do piloto'; });
    await s.page.locator('.kpis .badge').nth(1).evaluate(e => { e.textContent = 'PTS 123456789.5'; });
    await s.context.route('https://media.formula1.com/broken.png', r => r.abort('failed'));
    await s.page.locator('.portrait').first().evaluate(e => { e.src = 'https://media.formula1.com/broken.png'; });
    await s.page.waitForFunction(() => document.querySelector('.portrait').src.endsWith('/placeholder-driver.svg') && document.querySelector('.portrait').complete);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await ready(s.page, 'calendar.html');
    await s.page.locator('.card-title').first().evaluate(e => { e.textContent = 'Grande Prêmio de nome muito longo em circuito internacional com múltiplas palavras'; });
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await finish(s, 'stress names and numbers');
  });
  await t.test('static HTML remains meaningful without JavaScript and branded assets resolve from dist', async () => {
    const s = await session({ javaScriptEnabled: false });
    for (const file of pages.slice(0, 5)) {
      await s.page.goto(`${server.origin}/F1/${file}`);
      assert.ok((await s.page.locator('h1').textContent()).length > 3);
      assert.equal(await s.page.locator('noscript p').isVisible(), true);
    }
    for (const file of ['manifest.json', 'sitemap.xml', 'robots.txt', 'assets/images/icon-192.png', 'assets/images/icon-512.png', 'assets/images/social-preview.png']) assert.equal((await s.context.request.get(`${server.origin}/F1/${file}`)).status(), 200);
    await s.context.close();
    evidence.scenarios.push('no JavaScript and dist assets');
  });
  await t.test('released v5 upgrades atomically to v6 with offline icons, preserving old clients and unrelated caches', async () => {
    server.state.release = 'phase3';
    const s = await session({ serviceWorkers: 'allow' });
    let page = s.page;
    try {
      await page.goto(`${server.origin}/F1/champions.html`);
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      await page.reload();
      await page.waitForFunction(async () => (await caches.keys()).includes('f1-portal:/F1/:static-v5'));
      await page.evaluate(async () => {
        await (await caches.open('f1-portal:/other/:static-v5')).put('/other/preference', new Response('keep'));
        localStorage.setItem('other-preference', 'keep');
      });
      server.state.release = 'current';
      server.state.missingAsset = 'icon-512.png';
      const failed = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration.update();
        const worker = registration.installing;
        if (worker) await new Promise(resolve => worker.addEventListener('statechange', () => {
          if (['redundant', 'installed'].includes(worker.state)) resolve();
        }));
        return { active: registration.active?.state, waiting: !!registration.waiting, keys: await caches.keys() };
      });
      assert.equal(failed.active, 'activated');
      assert.equal(failed.waiting, false);
      assert.ok(failed.keys.includes('f1-portal:/F1/:static-v5'));
      assert.ok(!failed.keys.includes('f1-portal:/F1/:static-v6'));
      server.state.missingAsset = null;
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
      assert.ok((await page.evaluate(() => caches.keys())).includes('f1-portal:/F1/:static-v5'));
      let nextWorker;
      for (const candidate of s.context.serviceWorkers()) if (await candidate.evaluate(() => CACHE_VERSION) === 'v6') nextWorker = candidate;
      assert.ok(nextWorker);
      await page.close();
      await nextWorker.evaluate(async () => {
        const deadline = Date.now() + 30000;
        while ((await caches.keys()).includes('f1-portal:/F1/:static-v5') || self.registration.waiting || self.registration.active?.state !== 'activated') {
          if (Date.now() > deadline) throw new Error('v6 activation timeout');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });
      page = await s.context.newPage();
      await page.goto(`${server.origin}/F1/champions.html`);
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      const keys = await page.evaluate(() => caches.keys());
      assert.ok(!keys.includes('f1-portal:/F1/:static-v5'));
      assert.ok(keys.includes('f1-portal:/other/:static-v5'));
      assert.equal(await page.evaluate(() => localStorage.getItem('other-preference')), 'keep');
      await s.context.setOffline(true);
      for (const file of [...pages, 'assets/images/icon-192.png', 'assets/images/icon-512.png']) {
        const response = await page.goto(`${server.origin}/F1/${file}`);
        assert.equal(response.status(), 200);
      }
      evidence.scenarios.push('real v5 upgrade, atomic failure, offline icons, cache isolation');
    } finally {
      server.state.release = 'current'; server.state.missingAsset = null;
      await s.context.close();
    }
  });
});

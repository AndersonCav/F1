import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../helpers/http-server.js';
import { chromium, launchOptions, observe, assertClean } from '../helpers/champion-browser.js';
import { driver, constructor, standing, race, result, standingsResponse, racesResponse } from '../helpers/sporting-fixtures.js';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>';
const start = Date.parse('2026-03-08T04:00:00Z');
const roster = () => [
  { ...standing('a', '2', '0', '0', [constructor('zeta', 'Zeta')]), Driver: driver('a', 'Álvaro', 'Ávila') },
  { ...standing('b', '1', '10', '1', [constructor('alpha', 'Alpha')]), Driver: driver('b', 'Bruno', 'Bahia') },
  { ...standing('c', '3', null, null, [constructor('alpha', 'Alpha')]), Driver: driver('c', 'Caio', 'Costa') }
];
function dataFor(url, state) {
  const requested = Number(url.pathname.match(/\/f1\/(\d{4})\//)?.[1]) || state.season || 2026;
  if (requested !== (state.season || 2026)) {
    state.nextRequests = (state.nextRequests || 0) + 1;
    if (state.nextFails) return null;
    return racesResponse(state.next || [], String(requested));
  }
  if (/constructorStandings/.test(url.pathname)) return standingsResponse(state.teams || [{ Constructor: constructor(), position: '1', points: '123', wins: '2' }], String(requested), 'ConstructorStandings');
  if (/driverStandings/.test(url.pathname)) {
    const data = standingsResponse(state.drivers || roster(), String(requested));
    if (state.badStandings) data.MRData.total = '99';
    return data;
  }
  if (/drivers.json/.test(url.pathname)) return { MRData: { total: String((state.drivers || roster()).length), offset: '0',
    DriverTable: { season: String(requested), Drivers: (state.drivers || roster()).map(s => s.Driver) } } };
  if (/results\/1\.json/.test(url.pathname)) return racesResponse(state.winners || [], String(requested), true);
  if (/results.json/.test(url.pathname)) return racesResponse(state.results || [], String(requested), true);
  return racesResponse(state.races || [race()], String(requested));
}

test('Phase 2 deterministic Chrome sporting-data scenarios', { timeout: 180000 }, async t => {
  const server = await startServer();
  const browser = await chromium.launch(launchOptions);
  const evidence = { browser: browser.version(), generatedAt: new Date().toISOString(), scenarios: [] };
  t.after(async () => {
    await mkdir(new URL('../../docs/phase-2/browser/', import.meta.url), { recursive: true });
    await writeFile(new URL('../../docs/phase-2/browser/phase2-results.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
    await browser.close(); await server.close();
  });
  async function setup(state = {}, now = start - 3600000, timezoneId = 'America/Sao_Paulo', allowWorkers = false) {
    const context = await browser.newContext({ timezoneId, serviceWorkers: allowWorkers ? 'allow' : 'block' });
    await observe(context);
    await context.route('https://api.jolpi.ca/**', route => {
      const url = new URL(route.request().url());
      if (state.apiFails || (state.profilesFail && /drivers.json/.test(url.pathname))) return route.abort('failed');
      const data = dataFor(url, state);
      return data === null ? route.abort('failed') : route.fulfill({ json: data });
    });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await context.route(/^https:\/\/(media\.formula1\.com|flagsapi\.com|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//,
      route => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
    const page = await context.newPage();
    await page.clock.install({ time: new Date(now) });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    return { page, context, errors };
  }
  async function finish(label, session) {
    await assertClean(session.page, session.errors);
    evidence.scenarios.push({ name: label, passed: true, exceptions: session.errors, cspViolations: await session.page.evaluate(() => imageAudit.violations) });
    await session.context.close();
  }
  const names = page => page.locator('.driver-card .name').allTextContents();

  await t.test('all driver sorting options, accent search, query state and expanded details compose', async () => {
    const s = await setup(); const { page } = s;
    await page.goto(`${server.origin}/F1/drivers.html?sort=team&keep=yes`);
    await page.locator('.driver-card').first().waitFor();
    assert.deepEqual(await names(page), ['Bruno Bahia', 'Caio Costa', 'Álvaro Ávila']);
    for (const mode of ['standing', 'name', 'team', 'points', 'wins']) {
      await page.selectOption('#sort-select', mode);
      assert.equal(new URL(page.url()).searchParams.get('sort'), mode);
      assert.equal(new URL(page.url()).searchParams.get('keep'), 'yes');
      const current = await names(page); assert.equal(current.length, 3);
      if (mode === 'name') assert.equal(current[0], 'Álvaro Ávila');
      if (['standing', 'points', 'wins'].includes(mode)) assert.equal(current[0], 'Bruno Bahia');
    }
    assert.equal(await page.locator('option[value="poles"]').evaluate(e => e.disabled), true);
    await page.locator('.driver-card').filter({ hasText: 'Álvaro Ávila' }).locator('.expand-btn').click();
    await page.fill('#search-input', ' alvaro avila ');
    assert.deepEqual(await names(page), ['Álvaro Ávila']);
    assert.equal(await page.locator('.expand-btn').getAttribute('aria-expanded'), 'true');
    assert.equal(new URL(page.url()).searchParams.get('q'), ' alvaro avila ');
    await page.reload(); await page.locator('.driver-card').waitFor();
    assert.deepEqual(await names(page), ['Álvaro Ávila']);
    await finish('driver controls', s);
  });
  await t.test('profile endpoint failure preserves valid standings, honest poles and permanent-number fallback', async () => {
    const s = await setup({ profilesFail: true });
    await s.page.goto(`${server.origin}/F1/drivers.html`);
    await s.page.locator('.driver-card').first().waitFor();
    assert.equal(await s.page.locator('.driver-card').count(), 3);
    assert.match(await s.page.locator('.kpis').first().textContent(), /POLES GP Não disponível/);
    await finish('optional profiles unavailable', s);
  });
  await t.test('replacement drivers and multi-constructor history are season participants with API points', async () => {
    const entries = [standing(), standing('reserve', '3'), standing('changed', '4', '1', '0', [constructor(), constructor('ferrari', 'Ferrari')])];
    const s = await setup({ drivers: entries });
    await s.page.goto(`${server.origin}/F1/teams.html`);
    await s.page.locator('.team-card').waitFor();
    assert.match(await s.page.locator('.team-card .meta').textContent(), /PILOTOS NA TEMPORADA/);
    assert.equal((await s.page.locator('.team-card .meta').textContent()).split(' / ').length, 3);
    assert.match(await s.page.locator('.kpis').textContent(), /123 PTS/);
    await s.page.locator('.expand-btn').click();
    assert.match(await s.page.locator('.details').textContent(), /Vitórias de GP até 2025203/);
    assert.match(await s.page.locator('.details').textContent(), /Títulos de construtores até 202510/);
    await finish('constructor association and precedence', s);
  });
  for (const timezone of ['America/Sao_Paulo', 'Pacific/Honolulu', 'Asia/Tokyo']) {
    await t.test(`calendar before start, at start and after published results in ${timezone}`, async () => {
      const state = {}; const s = await setup(state, start - 1000, timezone);
      await s.page.goto(`${server.origin}/F1/calendar.html`);
      await s.page.locator('.calendar-item').waitFor();
      assert.equal(await s.page.locator('.calendar-item').getAttribute('data-status'), 'upcoming');
      await s.page.clock.runFor(1100);
      assert.equal(await s.page.locator('.calendar-item').getAttribute('data-status'), 'result_pending');
      await s.page.goto(`${server.origin}/F1/calendar.html?f1-refresh=1`);
      await s.page.locator('.calendar-item').waitFor();
      assert.equal(await s.page.locator('.calendar-item').getAttribute('data-status'), 'result_pending');
      state.winners = [result()];
      await s.page.goto(`${server.origin}/F1/calendar.html?f1-refresh=1`);
      await s.page.locator('[data-status="completed"]').waitFor();
      assert.match(await s.page.locator('#calendar-state').textContent(), /2027.*não disponível/);
      await finish(`calendar ${timezone}`, s);
    });
  }
  await t.test('countdown stops at the scheduled instant without claiming live race status', async () => {
    const s = await setup({}, start - 1000);
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('.countdown-hud .timer').waitFor();
    await s.page.clock.runFor(2100);
    assert.match(await s.page.locator('.countdown-hud .timer').textContent(), /aguardando resultado/);
    const before = await s.page.locator('.countdown-hud .timer').textContent();
    await s.page.clock.runFor(86400000);
    assert.equal(await s.page.locator('.countdown-hud .timer').textContent(), before);
    assert.doesNotMatch(await s.page.locator('#next-race-state').textContent(), /AO VIVO|LIVE/);
    assert.doesNotMatch(await s.page.locator('.countdown-hud').evaluate(e => getComputedStyle(e, '::before').content), /LIVE|TELEMETRY/);
    await finish('countdown crossing', s);
  });
  await t.test('date-only next event uses truthful fallback rather than a fabricated noon', async () => {
    const s = await setup({ races: [race('1', { time: undefined })] }, start - 86400000);
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('.countdown-hud').waitFor();
    assert.match(await s.page.locator('.timer').textContent(), /Horário de largada não informado/);
    assert.doesNotMatch(await s.page.locator('.timer').textContent(), /\d+d/);
    await finish('unknown start', s);
  });
  await t.test('final scheduled start without results stays pending and does not request a new season', async () => {
    const state = {}; const s = await setup(state, start + 1000);
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('#next-race-state .state-card').waitFor();
    assert.match(await s.page.locator('#next-race-state').textContent(), /aguardando resultados/);
    assert.equal(state.nextRequests || 0, 0);
    await finish('pending final race', s);
  });
  await t.test('dashboard podium follows actual published finishing positions in unordered responses', async () => {
    const published = result('1', { Results: [3, 1, 2].map(position => ({ position: String(position),
      Driver: driver(`p${position}`, `Driver${position}`, 'Test'), Time: { time: position === 1 ? '1:30:00' : `+${position}.000` } })) });
    const s = await setup({ winners: [result()], results: [published] }, start + 3600000);
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('.podium-card').first().waitFor();
    assert.deepEqual(await s.page.locator('.podium-rank').allTextContents(), ['1º', '2º', '3º']);
    assert.deepEqual(await s.page.locator('.podium-time').allTextContents(), ['1:30:00', '+2.000', '+3.000']);
    await finish('published podium positions', s);
  });
  for (const nextFails of [false, true]) {
    await t.test(`confirmed final race and ${nextFails ? 'unavailable' : 'unpublished'} next season show an offseason state`, async () => {
      const state = { winners: [result()], results: [result()], nextFails };
      const s = await setup(state, start + 3600000);
      await s.page.goto(`${server.origin}/F1/`);
      await s.page.locator('#next-race-state .state-card').waitFor();
      assert.match(await s.page.locator('#next-race-state').textContent(), /2026 encerrada.*2027/);
      assert.equal(await s.page.locator('#next-race-state [role="alert"]').count(), 0);
      assert.equal(state.nextRequests, 1);
      await finish(`offseason ${nextFails}`, s);
    });
  }
  await t.test('published upcoming season keeps its year and neutral event name after calendar-year rollover', async () => {
    const state = { winners: [result()], next: [race('1', { season: '2027', date: '2027-03-08', raceName: 'British Grand Prix' })] };
    const s = await setup(state, Date.parse('2027-01-01T00:00:00Z'));
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('.countdown-hud').waitFor();
    assert.match(await s.page.locator('#next-race-state').textContent(), /British Grand Prix.*2027/);
    assert.doesNotMatch(await s.page.locator('#next-race-state').textContent(), /2026|PIRELLI/);
    assert.equal(await s.page.locator('.circuit-map').count(), 0);
    await finish('published rollover', s);
  });
  await t.test('valid empty upcoming season shows unpublished states without request-failure alerts', async () => {
    const s = await setup({ season: 2027, races: [], drivers: [], teams: [] }, Date.parse('2027-01-01T00:00:00Z'));
    await s.page.goto(`${server.origin}/F1/`);
    await s.page.locator('#quick-standings-state .state-card').waitFor();
    assert.match(await s.page.locator('#next-race-state').textContent(), /2027 ainda não publicado/);
    assert.match(await s.page.locator('#quick-standings-state').textContent(), /Classificação ainda não publicada/);
    assert.equal(await s.page.locator('[role="alert"]').count(), 0);
    await finish('empty upcoming season', s);
  });
  await t.test('incomplete API refresh keeps previously verified standings and the original timestamp', async () => {
    const state = {}; const s = await setup(state);
    await s.page.goto(`${server.origin}/F1/drivers.html`);
    await s.page.locator('.driver-card').first().waitFor();
    const before = await s.page.evaluate(() => localStorage.getItem('f1_current_driver_standings'));
    state.badStandings = true;
    await s.page.goto(`${server.origin}/F1/drivers.html?f1-refresh=1`);
    await s.page.locator('.driver-card').first().waitFor();
    assert.match(await s.page.locator('#cache-info').textContent(), /DADOS SALVOS/);
    assert.equal(await s.page.evaluate(() => localStorage.getItem('f1_current_driver_standings')), before);
    assert.equal(await s.page.locator('.driver-card').count(), 3);
    await finish('non-destructive malformed refresh', s);
  });
  await t.test('all primary pages retain mobile navigation and fit 320px and 390px widths', async () => {
    const s = await setup();
    for (const width of [320, 390]) {
      await s.page.setViewportSize({ width, height: 844 });
      for (const [path, selector] of [['index.html', '.standings-table'], ['drivers.html', '.driver-card'], ['teams.html', '.team-card'],
        ['champions.html', '.champion-card'], ['calendar.html', '.calendar-item'], ['404.html', '.error-card']]) {
        await s.page.goto(`${server.origin}/F1/${path}`);
        await s.page.locator(selector).first().waitFor();
        if (path === '404.html') assert.ok(await s.page.locator('a.button').isVisible());
        else assert.ok(await s.page.locator('.bottom-nav').isVisible());
        if (!(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) {
          t.diagnostic(JSON.stringify(await s.page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12)
            .map(e => ({ tag: e.tagName, className: e.className, text: e.textContent.slice(0, 80), width: e.getBoundingClientRect().width, right: e.getBoundingClientRect().right, columns: getComputedStyle(e).gridTemplateColumns })))));
        }
        assert.ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows ${width}px`);
      }
    }
    await finish('mobile all pages', s);
  });
  await t.test('actual Phase 1.1 v4 shell upgrades to v6 after all old clients close', async () => {
    server.state.release = 'phase1_1';
    const s = await setup({}, start - 3600000, 'America/Sao_Paulo', true);
    await s.page.goto(`${server.origin}/F1/champions.html`);
    await s.page.waitForFunction(() => navigator.serviceWorker.controller);
    await s.page.reload();
    await s.page.locator('.champion-card').first().waitFor();
    assert.equal(await s.page.locator('.champion-card').count(), 33);
    server.state.release = 'current';
    await s.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await s.page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting);
    assert.equal(await s.page.locator('.champion-card').count(), 33);
    let worker;
    for (const candidate of s.context.serviceWorkers()) if (await candidate.evaluate(() => CACHE_VERSION) === 'v6') worker = candidate;
    assert.ok(worker);
    await assertClean(s.page, s.errors);
    await s.page.close();
    await worker.evaluate(async () => {
      const deadline = Date.now() + 30000;
      while ((await caches.keys()).includes('f1-portal:/F1/:static-v4') || self.registration.active?.state !== 'activated' || self.registration.waiting) {
        if (Date.now() > deadline) throw new Error('v6 activation timeout');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
    s.page = await s.context.newPage();
    await s.page.goto(`${server.origin}/F1/champions.html`);
    await s.page.locator('.champion-card').first().waitFor();
    assert.equal(await s.page.locator('.champion-card').count(), 35);
    const cacheNames = await s.page.evaluate(() => caches.keys());
    assert.ok(cacheNames.includes('f1-portal:/F1/:static-v6'));
    assert.ok(!cacheNames.includes('f1-portal:/F1/:static-v4'));
    await finish('v4 to v6 upgrade', s);
  });
});

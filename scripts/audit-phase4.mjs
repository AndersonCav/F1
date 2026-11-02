import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tests/helpers/http-server.js';
import { chromium, launchOptions } from '../tests/helpers/champion-browser.js';
import { fixtureRoutes, auditNow } from '../tests/helpers/phase4-fixtures.js';
import { build } from './build.mjs';
import { checkBudget } from './check-budget.mjs';

const label = process.argv[2] || 'after';
const production = process.argv.includes('--production');
const liveLocal = process.argv.includes('--live-local');
const output = new URL(`../docs/phase-4/${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
const artifact = await build({ silent: true });
const budget = await checkBudget({ silent: true });
const server = await startServer({ rootDir: 'dist/' });
const browser = await chromium.launch(launchOptions);
const evidence = { generatedAt: new Date().toISOString(), browser: browser.version(), artifactBytes: artifact.totalBytes, budget, conditions: 'Chrome headless; America/Sao_Paulo; cold contexts; controlled API and image fallbacks + empty remote font CSS locally; real external providers in production; no field INP; no Lighthouse score', pages: [], performance: [] };
evidence.visualSource = liveLocal ? 'Real providers against isolated dist; no mocks or fixed time for screenshots. Laboratory metrics below remain controlled.' : 'Controlled local fixtures; remote production screenshots, when requested, use real providers.';
try {
  for (const remote of production ? [false, true] : [false]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block', reducedMotion: 'reduce' });
      if (!remote && !liveLocal) await fixtureRoutes(context);
      const page = await context.newPage();
      if (!remote && !liveLocal) await page.clock.install({ time: new Date(auditNow) });
      for (const file of ['index.html', 'drivers.html', 'teams.html', 'champions.html', 'calendar.html', '404.html']) {
        const url = `${remote ? 'https://andersoncav.github.io' : server.origin}/F1/${file}`;
        const errors = [];
        const handler = e => errors.push(e.message);
        page.on('pageerror', handler);
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 25000 });
          await page.waitForTimeout(remote || liveLocal ? 1800 : 500);
          const name = `${remote ? 'production' : 'local'}-${file.replace('.html', '')}-${width}`;
          await page.screenshot({ path: new URL(`${name}.png`, output).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true });
          await page.screenshot({ path: fileURLToPath(new URL(`${name}-viewport.png`, output)) });
          if (file === 'champions.html') {
            for (const [position, index] of [['middle', 17], ['last', 34]]) {
              await page.locator('.champion-card').nth(index).scrollIntoViewIfNeeded();
              await page.waitForTimeout(150);
              await page.screenshot({ path: fileURLToPath(new URL(`${name}-${position}.png`, output)) });
            }
          }
          evidence.pages.push({ name, url, width, errors, ...await page.evaluate(() => ({ title: document.title, overflow: document.documentElement.scrollWidth > innerWidth, text: document.querySelector('main')?.innerText.slice(0, 2400), fonts: performance.getEntriesByType('resource').filter(r => /fonts\.google/.test(r.name)).map(r => r.name) })) });
          console.log(`[audit] ${name}`);
        } catch (error) { evidence.pages.push({ url, width, error: error.message }); }
        page.off('pageerror', handler);
      }
      await context.close();
    }
  }
  // Equivalent Chrome laboratory diagnostics: explicit 5s observation window, not field CWV.
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
    await fixtureRoutes(context);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.lab = { lcp: 0, cls: 0, blockingTime: 0 };
      for (const [type, onEntry] of [
        ['largest-contentful-paint', e => { lab.lcp = e.startTime; }],
        ['layout-shift', e => { if (!e.hadRecentInput) lab.cls += e.value; }],
        ['longtask', e => { lab.blockingTime += Math.max(0, e.duration - 50); }]
      ]) new PerformanceObserver(list => list.getEntries().forEach(onEntry)).observe({ type, buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`${server.origin}/F1/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    evidence.performance.push({ run, ...await page.evaluate(() => ({ ...lab, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, requests: performance.getEntriesByType('resource').length, resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, bytes: r.transferSize, type: r.initiatorType })) })) });
    await context.close();
  }
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(evidence, null, 2) + '\n');
  await browser.close(); await server.close();
}
console.log(JSON.stringify({ pages: evidence.pages.length, performance: evidence.performance.map(({ resources, ...metrics }) => metrics), bytes: artifact.totalBytes }));

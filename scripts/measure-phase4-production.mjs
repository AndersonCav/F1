import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium, launchOptions } from '../tests/helpers/champion-browser.js';

const output = new URL('../docs/phase-4/validation/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch(launchOptions);
const report = { browser: browser.version(), generatedAt: new Date().toISOString(), conditions: 'Production GET only; Chrome CDP 390x844; 150ms RTT, 200000B/s down, 93750B/s up, CPU 4x; 5s post-load observation; cold context; workers blocked; real providers; no field INP or Lighthouse score', runs: [] };
try {
  const html = await (await fetch('https://andersoncav.github.io/F1/')).text();
  const old = execFileSync('git', ['show', 'f2b3bb18ff50d648091f1a92b17df198172c2823:index.html'], { encoding: 'utf8' });
  const hash = value => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex');
  report.productionMatchesInitialHtml = hash(html) === hash(old);
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' });
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
    const responses = new Map();
    cdp.on('Network.responseReceived', e => responses.set(e.requestId, { url: e.response.url, type: e.type, mime: e.response.mimeType, status: e.response.status, bytes: 0 }));
    cdp.on('Network.loadingFinished', e => { if (responses.has(e.requestId)) responses.get(e.requestId).bytes = e.encodedDataLength; });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try {
      await page.goto('https://andersoncav.github.io/F1/', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(5000);
      report.runs.push({ run, ...await page.evaluate(() => ({ ...lab, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, content: document.querySelector('main').innerText.slice(0, 1600) })), resources: [...responses.values()] });
      console.log(`[production laboratory] run ${run}`);
    } catch (error) { report.runs.push({ run, error: error.message, resources: [...responses.values()] }); }
    await context.close();
  }
} finally {
  await writeFile(new URL('production-performance.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}

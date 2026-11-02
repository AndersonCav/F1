import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './helpers/http-server.js';
import { build } from '../scripts/build.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';
import { chromium, launchOptions } from './helpers/champion-browser.js';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distDir = resolve(rootDir, 'dist');

test('Production artifact dist/ integrity and isolated serving', async t => {
  // Ensure fresh build before running tests
  await build({ rootDir, distDir, silent: true });

  await t.test('verifyDist() passes on fresh build', async () => {
    const result = await verifyDist({ distDir, silent: true });
    assert.equal(result.verified, true);
    assert.equal(result.fileCount, 32);
  });

  await t.test('dist/ contains exactly 32 files and zero development artifacts', async () => {
    async function getFiles(dir) {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = [];
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) files.push(...await getFiles(full));
        else files.push(full.slice(distDir.length + 1).replace(/\\/g, '/'));
      }
      return files;
    }
    const files = await getFiles(distDir);
    assert.equal(files.length, 32);

    // Assert absence of development files
    const forbidden = ['package.json', 'package-lock.json', '.gitignore', 'README.md', 'sw.js.map'];
    for (const f of forbidden) {
      assert.ok(!files.includes(f), `dist must not contain ${f}`);
    }
    for (const f of files) {
      assert.ok(!f.includes('tests/'), `dist must not contain test file: ${f}`);
      assert.ok(!f.includes('docs/'), `dist must not contain docs: ${f}`);
      assert.ok(!f.includes('scripts/'), `dist must not contain scripts: ${f}`);
      assert.ok(!f.endsWith('.mjs'), `dist must not contain .mjs: ${f}`);
      assert.ok(!f.endsWith('.test.js'), `dist must not contain .test.js: ${f}`);
    }
  });

  await t.test('HTTP server serving ONLY dist/ returns 200 for all production entrypoints and shell assets', async () => {
    const server = await startServer({ rootDir: 'dist/' });
    try {
      const swRaw = await readFile(join(distDir, 'sw.js'), 'utf8');
      const assetsMatch = swRaw.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
      assert.ok(assetsMatch, 'ASSETS_TO_CACHE found');
      const precachePaths = [...assetsMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(m => m[1]);
      assert.equal(precachePaths.length, 27);

      // Verify every precache resource over HTTP from isolated dist server
      for (const rel of precachePaths) {
        const url = `${server.origin}/F1/${rel.slice(2)}`;
        const res = await fetch(url);
        assert.equal(res.status, 200, `Failed to fetch ${url} (status: ${res.status})`);
        assert.ok(res.headers.get('content-type'), `Missing content-type for ${url}`);
      }

      // Verify root /F1/ resolves to index.html
      const rootRes = await fetch(`${server.origin}/F1/`);
      assert.equal(rootRes.status, 200);
      assert.match(await rootRes.text(), /<title>Portal Formula 1 \| Início<\/title>/);

      // Verify sw.js itself resolves over HTTP
      const swRes = await fetch(`${server.origin}/F1/sw.js`);
      assert.equal(swRes.status, 200);
      assert.equal(swRes.headers.get('content-type').split(';')[0], 'text/javascript');

      // Verify .nojekyll resolves over HTTP
      const nojekyllRes = await fetch(`${server.origin}/F1/.nojekyll`);
      assert.equal(nojekyllRes.status, 200);

      // Verify unknown nested route returns 404 with 404.html content
      const missingRes = await fetch(`${server.origin}/F1/nested/unknown/route`);
      assert.equal(missingRes.status, 404);
      assert.match(await missingRes.text(), /Página não encontrada/);

      // Security check: path traversal attempting to escape dist/ fails
      const escape1 = await fetch(`${server.origin}/F1/../package.json`);
      assert.ok([403, 404].includes(escape1.status), `Traversal must be blocked: ${escape1.status}`);

      const escape2 = await fetch(`${server.origin}/package.json`);
      assert.ok([403, 404].includes(escape2.status), `Access outside mount must be blocked: ${escape2.status}`);
    } finally {
      await server.close();
    }
  });

  await t.test('Controlled Chromium browser against isolated dist/ server installs SW and navigates cleanly', async () => {
    const server = await startServer({ rootDir: 'dist/' });
    const browser = await chromium.launch(launchOptions);
    try {
      const context = await browser.newContext();
      // Block third-party APIs to test pure offline shell without external reliance
      await context.route('https://api.jolpi.ca/**', route => route.fulfill({ json: { MRData: {} } }));
      await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
      await context.route(/^https:\/\/(media\.formula1\.com|flagsapi\.com|upload\.wikimedia\.org|thumb\.wikimedia\.org)\//,
        route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));

      const page = await context.newPage();
      const violations = [];
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));
      await page.addInitScript(() => {
        window.auditViolations = [];
        document.addEventListener('securitypolicyviolation', e => {
          window.auditViolations.push({ directive: e.effectiveDirective, blockedURI: e.blockedURI });
        });
      });

      // 1. Visit /F1/ on isolated dist server
      await page.goto(`${server.origin}/F1/`);
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      await page.evaluate(() => navigator.serviceWorker.ready);

      // 2. Verify all 27 shell resources are precached in CacheStorage
      const cachedUrls = await page.evaluate(async () => {
        const keys = await caches.keys();
        const staticKey = keys.find(k => k.includes('static-v6'));
        if (!staticKey) return null;
        const cache = await caches.open(staticKey);
        const reqs = await cache.keys();
        return reqs.map(r => new URL(r.url).pathname);
      });
      assert.ok(cachedUrls, 'static-v6 cache must exist in CacheStorage');
      assert.equal(cachedUrls.length, 27, `Expected 27 cached resources, got ${cachedUrls.length}`);

      // 3. Navigate between pages in dist
      for (const pageName of ['drivers.html', 'teams.html', 'champions.html', 'calendar.html', 'index.html']) {
        await page.goto(`${server.origin}/F1/${pageName}`);
        await page.waitForSelector('aside.sidebar nav');
        assert.equal(pageErrors.length, 0, `Page errors on ${pageName}: ${pageErrors.join(', ')}`);
      }

      // 4. Verify CSP violations remain empty
      const recordedViolations = await page.evaluate(() => window.auditViolations);
      assert.deepEqual(recordedViolations, [], 'Zero CSP violations expected on dist');
      assert.deepEqual(pageErrors, [], 'Zero page errors expected on dist');
    } finally {
      await browser.close();
      await server.close();
    }
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { access, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorker } from './helpers/sw-harness.js';
import { setImageFallback, PLACEHOLDER_DRIVER_IMAGE } from '../assets/js/static-data.js';

const root = new URL('../', import.meta.url);
const pages = (await readdir(root)).filter(name => name.endsWith('.html'));

test('every precache entry resolves to a real repository asset, without duplicates or external URLs', async () => {
  const worker = createWorker();
  assert.equal(new Set(worker.ASSETS_TO_CACHE).size, worker.ASSETS_TO_CACHE.length);
  for (const path of worker.ASSETS_TO_CACHE) {
    assert.ok(path.startsWith('./'));
    await access(new URL(path, root));
  }
});

test('all HTML styles/scripts and imported modules exist and belong to the offline shell', async () => {
  const shell = new Set(createWorker().ASSETS_TO_CACHE.map(path => path.slice(2)));
  for (const name of pages) {
    const html = await readFile(new URL(name, root), 'utf8');
    for (const match of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g)) {
      const path = match[1].split('?')[0];
      if (/^https?:/.test(path) || (!path.endsWith('.css') && !path.endsWith('.js'))) continue;
      await access(new URL(path, root));
      assert.ok(shell.has(path), `${name} requires uncached resource ${path}`);
    }
  }
  for (const name of await readdir(new URL('assets/js/', root))) {
    const js = await readFile(new URL(`assets/js/${name}`, root), 'utf8');
    for (const match of js.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
      const path = new URL(match[1], new URL(`assets/js/${name}`, root));
      await access(path);
      assert.ok(shell.has(path.href.slice(root.href.length)));
    }
  }
});

test('CSP is generated consistently and permits required origins without unsafe-inline/eval/wildcards', async () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('scripts/sync-csp.mjs', root))], { stdio: 'pipe' });
  for (const name of pages) {
    const html = await readFile(new URL(name, root), 'utf8');
    const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.match(policy, /img-src 'self' data: https:\/\/media.formula1.com https:\/\/flagsapi.com https:\/\/upload.wikimedia.org;/);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
    assert.match(policy, /script-src-attr 'none'/);
    assert.match(policy, /style-src-attr 'none'/);
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<link'));
    assert.doesNotMatch(html, /<style\b|\sstyle="|\son(?:error|load|click)="/);
  }
});

test('404 uses the current stylesheet and a home link; bootstrap handles root and nested Pages URLs', async () => {
  const html = await readFile(new URL('404.html', root), 'utf8');
  assert.match(html, /href="assets\/css\/styles-v7.css"/);
  assert.match(html, /href="index.html"/);
  const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [path, expected] of [['/missing/nested', '/'], ['/missing/F1/nested', '/'], ['/F1/missing/nested', '/F1/'], ['/F1/missing/F1/nested', '/F1/']]) {
    let base;
    vm.runInNewContext(bootstrap, { URL, location: { pathname: path, origin: 'https://example.test' }, document: {
      querySelector() { return { href: 'https://andersoncav.github.io/F1/' }; },
      createElement() { return {}; }, head: { appendChild(element) { base = element.href; } }
    } });
    assert.equal(base, `https://example.test${expected}`);
  }
});

test('image fallback is idempotent and performs at most one retry even if placeholder fails', () => {
  class Image extends EventTarget {
    assignments = 0;
    value = 'https://external.test/broken.png';
    get src() { return this.value; }
    set src(value) { this.assignments++; this.value = value; }
  }
  const image = new Image();
  setImageFallback(image);
  setImageFallback(image);
  for (let i = 0; i < 10; i++) image.dispatchEvent(new Event('error'));
  assert.equal(image.src, PLACEHOLDER_DRIVER_IMAGE);
  assert.equal(image.assignments, 1);
  const placeholder = new Image();
  placeholder.value = PLACEHOLDER_DRIVER_IMAGE;
  setImageFallback(placeholder);
  placeholder.dispatchEvent(new Event('error'));
  assert.equal(placeholder.assignments, 0);
});

test('worker registration derives its URL and scope from module location, even on nested pages', async () => {
  const source = await readFile(new URL('assets/js/ui-utils.js', root), 'utf8');
  for (const base of ['https://example.test/', 'https://example.test/F1/', 'https://example.test/custom/']) {
    const registrations = [];
    const context = { URL, console, document: { readyState: 'complete' },
      navigator: { serviceWorker: { register(...args) { registrations.push(args); return Promise.resolve(); } } },
      window: { location: { pathname: '/unrelated/nested/url' } } };
    vm.runInNewContext(source.replaceAll('export ', '').replaceAll('import.meta.url', JSON.stringify(`${base}assets/js/ui-utils.js`)), context);
    assert.equal(registrations[0][0], `${base}sw.js`);
    assert.equal(registrations[0][1].scope, base);
  }
});

test('refresh UI preserves data, sends a one-navigation marker, and reports oldest/stale metadata', async () => {
  const source = await readFile(new URL('assets/js/ui-utils.js', root), 'utf8');
  const listeners = {};
  let info;
  let destination;
  const context = vm.createContext({ URL, Date, console,
    window: { location: { href: 'https://example.test/F1/drivers.html?sort=name', assign(url) { destination = url; } } },
    document: { getElementById(id) { return id === 'clear-cache-btn' ? { addEventListener(type, handler) { listeners[type] = handler; } } : null; },
      createElement() { return { setAttribute() {} }; }, body: { appendChild(element) { info = element; } } }
  });
  vm.runInContext(source.replaceAll('export ', '').replaceAll('import.meta.url', '"https://example.test/F1/assets/js/ui-utils.js"'), context);
  context.records = [{ timestamp: Date.now(), stale: false }, { timestamp: Date.now() - 7200000, stale: true }];
  vm.runInContext('showCacheFeedback(...records)', context);
  assert.match(info.innerHTML, /DADOS SALVOS/);
  listeners.click();
  assert.equal(destination, 'https://example.test/F1/drivers.html?sort=name&f1-refresh=1');
});

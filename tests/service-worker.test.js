import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './helpers/sw-harness.js';

test('installation caches the complete shell and bypasses HTTP cache', async () => {
  const worker = createWorker();
  await worker.lifecycle('install');
  assert.equal(worker.stores.get(worker.STATIC_CACHE).size, worker.ASSETS_TO_CACHE.length);
  assert.ok(worker.requests.every(request => request.cache === 'reload'));
});

test('activation deletes only obsolete app caches for this mount and exact legacy names', async () => {
  const worker = createWorker();
  const survivors = ['other-project-v1', 'f1-portal:/another/:static-v2', 'f1-portal-v2-other', worker.STATIC_CACHE];
  for (const name of [...survivors, 'f1-portal-v1', 'f1-portal-v2', 'f1-portal-v13', `${worker.CACHE_PREFIX}static-v2`]) {
    await worker.caches.open(name);
  }
  await worker.lifecycle('activate');
  assert.deepEqual(await worker.caches.keys(), survivors);
});

for (const failure of ['404', '429', '500', 'html-for-js', 'redirect']) {
  test(`failed install (${failure}) preserves previous worker cache and reports failure`, async () => {
    const worker = createWorker({ network: async request => {
      if (request.url.endsWith('api.js')) {
        const response = new Response('error', { status: /^\d/.test(failure) ? Number(failure) : 200,
          headers: { 'Content-Type': failure === 'html-for-js' ? 'text/html' : 'text/javascript' } });
        if (failure === 'redirect') Object.defineProperty(response, 'redirected', { value: true });
        return response;
      }
      const extension = request.url.split('.').pop();
      return new Response('ok', { headers: { 'Content-Type': { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', json: 'application/json' }[extension] } });
    } });
    await worker.caches.open('f1-portal-v2');
    await assert.rejects(worker.lifecycle('install'));
    assert.deepEqual(await worker.caches.keys(), ['f1-portal-v2']);
    assert.equal(worker.logs.length, 1);
  });
}

test('API, cross-origin, sibling app, and non-GET requests bypass the worker completely', () => {
  const worker = createWorker();
  for (const request of [
    new Request('https://api.jolpi.ca/ergast/f1/current/races.json'),
    new Request('https://api.jolpi.ca.evil.test/error.json'),
    new Request('https://external.test/font.woff'),
    new Request('https://example.test/other/index.html'),
    new Request('https://example.test/F1/index.html', { method: 'POST', body: 'x' }),
    new Request('https://example.test/F1/not-an-asset.json')
  ]) assert.equal(worker.fetch(request), undefined);
  assert.equal(worker.stores.size, 0);
});

for (const base of ['https://example.test/', 'https://example.test/F1/']) {
  test(`offline shell supports directory aliases and query strings at ${base}`, async () => {
    let offline = false;
    const worker = createWorker({ base, network: async request => {
      if (offline) throw new TypeError('offline');
      const extension = request.url.split('.').pop();
      return new Response('cached-shell', { headers: { 'Content-Type': { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', json: 'application/json' }[extension] } });
    } });
    await worker.lifecycle('install');
    offline = true;
    for (const path of ['', 'drivers.html?sort=name', 'assets/css/animations.css?v=2.0']) {
      const response = await worker.fetch(new Request(new URL(path, base)));
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'cached-shell');
    }
    assert.equal(worker.requests.length, worker.ASSETS_TO_CACHE.length);
  });
}

for (const status of [404, 429, 500]) {
  test(`runtime HTTP ${status} is never persisted`, async () => {
    const worker = createWorker({ network: async () => new Response('error', { status }) });
    const response = await worker.fetch(new Request('https://example.test/F1/assets/js/api.js'));
    assert.equal(response.status, status);
    assert.equal(worker.stores.get(worker.STATIC_CACHE).size, 0);
  });
}

test('HTML masquerading as JavaScript is never persisted; misses fail predictably offline', async () => {
  const worker = createWorker({ network: async () => new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }) });
  await worker.fetch(new Request('https://example.test/F1/assets/js/api.js'));
  assert.equal(worker.stores.get(worker.STATIC_CACHE).size, 0);
  const offline = createWorker({ network: async () => { throw new Error('offline'); } });
  assert.equal((await offline.fetch(new Request('https://example.test/F1/index.html'))).status, 503);
});

test('offline unknown navigation returns the cached 404 without writing arbitrary URLs', async () => {
  const worker = createWorker({ network: async () => { throw new Error('offline'); } });
  const cache = await worker.caches.open(worker.STATIC_CACHE);
  await cache.put('https://example.test/F1/404.html', new Response('404-shell'));
  const response = await worker.fetch({ method: 'GET', mode: 'navigate', url: 'https://example.test/F1/nested/missing' });
  assert.equal(response.status, 404);
  assert.equal(await response.text(), '404-shell');
  assert.equal(worker.stores.get(worker.STATIC_CACHE).size, 1);
});

test('CacheStorage denial still allows the network shell and a predictable offline response', async () => {
  const worker = createWorker();
  worker.caches.open = async () => { throw new Error('storage denied'); };
  assert.equal((await worker.fetch(new Request('https://example.test/F1/index.html'))).status, 200);
  const offline = createWorker({ network: async () => { throw new Error('offline'); } });
  offline.caches.open = worker.caches.open;
  assert.equal((await offline.fetch(new Request('https://example.test/F1/index.html'))).status, 503);
});

test('cache write failure does not reject a successful network response', async () => {
  const worker = createWorker();
  const originalOpen = worker.caches.open;
  worker.caches.open = async name => {
    const cache = await originalOpen(name);
    cache.put = async () => { throw new Error('quota exceeded'); };
    return cache;
  };
  const response = await worker.fetch(new Request('https://example.test/F1/index.html'));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'shell');
  assert.equal(worker.logs.length, 1);
});

// Bump this version whenever an application-shell resource changes.
const CACHE_VERSION = 'v3';
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `f1-portal:${APP_BASE.pathname}:`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const LEGACY_CACHE = /^f1-portal-v\d+$/;
const ASSETS_TO_CACHE = [
  './index.html', './drivers.html', './teams.html', './champions.html',
  './calendar.html', './404.html',
  './assets/css/styles-v7.css', './assets/css/animations.css',
  './assets/js/api.js', './assets/js/calendar.js', './assets/js/champions.js',
  './assets/js/drivers-v10.js', './assets/js/main-v10.js', './assets/js/static-data.js',
  './assets/js/teams-v10.js', './assets/js/ui-utils.js',
  './assets/images/placeholder-driver.svg', './manifest.json'
];
const SHELL_URLS = new Set(ASSETS_TO_CACHE.map(path => new URL(path, APP_BASE).href));

function isValidAsset(response, url) {
  if (!response || response.status !== 200 || response.redirected) return false;
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim();
  const extension = new URL(url).pathname.split('.').pop();
  const types = {
    html: ['text/html'], css: ['text/css'],
    js: ['text/javascript', 'application/javascript'],
    json: ['application/json', 'application/manifest+json'], svg: ['image/svg+xml']
  };
  return types[extension]?.includes(type) === true;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(STATIC_CACHE);
      // addAll rejects atomically on missing/failed HTTP resources. Bypass HTTP cache.
      await cache.addAll([...SHELL_URLS].map(url => new Request(url, { cache: 'reload' })));
      for (const url of SHELL_URLS) {
        if (!isValidAsset(await cache.match(url), url)) {
          throw new Error(`Invalid application-shell response: ${url}`);
        }
      }
      // Let the previous worker finish serving its clients before activating an update.
    } catch (error) {
      console.error('[F1 Portal] Service Worker installation failed.', error);
      try { await caches.delete(STATIC_CACHE); }
      catch (cleanupError) { console.warn('[F1 Portal] Failed installation cache cleanup.', cleanupError); }
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      (name.startsWith(CACHE_PREFIX) && name !== STATIC_CACHE) || LEGACY_CACHE.test(name)
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function serveShell(request, url) {
  let cache;
  let cached;
  try {
    cache = await caches.open(STATIC_CACHE);
    cached = await cache.match(url.href);
  } catch (error) { console.warn('[F1 Portal] Shell cache read failed.', error); }
  if (isValidAsset(cached, url)) return cached;
  // Storage can be evicted independently of the worker. Never persist an error page.
  try {
    const response = await fetch(request);
    if (cache && isValidAsset(response, url)) {
      try { await cache.put(url.href, response.clone()); }
      catch (error) { console.warn('[F1 Portal] Shell cache write failed.', error); }
    }
    return response;
  } catch {
    return new Response('Recurso indisponível offline.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  url.search = '';
  if (url.pathname === APP_BASE.pathname) url.pathname += 'index.html';
  if (SHELL_URLS.has(url.href)) {
    event.respondWith(serveShell(event.request, url));
  } else if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      let fallback;
      try {
        const cache = await caches.open(STATIC_CACHE);
        fallback = await cache.match(new URL('./404.html', APP_BASE).href);
      } catch { /* Storage may be denied or evicted. Return a useful error anyway. */ }
      return new Response(fallback ? await fallback.text() : 'Página indisponível offline.', {
        status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }));
  }
  // API freshness belongs exclusively to api.js; third-party resources are never cached here.
});

import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

export const swSource = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');

export function createWorker({ base = 'https://example.test/F1/', network } = {}) {
  const listeners = {};
  const stores = new Map();
  const requests = [];
  const logs = [];
  const clone = response => {
    if (!response) return undefined;
    const copy = response.clone();
    if (response.redirected) Object.defineProperty(copy, 'redirected', { value: true });
    return copy;
  };
  const key = request => new URL(typeof request === 'string' ? request : request.url, base).href;
  const fetch = async request => {
    requests.push(request);
    if (network) return network(request);
    const extension = new URL(key(request)).pathname.split('.').pop();
    const type = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml' }[extension];
    return new Response('shell', { headers: { 'Content-Type': type } });
  };
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request) { return clone(entries.get(key(request))); },
        async put(request, response) { entries.set(key(request), clone(response)); },
        async addAll(inputs) {
          const responses = await Promise.all(inputs.map(fetch));
          if (responses.some(response => !response.ok)) throw new Error('addAll failed');
          responses.forEach((response, i) => entries.set(key(inputs[i]), clone(response)));
        }
      };
    }
  };
  const context = vm.createContext({
    URL, Request, Response, caches, fetch,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    self: { location: { href: new URL('sw.js', base).href }, clients: { async claim() {} },
      addEventListener(type, callback) { listeners[type] = callback; } }
  });
  vm.runInContext(swSource, context);
  const config = vm.runInContext('({ ASSETS_TO_CACHE, STATIC_CACHE, CACHE_PREFIX })', context);
  return {
    ...config, caches, stores, requests, logs,
    async lifecycle(type) {
      let promise;
      listeners[type]({ waitUntil(value) { promise = value; } });
      await promise;
    },
    fetch(request) {
      let response;
      listeners.fetch({ request, respondWith(value) { response = value; } });
      return response;
    }
  };
}

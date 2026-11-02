import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../dist-preview/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL(".vite/manifest.json", root), "utf8"),
);
const core = new Set(["index.html", "favicon.svg"]);
function add(key) {
  const m = manifest[key];
  if (!m || core.has(m.file)) return;
  core.add(m.file);
  for (const css of m.css || []) core.add(css);
  for (const asset of m.assets || []) core.add(asset);
  for (const dep of m.imports || []) add(dep);
}
for (const [key, m] of Object.entries(manifest))
  if (m.isEntry || key.endsWith("DashboardView.vue")) add(key);
for (const file of await readdir(new URL("assets/", root)))
  if (/\.woff2$|placeholder-driver.*\.svg$/.test(file))
    core.add(`assets/${file}`);
const paths = [...core].sort();
const digest = createHash("sha256");
for (const path of paths) digest.update(await readFile(new URL(path, root)));
const version = digest.digest("hex").slice(0, 16);
const worker = `// Generated isolated preview worker. Never register at the legacy /F1/ scope.
const PREFIX = 'f1-experience-';
const CACHE = PREFIX + '${version}';
const BASE = new URL('./', self.location.href).pathname;
const CORE = ${JSON.stringify(paths)}.map(path => BASE + path);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(BASE + 'index.html'))));
  } else if (CORE.includes(url.pathname) || url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      // Only same-origin versioned assets reach this branch. Preview servers vary
      // on Origin; modulepreload and install fetches can send different headers.
      const hit = await cache.match(request, { ignoreVary: true });
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    }));
  }
});
`;
await writeFile(new URL("experience-sw.js", root), worker);
await writeFile(
  new URL("offline-manifest.json", root),
  JSON.stringify({ version, scope: "/F1/experience/", core: paths }, null, 2) +
    "\n",
);
console.log(
  `Isolated offline shell: ${paths.length} resources. Other routes cache only when visited.`,
);

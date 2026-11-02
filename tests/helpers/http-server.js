import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const types = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  ico: 'image/x-icon',
  txt: 'text/plain',
  xml: 'application/xml'
};

export async function startServer(options = {}) {
  const serverRoot = options.rootDir ? new URL(options.rootDir, root) : root;
  const state = { release: 'current', missingAsset: null, workerSource: null, requests: [] };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname).replace(/^\/F1(?=\/)/, '').replace(/^\//, '');
    if (!path || path.endsWith('/')) path += 'index.html';
    state.requests.push({ path: url.pathname, status: null });
    const log = state.requests.at(-1);
    const file = new URL(path, serverRoot);
    const send = (status, body, extension) => {
      log.status = status;
      response.writeHead(status, { 'Content-Type': `${types[extension] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' });
      response.end(body);
    };
    if (!file.href.startsWith(serverRoot.href) || path.startsWith('.git/')) return send(403, 'Forbidden', 'txt');
    try {
      if (state.workerSource && path === 'sw.js') return send(200, state.workerSource, 'js');
      if (state.missingAsset && url.pathname.endsWith(state.missingAsset)) throw new Error('test missing asset');
      const revision = state.release === 'phase3' ? 'f2b3bb18ff50d648091f1a92b17df198172c2823'
        : (!options.rootDir && state.release === 'previous') ? 'eaa7335'
        : (!options.rootDir && state.release === 'phase1') ? '1e54313a866b1c5227067bb0deceee8916806e86'
        : (!options.rootDir && state.release === 'phase1_1') ? '5269a9e694ba2ac2cd6ddc686c0d6dda7c33ea24'
        : null;
      const body = revision
        ? execFileSync('git', ['show', `${revision}:${path}`], { cwd: fileURLToPath(root), stdio: ['ignore', 'pipe', 'ignore'] })
        : await readFile(file);
      send(200, body, path.split('.').pop());
    } catch {
      try {
        send(404, await readFile(new URL('404.html', serverRoot)), 'html');
      } catch {
        send(404, 'Not Found', 'txt');
      }
    }
  });
  const port = options.port !== undefined ? options.port : 0;
  await new Promise(resolve => server.listen(port, options.host || '127.0.0.1', resolve));
  return { state, server, origin: `http://127.0.0.1:${server.address().port}`,
    async close() { await new Promise(resolve => server.close(resolve)); } };
}

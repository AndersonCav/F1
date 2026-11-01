import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', svg: 'image/svg+xml' };

export async function startServer() {
  const state = { release: 'current', missingAsset: null, workerSource: null, requests: [] };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname).replace(/^\/F1(?=\/)/, '').replace(/^\//, '');
    if (!path || path.endsWith('/')) path += 'index.html';
    state.requests.push({ path: url.pathname, status: null });
    const log = state.requests.at(-1);
    const file = new URL(path, root);
    const send = (status, body, extension) => {
      log.status = status;
      response.writeHead(status, { 'Content-Type': `${types[extension] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' });
      response.end(body);
    };
    if (!file.href.startsWith(root.href) || path.startsWith('.git/')) return send(403, 'Forbidden', 'txt');
    try {
      if (state.workerSource && path === 'sw.js') return send(200, state.workerSource, 'js');
      if (state.missingAsset && url.pathname.endsWith(state.missingAsset)) throw new Error('test missing asset');
      const body = state.release === 'previous'
        ? execFileSync('git', ['show', `eaa7335:${path}`], { cwd: fileURLToPath(root), stdio: ['ignore', 'pipe', 'ignore'] })
        : await readFile(file);
      send(200, body, path.split('.').pop());
    } catch {
      send(404, await readFile(new URL('404.html', root)), 'html');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, origin: `http://127.0.0.1:${server.address().port}`,
    async close() { await new Promise(resolve => server.close(resolve)); } };
}

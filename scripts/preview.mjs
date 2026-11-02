import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../tests/helpers/http-server.js';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distDir = resolve(rootDir, 'dist');
const port = Number(process.env.PORT) || 8080;

try {
  const s = await stat(distDir);
  if (!s.isDirectory()) throw new Error('Not a directory');
} catch {
  console.error('[preview] ERROR: dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

const serverInstance = await startServer({ rootDir: 'dist/', port });
console.log(`[preview] F1 Portal production artifact preview running:`);
console.log(`[preview] Local URL:  ${serverInstance.origin}/F1/`);
console.log(`[preview] Root path:  ${distDir}`);
console.log(`[preview] Press Ctrl+C to stop.`);

process.on('SIGINT', async () => {
  console.log('\n[preview] Shutting down preview server...');
  await serverInstance.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await serverInstance.close();
  process.exit(0);
});

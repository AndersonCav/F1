import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
// HTML meta CSP must precede resources. It cannot be fetched from a shared file at runtime.
// The only inline script fixes nested 404 paths; authorize its exact bytes, never unsafe-inline.
const errorPage = await readFile(new URL('404.html', root), 'utf8');
const bootstrap = errorPage.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r\n/g, '\n');
const hash = createHash('sha256').update(bootstrap).digest('base64');
const policy = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${hash}'`,
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'none'",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: https://media.formula1.com https://flagsapi.com https://upload.wikimedia.org",
  "connect-src 'self' https://api.jolpi.ca",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ') + ';';

for (const name of (await readdir(root)).filter(name => name.endsWith('.html'))) {
  const url = new URL(name, root);
  const html = await readFile(url, 'utf8');
  const current = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  if (!current) throw new Error(`Missing CSP: ${name}`);
  if (process.argv.includes('--write')) {
    await writeFile(url, html.replace(current[0], `<meta http-equiv="Content-Security-Policy" content="${policy}">`));
  } else if (current[1] !== policy) {
    throw new Error(`CSP differs in ${name}. Run npm run sync:csp.`);
  }
}
console.log('CSP synchronized across all HTML pages.');

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pages = ['index.html', 'drivers.html', 'teams.html', 'champions.html', 'calendar.html'];
const texts = await Promise.all(pages.map(file => readFile(new URL(file, root), 'utf8')));
const meta = (html, key) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]+)"`))?.[1];
const titles = new Set();
const descriptions = new Set();
for (const [i, file] of pages.entries()) {
  test(`SEO: ${file} has unique honest metadata, canonical, social card and static description`, () => {
    const html = texts[i];
    const url = `https://andersoncav.github.io/F1/${i ? file : ''}`;
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const description = meta(html, 'description');
    assert.ok(!titles.has(title)); titles.add(title);
    assert.ok(!descriptions.has(description)); descriptions.add(description);
    assert.ok(description.length > 75 && description.length < 210);
    assert.match(html, new RegExp(`rel="canonical" href="${url.replaceAll('.', '\\.')}"`));
    assert.equal(meta(html, 'og:url'), url);
    assert.equal(meta(html, 'og:title'), title);
    assert.equal(meta(html, 'og:description'), description);
    assert.equal(meta(html, 'twitter:title'), title);
    assert.equal(meta(html, 'twitter:description'), description);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(html, 'og:image'), 'https://andersoncav.github.io/F1/assets/images/social-preview.png');
    assert.equal(meta(html, 'twitter:image'), meta(html, 'og:image'));
    assert.match(html, /<html lang="pt-BR">/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /<noscript>.*<p/);
    assert.doesNotMatch(`${description} ${meta(html, 'og:title')} ${meta(html, 'og:description')}`, /tempo real|ao vivo/i);
    assert.equal(meta(html, 'robots'), 'index,follow');
  });
}
test('SEO: sitemap contains exactly the five canonical destinations; project robots allows assets', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, pages.map((file, i) => `https://andersoncav.github.io/F1/${i ? file : ''}`));
  const robots = await readFile(new URL('robots.txt', root), 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \/F1\//);
  assert.match(robots, /Sitemap: https:\/\/andersoncav.github.io\/F1\/sitemap.xml/);
  assert.doesNotMatch(robots, /Disallow:/);
});
test('SEO: error page is noindex, has no misleading canonical and preserves nested-path bootstrap', async () => {
  const html = await readFile(new URL('404.html', root), 'utf8');
  assert.equal(meta(html, 'robots'), 'noindex,follow');
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.match(html, /rel="home"/);
  assert.match(html, /Página não encontrada/);
});
test('PWA: branded PNG dimensions, safe maskable artwork, manifest mount and offline icon coverage', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './index.html');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.lang, 'pt-BR');
  const worker = await readFile(new URL('sw.js', root), 'utf8');
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(icon.src, root));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
    assert.equal(icon.type, 'image/png');
    assert.match(icon.purpose, /maskable/);
    assert.ok(worker.includes(`'./${icon.src}'`));
  }
  const social = await readFile(new URL('assets/images/social-preview.png', root));
  assert.equal(social.readUInt32BE(16), 1200);
  assert.equal(social.readUInt32BE(20), 630);
  assert.ok(!worker.includes('social-preview.png'), 'social artwork is optional, outside mandatory offline shell');
});
test('Performance: one font stylesheet per entrypoint, no CSS imports or downloaded monospace', async () => {
  for (const html of [...texts, await readFile(new URL('404.html', root), 'utf8')]) {
    assert.equal((html.match(/href="https:\/\/fonts.googleapis.com\/css2[^" ]+/g) || []).length, 1);
    assert.match(html, /display=swap/);
    assert.doesNotMatch(html, /Roboto/);
  }
  const css = await readFile(new URL('assets/css/styles-v7.css', root), 'utf8');
  assert.doesNotMatch(css, /@import|overflow-x:\s*hidden/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion/);
});
test('Structured data describes an independent WebSite without invented event or search information', () => {
  assert.match(texts[0], /itemscope itemtype="https:\/\/schema.org\/WebSite"/);
  assert.match(texts[0], /itemprop="url" content="https:\/\/andersoncav.github.io\/F1\/"/);
  assert.match(texts[0], /itemprop="name"/);
  assert.doesNotMatch(texts[0], /schema.org\/(?:Event|Organization|SearchAction)/);
});

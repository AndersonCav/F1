// Optional, read-only external verification. Never runs as part of ordinary tests.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir = new URL('../docs/phase-2/sources/', import.meta.url);
await mkdir(dir, { recursive: true });
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'F1PortalAudit/2.0' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
for (const [key, file] of [['farina', 'File:Vítězný Giuseppe Farina zdraví diváky (Masarykův okruh 1934).jpg'], ['norris', 'File:Lando Norris, British GP 2022 (52382574143) (cropped).jpg']]) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', titles: file, prop: 'imageinfo|revisions',
    iiprop: 'url|extmetadata|sha1', iiurlwidth: '250', rvprop: 'content', rvslots: 'main' });
  const data = await (await get(url)).json();
  await writeFile(new URL(`${key}-commons.json`, dir), JSON.stringify(data, null, 2) + '\n');
  const page = Object.values(data.query.pages)[0];
  const info = page.imageinfo[0];
  const r = await get(info.thumburl || info.url);
  const bytes = Buffer.from(await r.arrayBuffer());
  await writeFile(new URL(`${key}-probe.json`, dir), JSON.stringify({ checkedAt: new Date().toISOString(), url: info.thumburl || info.url,
    status: r.status, contentType: r.headers.get('content-type'), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), width: info.thumbwidth, height: info.thumbheight }, null, 2) + '\n');
  console.log(key, info.thumburl, info.extmetadata.LicenseShortName?.value, info.extmetadata.Artist?.value);
}
if (process.argv.includes('--photos-only')) process.exit(0);
const races = [];
const pages = [];
for (let offset = 0; ; offset += 100) {
  const url = `https://api.jolpi.ca/ergast/f1/results/1.json?limit=100&offset=${offset}`;
  const data = await (await get(url)).json();
  if (!Array.isArray(data.MRData?.RaceTable?.Races)) throw new Error('Invalid winners');
  pages.push({ url, total: data.MRData.total, offset: data.MRData.offset });
  races.push(...data.MRData.RaceTable.Races.filter(r => Number(r.season) <= 2025));
  if (offset + 100 >= Number(data.MRData.total)) break;
  await new Promise(resolve => setTimeout(resolve, 400));
}
const wins = {};
for (const r of races) for (const result of r.Results) {
  const id = result.Driver.driverId;
  wins[id] = (wins[id] || 0) + 1;
}
await writeFile(new URL('gp-winners-through-2025.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), throughSeason: 2025,
  definition: 'World Championship Grand Prix classified position 1; includes shared wins; excludes sprints and non-championship races', pages, wins, races }, null, 2) + '\n');
console.log('Verified winner races', races.length, 'Max', wins.max_verstappen, 'Lando', wins.norris);

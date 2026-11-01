import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../docs/phase-2/sources/', import.meta.url);
await mkdir(root, { recursive: true });
const html = await (await fetch('https://www.formula1.com/en/drivers/hall-of-fame')).text();
const urls = [...new Set([...html.matchAll(/href="([^"]*\/information\/drivers-hall-of-fame[^"]*)"/g)].map(m => new URL(m[1], 'https://www.formula1.com').href))];
const records = [];
for (const url of urls) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const body = await response.text();
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const title = body.match(/<title>(.*?)<\/title>/)?.[1];
  const years = text.match(/HALL OF FAME\s*-?\s*((?:19|20)\d{2}(?:(?:\s*,\s*|\s*-\s*)(?:(?:19|20)\d{2}|\d{2}))*)/i)?.[1];
  records.push({ url, title, years, verifiedAt: new Date().toISOString() });
}
await writeFile(new URL('official-hall-of-fame.json', root), JSON.stringify(records, null, 2) + '\n');
console.log(records.length, records);

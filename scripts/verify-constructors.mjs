import { writeFile } from 'node:fs/promises';
const dir = new URL('../docs/phase-2/sources/', import.meta.url);
const teams = { mercedes: 'mercedes', ferrari: 'ferrari', mclaren: 'mclaren', haas: 'haas', red_bull: 'red-bull-racing',
  rb: 'racing-bulls', alpine: 'alpine', audi: 'audi', williams: 'williams', cadillac: 'cadillac', aston_martin: 'aston-martin' };
const metadata = {};
for (const [id, path] of Object.entries(teams)) {
  const url = `https://www.formula1.com/en/teams/${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const text = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replaceAll('&amp;', '&');
  const match = text.match(/Full Team Name (.*?) Base (.*?) Team Chief (.*?) Technical Chief (.*?) Chassis (.*?) Power Unit (.*?) Reserve Driver /);
  if (!match) throw new Error(`Unknown metadata layout ${id}`);
  metadata[id] = { season: 2026, name: match[1], base: match[2], principal: match[3], technicalChief: match[4], chassis: match[5], powerUnit: match[6],
    source: url, verifiedAt: new Date().toISOString(), referenceDate: '2026-11-01' };
}
await writeFile(new URL('constructor-metadata-2026.json', dir), JSON.stringify(metadata, null, 2) + '\n');
const champions = [];
for (let season = 1958; season <= 2025; season++) {
  const url = `https://api.jolpi.ca/ergast/f1/${season}/constructorStandings/1.json?limit=100`;
  const r = await fetch(url, { headers: { 'User-Agent': 'F1PortalAudit/2.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const data = (await r.json()).MRData;
  const list = data.StandingsTable?.StandingsLists?.[0];
  if (list?.season !== String(season) || list.ConstructorStandings.length !== 1 || data.total !== '1') throw new Error('Invalid champion response');
  champions.push({ season, round: list.round, ...list.ConstructorStandings[0].Constructor, source: url });
  await new Promise(resolve => setTimeout(resolve, 300));
}
await writeFile(new URL('constructor-titles-through-2025.json', dir), JSON.stringify({ checkedAt: new Date().toISOString(), champions }, null, 2) + '\n');
console.log('Verified metadata', Object.keys(metadata).length, 'constructor titles', champions.length);

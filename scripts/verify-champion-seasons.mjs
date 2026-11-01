import { writeFile } from 'node:fs/promises';
import { CHAMPIONS_HISTORY } from '../assets/js/champion-history.js';
const records = [];
for (let season = 1950; season <= 2025; season++) {
  const url = `https://api.jolpi.ca/ergast/f1/${season}/driverStandings/1.json?limit=100`;
  const response = await fetch(url, { headers: { 'User-Agent': 'F1PortalAudit/2.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const mr = (await response.json()).MRData;
  const list = mr.StandingsTable.StandingsLists[0];
  if (mr.total !== '1' || list.season !== String(season)) throw new Error('Incomplete champion response');
  const entry = list.DriverStandings[0];
  const expected = CHAMPIONS_HISTORY.find(c => c.titleYears.includes(season));
  if (entry.Driver.driverId !== expected.id) throw new Error(`Champion mismatch ${season}`);
  records.push({ season, round: list.round, driverId: entry.Driver.driverId, nationality: entry.Driver.nationality,
    constructors: entry.Constructors, source: url });
  await new Promise(resolve => setTimeout(resolve, 300));
}
await writeFile(new URL('../docs/phase-2/sources/championship-seasons.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), records }, null, 2) + '\n');
console.log('Verified all', records.length, 'completed World Drivers Championships');

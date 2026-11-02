import { readFile } from 'node:fs/promises';
import { driver, constructor, standing, race, result, standingsResponse, racesResponse } from './sporting-fixtures.js';

export const auditNow = '2026-11-02T12:00:00Z';
const teams = [constructor(), constructor('ferrari', 'Ferrari'), constructor('red_bull', 'Red Bull'), constructor('mercedes', 'Mercedes')];
export const auditDrivers = [
  ['norris', 'Lando', 'Norris', 0], ['piastri', 'Oscar', 'Piastri', 0],
  ['max_verstappen', 'Max', 'Verstappen', 2], ['leclerc', 'Charles', 'Leclerc', 1],
  ['hamilton', 'Lewis', 'Hamilton', 1], ['russell', 'George', 'Russell', 3]
].map(([id, first, last, team], i) => ({ ...standing(id, String(i + 1), String(350 - i * 37), String(6 - i), [teams[team]]), Driver: driver(id, first, last) }));
const completed = race('20', { raceName: 'Mexico City Grand Prix', date: '2026-11-01', time: '20:00:00Z' });
export const auditRaces = [completed, race('21', { raceName: 'São Paulo Grand Prix', date: '2026-11-08', time: '17:00:00Z', Circuit: { circuitId: 'interlagos', circuitName: 'Autódromo José Carlos Pace', Location: { country: 'Brazil', locality: 'São Paulo' } } }), race('22', { date: '2026-11-21', time: undefined })];

export async function fixtureRoutes(context, { fail = false, empty = false } = {}) {
  const fallback = await readFile(new URL('../../assets/images/placeholder-driver.svg', import.meta.url));
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.route(/^https:\/\/(media\.formula1\.com|flagsapi\.com|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//, route => route.fulfill({ contentType: 'image/svg+xml', body: fallback }));
  await context.route('https://api.jolpi.ca/**', route => {
    if (fail) return route.abort('failed');
    const path = new URL(route.request().url()).pathname;
    let data;
    if (/constructorStandings/.test(path)) data = standingsResponse(empty ? [] : teams.map((Constructor, i) => ({ Constructor, position: String(i + 1), points: String(630 - i * 110), wins: String(9 - i) })), '2026', 'ConstructorStandings');
    else if (/driverStandings/.test(path)) data = standingsResponse(empty ? [] : auditDrivers);
    else if (/drivers.json/.test(path)) data = { MRData: { total: empty ? '0' : String(auditDrivers.length), offset: '0', DriverTable: { season: '2026', Drivers: empty ? [] : auditDrivers.map(s => s.Driver) } } };
    else if (/results/.test(path)) data = racesResponse(empty ? [] : [result('20', { ...completed, Results: auditDrivers.slice(0, 3).map((s, i) => ({ position: String(i + 1), Driver: s.Driver, Constructor: s.Constructors[0], Time: { time: i ? `+${i * 3}.120` : '1:35:22.500' } })) })], '2026', true);
    else data = racesResponse(empty ? [] : auditRaces);
    return route.fulfill({ json: data });
  });
}

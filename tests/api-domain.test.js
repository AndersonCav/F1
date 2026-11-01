import test from 'node:test';
import assert from 'node:assert/strict';
import { standingsResponse, standing, racesResponse, race, result } from './helpers/sporting-fixtures.js';
import { CHAMPIONS_HISTORY, CHAMPIONS_VERIFIED_AT } from '../assets/js/champion-history.js';
const NOW = Date.parse('2026-11-01T12:00:00Z');
let serial = 0;
async function setup(t, responses, initial = {}) {
  const priorFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const map = new Map(Object.entries(initial)); const calls = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { get length() { return map.size; },
    key: i => [...map.keys()][i], getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) } });
  globalThis.fetch = async url => {
    calls.push(String(url));
    const next = responses.shift(); if (next instanceof Error) throw next;
    return Response.json(next);
  };
  t.mock.method(Date, 'now', () => NOW);
  t.after(() => { globalThis.fetch = priorFetch; if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; });
  return { api: await import(`../assets/js/api.js?domain=${serial++}`), map, calls };
}
const cache = data => JSON.stringify({ data, timestamp: NOW - 3600001 });
for (const [label, invalid] of [
  ['duplicate drivers', () => standingsResponse([standing(), standing()])],
  ['wrong season', () => standingsResponse([standing()], '2025')],
  ['truncated records', () => { const d = standingsResponse(); d.MRData.total = '22'; return d; }],
  ['empty same-season replacement', () => ({ MRData: { total: '0', StandingsTable: { season: '2026', StandingsLists: [] } } })],
  ['older sporting round', () => { const d = standingsResponse(); d.MRData.StandingsTable.StandingsLists[0].round = '10'; return d; }]
]) {
  test(`domain rejection of ${label} preserves original good data and timestamp`, async t => {
    const saved = cache(standingsResponse());
    const { api, map } = await setup(t, [invalid()], { f1_driver_standings_2026: saved });
    const value = await api.fetchCurrentDriverStandings(2026);
    assert.equal(value.source, 'cache'); assert.equal(value.stale, true); assert.equal(value.timestamp, NOW - 3600001);
    assert.equal(value.items[0].Driver.driverId, 'norris'); assert.equal(map.get('f1_driver_standings_2026'), saved);
  });
}
test('a partial same-round roster cannot replace a larger previously verified roster', async t => {
  const saved = cache(standingsResponse([standing(), standing('piastri', '2')]));
  const { api } = await setup(t, [standingsResponse()], { f1_driver_standings_2026: saved });
  assert.equal((await api.fetchCurrentDriverStandings(2026)).items.length, 2);
});
test('a current alias from a different season is never used as a numeric season fallback', async t => {
  const { api } = await setup(t, [new Error('offline')], { f1_current_driver_standings: cache(standingsResponse([standing()], '2025')) });
  await assert.rejects(api.fetchCurrentDriverStandings(2026));
});
test('a wrong-season numeric cache entry is rejected even when it is fresh', async t => {
  const { api } = await setup(t, [new Error('offline')], { f1_driver_standings_2026: JSON.stringify({ data: standingsResponse([standing()], '2025'), timestamp: NOW - 1 }) });
  await assert.rejects(api.fetchCurrentDriverStandings(2026));
});
test('new valid values replace the season-specific snapshot when the API becomes available', async t => {
  const { api, map, calls } = await setup(t, [standingsResponse([standing('norris', '1', '120', '3')])], { f1_driver_standings_2026: cache(standingsResponse()) });
  const value = await api.fetchCurrentDriverStandings(2026);
  assert.equal(value.items[0].points, 120); assert.equal(value.items[0].wins, 3); assert.equal(value.timestamp, NOW);
  assert.match(calls[0], /\/2026\/driverStandings/); assert.ok(map.has('f1_driver_standings_2026'));
});
test('published results cannot be erased by a valid-looking empty same-season response', async t => {
  const saved = cache(racesResponse([result()], '2026', true));
  const { api, map } = await setup(t, [racesResponse([], '2026', true)], { f1_winners_2026: saved });
  const value = await api.fetchSeasonWinners(2026);
  assert.equal(value.stale, true); assert.equal(value.items.length, 1); assert.equal(map.get('f1_winners_2026'), saved);
});
test('valid empty upcoming seasons do not require fake drivers, rounds or start times', async t => {
  const { api } = await setup(t, [racesResponse([], '2027')]);
  const value = await api.fetchScheduleBySeason(2027);
  assert.equal(value.season, 2027); assert.deepEqual(value.items, []); assert.equal(value.complete, true);
});
test('unsupported historical standings endpoint is replaced by the reviewed permanent champion archive', async t => {
  const { api, calls } = await setup(t, [new Error('offline')]);
  const value = await api.fetchAllTimeChampions();
  assert.deepEqual(value.items, CHAMPIONS_HISTORY); assert.equal(value.throughSeason, 2025);
  assert.equal(value.timestamp, Date.parse(CHAMPIONS_VERIFIED_AT)); assert.equal(calls.length, 0);
});
test('race results retain the existing public array shape and reject an incorrect requested round', async t => {
  const { api } = await setup(t, [racesResponse([result()], '2026', true), racesResponse([result()], '2026', true)]);
  assert.equal((await api.fetchRaceResults(2026, 1)).items[0].Driver.driverId, 'norris');
  await assert.rejects(api.fetchRaceResults(2026, 2));
});
test('invalid season and round parameters never dispatch network requests', async t => {
  const { api, calls } = await setup(t, []);
  await assert.rejects(api.fetchScheduleBySeason('../current'));
  assert.throws(() => api.fetchRaceResults(2026, '0'));
  assert.equal(calls.length, 0);
});

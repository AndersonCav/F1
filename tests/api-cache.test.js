import test from 'node:test';
import assert from 'node:assert/strict';

const URL_API = 'https://api.jolpi.ca/ergast/f1/current/races.json';
const KEY = 'f1_current_schedule';
const DATA = { MRData: { RaceTable: { Races: [] } } };
const NOW = 1800000000000;
let serial = 0;
function storage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return { get length() { return entries.size; }, key: i => [...entries.keys()][i],
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
async function setup(t, { initial = {}, network = async () => Response.json(DATA), unavailable = false } = {}) {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousFetch = globalThis.fetch;
  const local = storage(initial);
  const calls = [];
  Object.defineProperty(globalThis, 'localStorage', unavailable
    ? { configurable: true, get() { throw new Error('denied'); } }
    : { configurable: true, value: local });
  globalThis.fetch = async (...args) => { calls.push(args); return network(...args); };
  t.mock.method(Date, 'now', () => NOW);
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
    globalThis.fetch = previousFetch;
  });
  const api = await import(`../assets/js/api.js?case=${serial++}`);
  return { ...api, local, calls };
}
const record = timestamp => JSON.stringify({ data: DATA, timestamp });

test('fresh data uses its original timestamp and never performs a request', async t => {
  const api = await setup(t, { initial: { [KEY]: record(NOW - 1000) } });
  const result = await api.fetchWithCache(URL_API, KEY);
  assert.equal(result.timestamp, NOW - 1000);
  assert.equal(result.stale, false);
  assert.equal(api.calls.length, 0);
});

test('TTL boundary expires; successful network validation sets one accurate timestamp', async t => {
  const api = await setup(t, { initial: { [KEY]: record(NOW - 3600000) } });
  const result = await api.fetchWithCache(URL_API, KEY);
  assert.equal(result.timestamp, NOW);
  assert.equal(result.source, 'network');
  assert.equal(api.calls[0][1].cache, 'no-store');
  assert.ok(api.calls[0][1].signal instanceof AbortSignal);
  assert.equal(JSON.parse(api.local.getItem(KEY)).timestamp, result.timestamp);
});

for (const status of [404, 429, 500]) {
  test(`HTTP ${status} refresh preserves last good data and never renews freshness`, async t => {
    const previous = record(NOW - 3600001);
    const api = await setup(t, { initial: { [KEY]: previous }, network: async () => Response.json({ error: true }, { status }) });
    const result = await api.fetchWithCache(URL_API, KEY);
    assert.equal(result.stale, true);
    assert.equal(result.timestamp, NOW - 3600001);
    assert.equal(api.local.getItem(KEY), previous);
  });
  test(`HTTP ${status} without fallback rejects without writing data`, async t => {
    const api = await setup(t, { network: async () => Response.json({}, { status }) });
    await assert.rejects(api.fetchWithCache(URL_API, KEY));
    assert.equal(api.local.getItem(KEY), null);
  });
}

test('network failure returns bounded stale data; forced refresh also preserves a fresh fallback', async t => {
  const api = await setup(t, { initial: { [KEY]: record(NOW - 1000) }, network: async () => { throw new TypeError('offline'); } });
  const result = await api.fetchWithCache(URL_API, KEY, 60, { forceRefresh: true });
  assert.equal(result.stale, true);
  assert.equal(result.timestamp, NOW - 1000);
  assert.equal(api.calls.length, 1);
  assert.equal(api.local.getItem(KEY), record(NOW - 1000));
});

for (const timestamp of [NOW - 7 * 86400000 - 1, NOW + 1]) {
  test(`invalid/out-of-retention timestamp ${timestamp} cannot become offline data`, async t => {
    const api = await setup(t, { initial: { [KEY]: record(timestamp) }, network: async () => { throw new Error('offline'); } });
    await assert.rejects(api.fetchWithCache(URL_API, KEY));
  });
}

for (const response of [() => new Response('<html>error</html>'), () => Response.json({}), () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } })]) {
  test('invalid API content never overwrites a valid cached record', async t => {
    const previous = record(NOW - 3600001);
    const api = await setup(t, { initial: { [KEY]: previous }, network: async () => response() });
    assert.equal((await api.fetchWithCache(URL_API, KEY)).stale, true);
    assert.equal(api.local.getItem(KEY), previous);
  });
}

test('localStorage denial falls back to memory and deduplicates concurrent requests', async t => {
  const api = await setup(t, { unavailable: true });
  await Promise.all([api.fetchWithCache(URL_API, KEY), api.fetchWithCache(URL_API, KEY)]);
  assert.equal((await api.fetchWithCache(URL_API, KEY)).source, 'cache');
  assert.equal(api.calls.length, 1);
});

test('refresh marker is consumed once, preserving filters without requiring storage', async t => {
  const api = await setup(t);
  const location = { href: 'https://example.test/F1/drivers.html?sort=name&f1-refresh=1#main' };
  const history = { state: { x: 1 }, replaceState(state, title, href) { location.href = href; } };
  assert.equal(api.consumeRefreshRequest(location, history), true);
  assert.equal(location.href, 'https://example.test/F1/drivers.html?sort=name#main');
  assert.equal(api.consumeRefreshRequest(location, history), false);
});

test('retention pruning bounds API entries and preserves unrelated and preference keys', async t => {
  const initial = { other_project: 'keep', f1_preferences: 'keep' };
  for (let year = 1900; year < 1970; year++) initial[`f1_schedule_${year}`] = record(NOW - 1000 - year);
  initial.f1_results_2000_1 = record(NOW - 8 * 86400000);
  const api = await setup(t, { initial });
  await api.fetchWithCache(URL_API, KEY);
  assert.equal(api.local.length, 66);
  assert.equal(api.local.getItem('other_project'), 'keep');
  assert.equal(api.local.getItem('f1_preferences'), 'keep');
  assert.equal(api.local.getItem('f1_results_2000_1'), null);
});

test('public array API carries stale metadata through to the UI', async t => {
  const api = await setup(t, { initial: { [KEY]: record(NOW - 3600001) }, network: async () => { throw new Error('offline'); } });
  const result = await api.fetchCurrentSchedule();
  assert.deepEqual(result.items, []);
  assert.equal(result.stale, true);
  assert.equal(result.timestamp, NOW - 3600001);
});

test('malformed endpoint arrays cannot overwrite good data or reach rendering code', async t => {
  const previous = record(NOW - 3600001);
  const api = await setup(t, { initial: { [KEY]: previous },
    network: async () => Response.json({ MRData: { RaceTable: { Races: { error: 'unavailable' } } } }) });
  const result = await api.fetchCurrentSchedule();
  assert.deepEqual(result.items, []);
  assert.equal(result.stale, true);
  assert.equal(api.local.getItem(KEY), previous);
});

test('corrupt cached endpoint arrays are ignored and replaced by valid network data', async t => {
  const api = await setup(t, { initial: { [KEY]: JSON.stringify({ timestamp: NOW - 100, data: { MRData: { RaceTable: { Races: 'invalid' } } } }) } });
  const result = await api.fetchCurrentSchedule();
  assert.deepEqual(result.items, []);
  assert.equal(result.source, 'network');
});

test('malformed intermediate collections are ignored safely, while empty seasons remain valid', async t => {
  const data = { MRData: { StandingsTable: { StandingsLists: [] } } };
  const api = await setup(t, { initial: { f1_current_driver_standings: JSON.stringify({ timestamp: NOW - 100,
    data: { MRData: { StandingsTable: { StandingsLists: ['invalid'] } } } }) }, network: async () => Response.json(data) });
  const result = await api.fetchCurrentDriverStandings();
  assert.deepEqual(result.items, []);
  assert.equal(result.source, 'network');
  assert.equal(api.calls.length, 1);
});

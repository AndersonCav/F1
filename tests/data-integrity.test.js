import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHAMPIONS_HISTORY } from '../assets/js/champion-history.js';
import { DRIVER_STATIC, TEAM_STATIC, getOfficialRaceName, getOfficialRaceName2026, formatRaceDate, toFlag, toFlagUrl, PLACEHOLDER_DRIVER_IMAGE } from '../assets/js/static-data.js';
import { CONSTRUCTOR_SNAPSHOTS } from '../assets/js/historical-snapshots.js';
import { numberOrNull, displayValue, decodeResponse, sortDrivers, filterDrivers, mapDriver, mapConstructor } from '../assets/js/data-model.js';
import { raceStart, raceStatus, raceKey, nextScheduledRace, seasonPhase, confirmedRaceKeys, resolveNextEvent, countdownText, seasonNumber } from '../assets/js/season.js';
import { driver, constructor, standing, race, result, standingsResponse, racesResponse } from './helpers/sporting-fixtures.js';

const read = async name => JSON.parse(await readFile(new URL(`../docs/phase-2/sources/${name}.json`, import.meta.url)));
const official = await read('official-hall-of-fame');
const winners = await read('gp-winners-through-2025');
const seasons = (await read('championship-seasons')).records;
const expectedIds = 'farina fangio ascari hawthorn jack_brabham phil_hill hill clark surtees hulme stewart rindt emerson_fittipaldi lauda hunt mario_andretti scheckter jones piquet keke_rosberg prost senna mansell michael_schumacher damon_hill villeneuve hakkinen alonso raikkonen hamilton button vettel rosberg max_verstappen norris'.split(' ');
function expandYears(value) {
  return value.split(',').flatMap(part => {
    const [first, last] = part.trim().split('-');
    const end = last ? Number(last.length === 2 ? first.slice(0, 2) + last : last) : Number(first);
    return Array.from({ length: end - Number(first) + 1 }, (_, i) => Number(first) + i);
  });
}
test('35 stable champion IDs match the independently fetched official Hall of Fame and cover 1950–2025 once', () => {
  assert.deepEqual(CHAMPIONS_HISTORY.map(c => c.id), expectedIds);
  assert.equal(official.length, 35);
  const years = CHAMPIONS_HISTORY.flatMap(c => c.titleYears).sort((a, b) => a - b);
  assert.deepEqual(years, Array.from({ length: 76 }, (_, i) => 1950 + i));
  assert.equal(new Set(CHAMPIONS_HISTORY.map(c => c.id)).size, 35);
});
for (const [index, champion] of CHAMPIONS_HISTORY.entries()) {
  test(`verified completed championships, nationality and Grand Prix wins: ${champion.id}`, () => {
    assert.deepEqual(champion.titleYears, expandYears(official[index].years));
    assert.equal(champion.source, official[index].url);
    assert.equal(champion.wins, winners.wins[champion.id]);
    assert.equal(champion.throughSeason, 2025);
    const winner = winners.races.flatMap(r => r.Results).find(r => r.Driver.driverId === champion.id);
    assert.equal(champion.nationalityCode, winner.Driver.nationality);
    assert.ok(champion.teams.length > 0);
  });
}
test('Farina 1950 and Norris 2025 are unique title holders; no 2026 leader is promoted', () => {
  assert.deepEqual(CHAMPIONS_HISTORY.find(c => c.id === 'farina').titleYears, [1950]);
  assert.deepEqual(CHAMPIONS_HISTORY.find(c => c.id === 'norris').titleYears, [2025]);
  assert.ok(CHAMPIONS_HISTORY.every(c => c.titleYears.every(y => y <= 2025)));
});
test('all 76 season champions, nationalities and championship constructors match the recorded final standings', () => {
  const brands = { alfa: 'Alfa Romeo', maserati: 'Maserati', mercedes: 'Mercedes', ferrari: 'Ferrari',
    'cooper-climax': 'Cooper', 'brabham-repco': 'Brabham', brabham: 'Brabham', brm: 'BRM', team_lotus: 'Lotus',
    'lotus-climax': 'Lotus', 'lotus-ford': 'Lotus', 'matra-ford': 'Matra', tyrrell: 'Tyrrell', mclaren: 'McLaren',
    'mclaren-ford': 'McLaren', williams: 'Williams', benetton: 'Benetton', renault: 'Renault', brawn: 'Brawn GP', red_bull: 'Red Bull' };
  assert.equal(seasons.length, 76);
  for (const champion of CHAMPIONS_HISTORY) {
    const records = seasons.filter(r => r.driverId === champion.id);
    assert.deepEqual(records.map(r => r.season), champion.titleYears);
    assert.ok(records.every(r => r.nationality === champion.nationalityCode));
    assert.deepEqual([...new Set(records.flatMap(r => r.constructors.map(c => {
      assert.ok(brands[c.constructorId], c.constructorId); return brands[c.constructorId];
    })))].sort(), [...champion.teams].sort());
  }
});
test('unverified driver sporting fields are absent from visual references', () => {
  for (const d of Object.values(DRIVER_STATIC)) {
    assert.equal(d.season, 2026);
    for (const key of ['poles', 'seasonStats', 'careerStats', 'number']) assert.equal(d[key], undefined);
  }
});
for (const value of [null, undefined, '', ' ', 'NaN', 'Infinity', '-1', '1e3', '4px', false, {}, [], [1]]) {
  test(`missing/malformed sporting number ${JSON.stringify(value)} stays unavailable`, () => assert.equal(numberOrNull(value), null));
}
test('zero and fractional championship points remain genuine numbers', () => {
  assert.equal(numberOrNull('0'), 0); assert.equal(numberOrNull('2.5'), 2.5);
  assert.equal(numberOrNull('2.5', true), null);
  assert.equal(displayValue(0), '0'); assert.equal(displayValue(null), 'Não disponível');
});
test('missing and unknown nationality never acquire an invented Belgian flag', () => {
  assert.equal(toFlagUrl(null), PLACEHOLDER_DRIVER_IMAGE);
  assert.equal(toFlagUrl('Unknown'), PLACEHOLDER_DRIVER_IMAGE);
  assert.match(toFlagUrl('Brazilian'), /\/BR\//);
});
test('all verified champion nationalities resolve to their country flag, including American and South African', () => {
  for (const champion of CHAMPIONS_HISTORY) assert.notEqual(toFlag(champion.nationalityCode), '🏁', champion.name);
  assert.equal(toFlag('American'), '🇺🇸'); assert.equal(toFlag('South African'), '🇿🇦');
});
const sorting = [
  { id: 'b', fullName: 'Bia', shortTeam: 'Zeta', fullTeam: 'Zeta', position: 2, points: 0, wins: 0, poles: 2 },
  { id: 'a', fullName: 'Álvaro', shortTeam: 'Alpha', fullTeam: 'Alpha', position: 1, points: 10, wins: 1, poles: null },
  { id: 'c', fullName: 'Caio', shortTeam: 'Alpha', fullTeam: 'Alpha', position: null, points: null, wins: null, poles: 0 }
];
for (const [mode, expected] of Object.entries({ standing: 'abc', name: 'abc', team: 'acb', points: 'abc', wins: 'abc', poles: 'bca' })) {
  test(`driver ${mode} sort uses the normalized fields and puts missing values last`, () => assert.equal(sortDrivers(sorting, mode).map(d => d.id).join(''), expected));
}
test('driver ties are deterministic by name then identity, regardless of input order', () => {
  const tied = sorting.map(d => ({ ...d, points: 10 }));
  assert.deepEqual(sortDrivers(tied, 'points'), sortDrivers([...tied].reverse(), 'points'));
  assert.deepEqual(sortDrivers([{ ...tied[0], id: 'z' }, { ...tied[0], id: 'a' }], 'points').map(d => d.id), ['a', 'z']);
});
test('accent-insensitive, trimmed name and team search composes with sorting', () => {
  assert.equal(filterDrivers(sorting, ' alvaro ')[0].id, 'a');
  assert.equal(filterDrivers(sorting, 'ZÉTA')[0].id, 'b');
  assert.equal(sortDrivers(filterDrivers(sorting, 'alpha'), 'team').map(d => d.id).join(''), 'ac');
});
test('season wins never inherit career poles or manual numbers; multiple teams are explicitly ambiguous', () => {
  const s = standing('norris', '1', '0', '0', [constructor('mclaren'), constructor('ferrari', 'Ferrari')]);
  const mapped = mapDriver(s, { ...driver(), permanentNumber: undefined }, { season: 2026, poles: 100, number: '1' }, 2026, TEAM_STATIC);
  assert.equal(mapped.wins, 0); assert.equal(mapped.poles, null); assert.equal(mapped.number, '4');
  assert.match(mapped.fullTeam, /McLaren.*Ferrari/); assert.match(mapped.association, /não confirmado/);
  assert.equal(mapped.teamLogo, null);
  assert.equal(mapDriver({ ...s, Driver: { ...driver(), permanentNumber: undefined } }, {}, {}, 2026).number, null);
});
test('replacement drivers remain season participants and a constructor change includes both associations', () => {
  const entries = [standing(), standing('reserve', '5', '1', '0'), standing('changed', '6', '1', '0', [constructor(), constructor('ferrari', 'Ferrari')])];
  const team = mapConstructor({ Constructor: constructor(), points: '100', position: '1', wins: '2' }, entries, TEAM_STATIC.mclaren, CONSTRUCTOR_SNAPSHOTS.mclaren, 2026);
  assert.equal(team.drivers.length, 3); assert.equal(team.wins, 2); assert.equal(team.historicWins, 203); assert.equal(team.championships, 10);
});
test('a constructor change selects that constructor colour instead of the driver previous-team colour', () => {
  const mapped = mapDriver(standing('norris', '1', '10', '1', [constructor('ferrari', 'Ferrari')]), driver(),
    { season: 2026, teamColor: '#ff8000' }, 2026, TEAM_STATIC);
  assert.equal(mapped.teamColor, '#e10600'); assert.equal(mapped.teamLogo, TEAM_STATIC.ferrari.logo);
});
test('constructor snapshots never inherit predecessor organisations or future metadata', () => {
  assert.deepEqual([CONSTRUCTOR_SNAPSHOTS.alpine.wins, CONSTRUCTOR_SNAPSHOTS.alpine.titles], [1, 0]);
  assert.equal(CONSTRUCTOR_SNAPSHOTS.rb.wins, 0); assert.equal(CONSTRUCTOR_SNAPSHOTS.aston_martin.wins, 0);
  assert.equal(CONSTRUCTOR_SNAPSHOTS.red_bull.titles, 6);
  assert.equal(CONSTRUCTOR_SNAPSHOTS.audi, undefined);
  const mapped = mapConstructor({ Constructor: constructor('audi', 'Audi'), position: '2' }, [], TEAM_STATIC.audi, undefined, 2027);
  assert.equal(mapped.name, 'Audi'); assert.equal(mapped.principal, undefined); assert.equal(mapped.points, null); assert.equal(mapped.historicWins, null);
});
test('constructor reference fields equal the separately fetched F1 profile snapshots', async () => {
  const references = await read('constructor-metadata-2026');
  for (const [id, ref] of Object.entries(references)) for (const key of Object.keys(ref)) assert.deepEqual(TEAM_STATIC[id][key], ref[key]);
  assert.equal(TEAM_STATIC.audi.principal, 'Mattia Binotto');
});
test('season names preserve neutral API event identity in 2026, 2027 and historical seasons', () => {
  for (const year of [1950, 2025, 2026, 2027]) assert.equal(getOfficialRaceName('British Grand Prix', year), 'British Grand Prix');
  assert.equal(getOfficialRaceName2026('British Grand Prix'), 'British Grand Prix');
});
const start = Date.parse('2026-03-08T04:00:00Z');
for (const [offset, expected] of [[-1, 'scheduled'], [0, 'result_pending'], [1, 'result_pending'], [86400000, 'result_pending']]) {
  test(`race status at start ${offset}ms requires results to complete`, () => assert.equal(raceStatus(race(), new Set(), start + offset), expected));
}
test('only matching, published, season-and-round-specific results confirm completion', () => {
  assert.equal(raceStatus(race(), confirmedRaceKeys([race()], [result()], start + 1), start + 1), 'completed');
  for (const bad of [result('2'), result('1', { season: '2025' }), result('1', { date: '2026-03-09' }), result('1', { Results: [] })]) assert.equal(confirmedRaceKeys([race()], [bad], start + 1).size, 0);
  assert.equal(confirmedRaceKeys([race()], [result()], start - 1).size, 0);
});
for (const patch of [{ date: 'broken' }, { date: '2026-02-30' }, { time: '25:00:00Z' }, { time: '04:00:00' }, { time: undefined }]) {
  test(`unknown race instant ${JSON.stringify(patch)} never invents noon or a live status`, () => {
    assert.equal(raceStart(race('1', patch)), null);
    assert.ok(['status_unknown', 'scheduled'].includes(raceStatus(race('1', patch), new Set(), start)));
  });
}
test('UTC ordering and date-only display do not depend on the browser timezone', () => {
  assert.equal(raceStart(race()), start);
  assert.match(formatRaceDate('2026-03-08'), /8.*março.*2026.*horário não informado/);
  assert.equal(formatRaceDate('2026-02-30'), 'Data não informada');
  assert.equal(nextScheduledRace([race('2', { date: '2026-03-09' }), race()], new Set(), start - 1).round, '1');
});
test('countdown stops at the scheduled instant, never goes negative or claims live telemetry', () => {
  assert.equal(countdownText(null), 'Horário de largada não informado');
  assert.match(countdownText(start, start - 1000), /01s$/);
  assert.match(countdownText(start, start), /aguardando resultado/);
  assert.match(countdownText(start, start + 86400000), /aguardando resultado/);
  assert.doesNotMatch(countdownText(start, start + 1), /LIVE|VIVO|-/);
});
test('active and upcoming seasons come from schedule evidence, not calendar-year rollover', () => {
  assert.equal(seasonPhase([race()], new Set(), start - 1), 'upcoming');
  assert.equal(seasonPhase([race()], new Set(), start + 1), 'active');
  assert.equal(seasonPhase([race()], new Set([raceKey(race())]), start + 1), 'completed');
  assert.equal(seasonNumber('current'), null); assert.equal(seasonNumber('2026'), 2026);
});
test('final start without results never triggers a fabricated next-season transition', async () => {
  const info = await resolveNextEvent({ items: [race()], season: 2026 }, new Set(), () => { throw new Error('must not request'); }, start + 1);
  assert.equal(info.race, null); assert.match(info.message, /aguardando resultados/);
});
for (const unavailable of ['empty', 'offline']) {
  test(`completed-season rollover handles ${unavailable} next-season schedule honestly`, async () => {
    const info = await resolveNextEvent({ items: [race()], season: 2026 }, new Set([raceKey(race())]), async year => {
      assert.equal(year, 2027); if (unavailable === 'offline') throw new Error('offline'); return { season: year, items: [] };
    }, Date.parse('2027-01-01T00:00:00Z'));
    assert.equal(info.race, null); assert.equal(info.isSeasonClosed, true); assert.match(info.message, /2027/);
  });
}
test('published next season is selected after confirmed final result, including date-only first event', async () => {
  const info = await resolveNextEvent({ items: [race()], season: 2026 }, new Set([raceKey(race())]), async () => ({ season: 2027,
    items: [race('1', { season: '2027', date: '2027-03-01', time: undefined })] }), Date.parse('2027-01-01T00:00:00Z'));
  assert.equal(info.race.season, '2027'); assert.equal(raceStart(info.race), null);
});
test('valid driver and constructor standings normalize optional values and preserve zero', () => {
  const raw = standing('norris', '1', '0'); delete raw.wins;
  const data = decodeResponse(standingsResponse([raw]), 'driver-standings', 2026);
  assert.equal(data.items[0].points, 0); assert.equal(data.items[0].wins, null); assert.equal(data.season, 2026);
  const team = decodeResponse(standingsResponse([{ position: '1', points: '10', wins: '1', Constructor: constructor() }], '2026', 'ConstructorStandings'), 'constructor-standings', 2026);
  assert.equal(team.items[0].points, 10);
});
const badStandings = [
  data => { delete data.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].Driver.driverId; },
  data => { data.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].Constructors = [{}]; },
  data => { data.MRData.StandingsTable.season = '2025'; },
  data => { data.MRData.StandingsTable.StandingsLists[0].season = '2025'; },
  data => { data.MRData.StandingsTable.StandingsLists[0].round = '0'; },
  data => { data.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].wins = '21'; },
  data => { const list = data.MRData.StandingsTable.StandingsLists[0].DriverStandings; list.push(structuredClone(list[0])); data.MRData.total = '2'; },
  data => { data.MRData.total = '22'; },
  data => { data.MRData.offset = '1'; }
];
badStandings.forEach((mutate, i) => test(`reject missing, conflicting or incomplete standings case ${i + 1}`, () => {
  const data = standingsResponse(); mutate(data); assert.throws(() => decodeResponse(data, 'driver-standings', 2026));
}));
test('equal points are valid; conflicting classification positions are not', () => {
  const data = standingsResponse([standing('norris', '1'), standing('piastri', '2')]);
  assert.equal(decodeResponse(data, 'driver-standings', 2026).items.length, 2);
  data.MRData.StandingsTable.StandingsLists[0].DriverStandings[1].position = '1';
  assert.throws(() => decodeResponse(data, 'driver-standings', 2026));
});
test('malformed optional statistics normalize to unavailable, never zero', () => {
  const data = standingsResponse([standing('norris', 'bad', '??', '-1')]);
  const entry = decodeResponse(data, 'driver-standings', 2026).items[0];
  assert.equal(entry.position, null); assert.equal(entry.points, null); assert.equal(entry.wins, null);
});
test('empty valid season is complete and remains associated with its requested year', () => {
  assert.deepEqual(decodeResponse(racesResponse([], '2027'), 'schedule', 2027), { items: [], season: 2027, round: null, complete: true });
});
for (const mutate of [r => { delete r.season; }, r => { r.round = '0'; }, r => { r.season = '2025'; }, r => { delete r.Circuit.circuitId; }]) {
  test('malformed required race identity cannot enter the cache', () => { const r = race(); mutate(r); assert.throws(() => decodeResponse(racesResponse([r]), 'schedule', 2026)); });
}
test('duplicate race rounds, mismatched requested rounds and truncated official results reject', () => {
  assert.throws(() => decodeResponse(racesResponse([race(), race()]), 'schedule', 2026));
  assert.throws(() => decodeResponse(racesResponse([result()], '2026', true), 'results', 2026, 2));
  const response = racesResponse([result()], '2026', true); response.MRData.total = '22';
  assert.throws(() => decodeResponse(response, 'results', 2026));
});
test('published result rows use actual finishing positions, including out-of-order responses', () => {
  const r = result('1', { Results: [3, 1, 2].map(position => ({ position: String(position), Driver: driver('driver_' + position) })) });
  assert.deepEqual(decodeResponse(racesResponse([r], '2026', true), 'results', 2026).items[0].Results.map(r => r.position), ['1', '2', '3']);
});

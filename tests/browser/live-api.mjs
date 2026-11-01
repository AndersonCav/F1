// Optional real network checks. Fixtures and ordinary unit tests do not depend on this service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchCurrentSchedule, fetchCurrentDriverStandings, fetchCurrentConstructorStandings, fetchSeasonWinners, fetchScheduleBySeason } from '../../assets/js/api.js';
import { confirmedRaceKeys } from '../../assets/js/season.js';

test('live Jolpica sporting endpoints and representative official historical results', { timeout: 90000 }, async t => {
  const report = { checkedAt: new Date().toISOString(), source: 'https://api.jolpi.ca/ergast/f1', checks: [] };
  t.after(async () => {
    await mkdir(new URL('../../docs/phase-2/validation/', import.meta.url), { recursive: true });
    await writeFile(new URL('../../docs/phase-2/validation/live-api.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  });
  const schedule = await fetchCurrentSchedule();
  await t.test('current alias supplies a concrete season and complete schedule', () => {
    assert.ok(schedule.season >= 2025); assert.equal(schedule.complete, true); assert.ok(schedule.items.length > 0);
    report.checks.push({ name: 'schedule', season: schedule.season, count: schedule.items.length, timestamp: schedule.timestamp });
  });
  await t.test('driver standings resolve the same explicit season, preserving all replacements and team changes', async () => {
    const data = await fetchCurrentDriverStandings(schedule.season);
    assert.equal(data.season, schedule.season); assert.ok(data.items.length >= 20);
    assert.ok(data.items.every(d => d.position === null || d.position > 0));
    report.checks.push({ name: 'drivers', season: data.season, round: data.round, count: data.items.length,
      multipleConstructors: data.items.filter(d => d.Constructors.length > 1).map(d => ({ id: d.Driver.driverId, constructors: d.Constructors })) });
  });
  await t.test('constructor standings and published winners remain season-scoped', async () => {
    const constructors = await fetchCurrentConstructorStandings(schedule.season);
    const winners = await fetchSeasonWinners(schedule.season);
    assert.equal(constructors.season, schedule.season); assert.equal(winners.season, schedule.season);
    const confirmed = confirmedRaceKeys(schedule.items, winners.items);
    assert.ok(constructors.items.length > 0); assert.ok(confirmed.size > 0);
    report.checks.push({ name: 'constructors and results', teams: constructors.items.length, published: winners.items.length, matchingConfirmed: confirmed.size });
  });
  await t.test('2025 Norris final points and wins match the official FIA classification', async () => {
    const data = await fetchCurrentDriverStandings(2025);
    const champion = data.items[0];
    assert.equal(champion.Driver.driverId, 'norris'); assert.equal(champion.points, 423); assert.equal(champion.wins, 7);
    report.checks.push({ name: '2025 drivers', id: champion.Driver.driverId, points: champion.points, gpWins: champion.wins,
      officialSource: 'https://www.fia.com/events/fia-formula-one-world-championship/season-2025/2025-classifications' });
  });
  await t.test('1950 Farina and 2025 McLaren historical winners are preserved independently of the active season', async () => {
    const drivers = await fetchCurrentDriverStandings(1950);
    const constructors = await fetchCurrentConstructorStandings(2025);
    assert.equal(drivers.items[0].Driver.driverId, 'farina'); assert.equal(drivers.items[0].wins, 3);
    assert.equal(constructors.items[0].Constructor.constructorId, 'mclaren'); assert.equal(constructors.items[0].wins, 14);
    report.checks.push({ name: 'historical winners', farina: drivers.items[0], mclaren: constructors.items[0] });
  });
  await t.test('next-season response is either a valid published schedule or an explicitly empty valid season', async () => {
    const next = await fetchScheduleBySeason(schedule.season + 1);
    assert.equal(next.season, schedule.season + 1); assert.equal(next.complete, true);
    report.checks.push({ name: 'next season', season: next.season, count: next.items.length });
  });
});

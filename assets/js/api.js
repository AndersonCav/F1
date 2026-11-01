import { decodeResponse } from './data-model.js';
import { seasonNumber } from './season.js';
import { CHAMPIONS_HISTORY, CHAMPIONS_VERIFIED_AT } from './champion-history.js';
const API_BASE = "https://api.jolpi.ca/ergast/f1";
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;
const API_CACHE_KEY = /^f1_(current_(driver_standings|constructor_standings|schedule)|last_results|drivers_(current|\d{4})|all_time_champions|schedule_\d{4}|results_\d{4}_\d+|(?:driver_standings|constructor_standings|last_results|winners)_\d{4})$/;
const memoryCache = new Map();
const pendingRequests = new Map();

// A one-navigation refresh marker also works when browser storage is disabled.
export function consumeRefreshRequest(location = globalThis.location, history = globalThis.history) {
  if (!location) return false;
  const url = new URL(location.href);
  if (url.searchParams.get("f1-refresh") !== "1") return false;
  url.searchParams.delete("f1-refresh");
  try { history?.replaceState(history.state, "", url.href); } catch { /* Refresh still works. */ }
  return true;
}
const refreshRequested = consumeRefreshRequest();

function validRecord(record) {
  const age = Date.now() - record?.timestamp;
  return record?.data && typeof record.data === "object" && Number.isFinite(record.timestamp)
    && age >= 0 && age <= MAX_CACHE_AGE;
}

function readCache(cacheKey) {
  let record = memoryCache.get(cacheKey);
  try {
    const stored = JSON.parse(localStorage.getItem(cacheKey));
    if (validRecord(stored) && (!validRecord(record) || stored.timestamp > record.timestamp)) {
      record = stored;
    }
  } catch { /* Memory remains usable in private mode or after a corrupt entry. */ }
  return validRecord(record) ? record : null;
}

function pruneCache(storage) {
  const entries = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (API_CACHE_KEY.test(key)) {
      let record;
      try { record = JSON.parse(storage.getItem(key)); } catch { /* Remove corrupt API data. */ }
      entries.push({ key, timestamp: validRecord(record) ? record.timestamp : 0 });
    }
  }
  entries.sort((a, b) => b.timestamp - a.timestamp);
  entries.forEach((entry, index) => {
    if (!entry.timestamp || index >= MAX_CACHE_ENTRIES) storage.removeItem(entry.key);
  });
}

function writeCache(cacheKey, record) {
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, record);
  for (const [key, value] of memoryCache) {
    if (!validRecord(value) || memoryCache.size > MAX_CACHE_ENTRIES) memoryCache.delete(key);
  }
  try {
    pruneCache(localStorage);
    localStorage.setItem(cacheKey, JSON.stringify(record));
    pruneCache(localStorage);
  } catch { /* Network results and memory cache remain available if persistence fails. */ }
}

export async function fetchWithCache(url, cacheKey, ttlMinutes = 60, {
  forceRefresh = refreshRequested, validate = () => true
} = {}) {
  if (!API_CACHE_KEY.test(cacheKey)) throw new Error("Chave de cache da API inválida.");
  const stored = readCache(cacheKey);
  const cached = stored && validate(stored.data) ? stored : null;
  if (cached && !forceRefresh && Date.now() - cached.timestamp < ttlMinutes * 60 * 1000) {
    return { ...cached, stale: false, source: "cache" };
  }
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const request = (async () => {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
      if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(response.headers.get("Content-Type") || "")) {
        throw new Error("Resposta da API não é JSON.");
      }
      const data = await response.json();
      if (!data || typeof data !== "object" || !data.MRData || typeof data.MRData !== "object" || !validate(data)) {
        throw new Error("Resposta da API inválida.");
      }
      const record = { data, timestamp: Date.now() };
      writeCache(cacheKey, record);
      return { ...record, stale: false, source: "network" };
    } catch (error) {
      // Do not renew timestamps or destroy the last valid data on a failed refresh.
      if (cached && validRecord(cached)) return { ...cached, stale: true, source: "cache" };
      throw error;
    }
  })();
  pendingRequests.set(cacheKey, request);
  try { return await request; }
  finally { pendingRequests.delete(cacheKey); }
}


async function sportingRequest(route, key, kind, season = null, round = null) {
  const expected = season === null ? null : seasonNumber(season);
  if (season !== null && expected === null) throw new Error('Temporada inválida.');
  let previous;
  try { previous = decodeResponse(readCache(key)?.data, kind, expected, round); } catch { /* No previously valid domain snapshot. */ }
  const result = await fetchWithCache(API_BASE + route, key, 60, { validate: data => {
    try {
      const next = decodeResponse(data, kind, expected, round);
      if (previous?.items.length && previous.season === next.season) {
        if (!next.items.length) return false;
        if (kind.includes('standings')) {
          if (next.round < previous.round) return false;
          if (next.round === previous.round) {
            const id = entry => entry.Driver?.driverId || entry.Constructor?.constructorId;
            const ids = new Set(next.items.map(id));
            if (previous.items.some(entry => !ids.has(id(entry)))) return false;
          }
        }
        if (kind === 'winners' && previous.items.some(race => !next.items.some(r => r.round === race.round))) return false;
        if (kind === 'results' && Math.max(...next.items.map(r => Number(r.round))) < Math.max(...previous.items.map(r => Number(r.round)))) return false;
      }
      return true;
    } catch { return false; }
  } });
  return { ...decodeResponse(result.data, kind, expected, round), timestamp: result.timestamp, stale: result.stale, source: result.source };
}
export function fetchCurrentDriverStandings(season = null) {
  return sportingRequest('/' + (season || 'current') + '/driverStandings.json?limit=100',
    season ? 'f1_driver_standings_' + season : 'f1_current_driver_standings', 'driver-standings', season);
}
export function fetchCurrentConstructorStandings(season = null) {
  return sportingRequest('/' + (season || 'current') + '/constructorStandings.json?limit=100',
    season ? 'f1_constructor_standings_' + season : 'f1_current_constructor_standings', 'constructor-standings', season);
}
export function fetchCurrentSchedule() {
  return sportingRequest('/current/races.json?limit=100', 'f1_current_schedule', 'schedule');
}
export function fetchCurrentResults(season = null) {
  return sportingRequest('/' + (season || 'current') + '/last/results.json?limit=100',
    season ? 'f1_last_results_' + season : 'f1_last_results', 'results', season);
}
export function fetchDrivers(season = null) {
  return sportingRequest('/' + (season || 'current') + '/drivers.json?limit=100', 'f1_drivers_' + (season || 'current'), 'drivers', season);
}
// The old cross-season standings endpoint is no longer supported by Jolpica.
// A reviewed, completed-season archive must survive API unavailability indefinitely.
export async function fetchAllTimeChampions() {
  return { items: CHAMPIONS_HISTORY, season: 2025, source: 'verified-snapshot', stale: false,
    timestamp: Date.parse(CHAMPIONS_VERIFIED_AT), throughSeason: 2025 };
}
export function fetchScheduleBySeason(season) {
  return sportingRequest('/' + season + '/races.json?limit=100', 'f1_schedule_' + season, 'schedule', season);
}
export function fetchRaceResults(season, round) {
  if (!/^[1-9]\d*$/.test(String(round))) throw new Error('Etapa inválida.');
  return sportingRequest('/' + season + '/' + round + '/results.json?limit=100', 'f1_results_' + season + '_' + round, 'results', season, round)
    .then(result => ({ ...result, races: result.items, items: result.items[0]?.Results || [] }));
}
export function fetchSeasonWinners(season) {
  return sportingRequest('/' + season + '/results/1.json?limit=100', 'f1_winners_' + season, 'winners', season);
}

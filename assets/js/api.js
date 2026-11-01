const API_BASE = "https://api.jolpi.ca/ergast/f1";
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;
const API_CACHE_KEY = /^f1_(current_(driver_standings|constructor_standings|schedule)|last_results|drivers_(current|\d{4})|all_time_champions|schedule_\d{4}|results_\d{4}_\d+)$/;
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

function getByPath(root, path, fallback) {
  let current = root;
  for (const key of path) {
    if (current == null || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  return current;
}

async function safeFetchArray(url, cacheKey, path) {
  try {
    const result = await fetchWithCache(url, cacheKey, 60, {
      validate: data => Array.isArray(data?.MRData?.[path[1]]?.[path[2]])
        && (data.MRData[path[1]][path[2]].length === 0 || Array.isArray(getByPath(data, path, null)))
    });
    return {
      items: getByPath(result.data, path, []),
      timestamp: result.timestamp,
      stale: result.stale,
      source: result.source
    };
  } catch (error) {
    throw new Error("Não foi possível carregar dados da API no momento.");
  }
}

export async function fetchCurrentDriverStandings() {
  try {
    return await safeFetchArray(
      `${API_BASE}/current/driverStandings.json`,
      "f1_current_driver_standings",
      ["MRData", "StandingsTable", "StandingsLists", 0, "DriverStandings"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar a classificacao de pilotos.");
  }
}

export async function fetchCurrentConstructorStandings() {
  try {
    return await safeFetchArray(
      `${API_BASE}/current/constructorStandings.json`,
      "f1_current_constructor_standings",
      ["MRData", "StandingsTable", "StandingsLists", 0, "ConstructorStandings"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar a classificacao de construtores.");
  }
}

export async function fetchCurrentSchedule() {
  try {
    return await safeFetchArray(
      `${API_BASE}/current/races.json?limit=30`,
      "f1_current_schedule",
      ["MRData", "RaceTable", "Races"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar o calendario da temporada.");
  }
}

export async function fetchCurrentResults() {
  try {
    return await safeFetchArray(
      `${API_BASE}/current/last/results.json`,
      "f1_last_results",
      ["MRData", "RaceTable", "Races"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar os resultados recentes.");
  }
}

export async function fetchDrivers(season) {
  const year = season || "current";
  try {
    return await safeFetchArray(
      `${API_BASE}/${year}/drivers.json`,
      `f1_drivers_${year}`,
      ["MRData", "DriverTable", "Drivers"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar os pilotos da temporada.");
  }
}

export async function fetchAllTimeChampions() {
  try {
    return await safeFetchArray(
      `${API_BASE}/driverStandings/1.json?limit=100`,
      "f1_all_time_champions",
      ["MRData", "StandingsTable", "StandingsLists"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar os campeoes historicos da API.");
  }
}

export async function fetchScheduleBySeason(season) {
  try {
    return await safeFetchArray(
      `${API_BASE}/${season}/races.json?limit=30`,
      `f1_schedule_${season}`,
      ["MRData", "RaceTable", "Races"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar o calendario da temporada solicitada.");
  }
}
export async function fetchRaceResults(season, round) {
  try {
    return await safeFetchArray(
      `${API_BASE}/${season}/${round}/results.json`,
      `f1_results_${season}_${round}`,
      ["MRData", "RaceTable", "Races", 0, "Results"]
    );
  } catch {
    throw new Error("Nao foi possivel carregar os resultados da corrida.");
  }
}

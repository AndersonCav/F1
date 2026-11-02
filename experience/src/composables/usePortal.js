import { shallowReactive, computed, ref } from "vue";
import * as api from "../../../assets/js/api.js";
import { seasonNumber } from "../../../assets/js/season.js";
import {
  normalizeResource,
  driversFrom,
  constructorsFrom,
  calendarFrom,
} from "../adapters/portal.js";

const blank = (status = "idle") => ({ status, items: [], season: null });
export function createPortal(source = api) {
  // Validated resources are immutable snapshots, replaced atomically after loading.
  // Deep proxies over race/result archives add work without enabling any interaction.
  const state = shallowReactive({
    loading: false,
    season: null,
    currentSeason: null,
    error: null,
    schedule: blank(),
    driverStandings: blank(),
    constructorStandings: blank(),
    last: blank(),
    winners: blank(),
  });
  let generation = 0;
  let pending = null;
  const now = ref(Date.now());
  const updateClock = () => {
    now.value = Date.now();
  };
  async function load(season = null) {
    if (state.loading && season === state.season && pending) return pending;
    const token = ++generation;
    state.loading = true;
    state.error = null;
    for (const key of [
      "schedule",
      "driverStandings",
      "constructorStandings",
      "last",
      "winners",
    ])
      state[key] = blank("loading");
    state.season = season;
    pending = (async () => {
      try {
        const schedule = await (season
          ? source.fetchScheduleBySeason(season)
          : source.fetchCurrentSchedule());
        const actual = seasonNumber(schedule.season);
        if (!actual || (season && actual !== Number(season)))
          throw new Error("Temporada inválida.");
        if (token !== generation) return;
        if (!season) state.currentSeason = actual;
        state.season = actual;
        state.schedule = normalizeResource(
          { status: "fulfilled", value: schedule },
          actual,
        );
        const keys = [
          "driverStandings",
          "constructorStandings",
          "last",
          "winners",
        ];
        const results = await Promise.allSettled([
          source.fetchCurrentDriverStandings(actual),
          source.fetchCurrentConstructorStandings(actual),
          source.fetchCurrentResults(actual),
          source.fetchSeasonWinners(actual),
        ]);
        if (token !== generation) return;
        keys.forEach((key, i) => {
          state[key] = normalizeResource(results[i], actual);
        });
      } catch {
        if (token !== generation) return;
        state.error =
          "Não foi possível obter a temporada. Verifique a conexão e tente novamente.";
        for (const key of [
          "schedule",
          "driverStandings",
          "constructorStandings",
          "last",
          "winners",
        ])
          state[key] = { ...blank("error"), error: state.error };
      } finally {
        if (token === generation) state.loading = false;
      }
    })();
    return pending;
  }
  const drivers = computed(() => driversFrom(state.driverStandings));
  const constructors = computed(() =>
    constructorsFrom(state.constructorStandings, state.driverStandings),
  );
  const races = computed(() =>
    calendarFrom(
      state.schedule,
      [...state.winners.items, ...state.last.items].filter(
        (r, i, list) =>
          list.findIndex(
            (m) => `${m.season}:${m.round}` === `${r.season}:${r.round}`,
          ) === i,
      ),
      now.value,
    ),
  );
  const freshness = computed(() => {
    const resources = [
      state.schedule,
      state.driverStandings,
      state.constructorStandings,
      state.last,
      state.winners,
    ];
    const valid = resources.filter((r) => Number.isFinite(r.timestamp));
    return {
      timestamp: valid.length
        ? Math.min(...valid.map((r) => r.timestamp))
        : null,
      stale: valid.some((r) => r.stale),
      cached: valid.some((r) => r.source === "cache"),
      partial: resources.some((r) => r.status === "error"),
    };
  });
  return { state, load, drivers, constructors, races, freshness, updateClock };
}
export const portal = createPortal();

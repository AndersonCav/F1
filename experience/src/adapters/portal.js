import {
  mapDriver,
  mapConstructor,
  normalizeSearch,
  compareNumber,
  numberOrNull,
} from "../../../assets/js/data-model.js";
import { DRIVER_STATIC } from "../../../assets/js/driver-metadata.js";
import { TEAM_STATIC } from "../../../assets/js/constructor-metadata.js";
import { CONSTRUCTOR_SNAPSHOTS } from "../../../assets/js/historical-snapshots.js";
import {
  confirmedRaceKeys,
  raceStatus,
  nextScheduledRace,
  raceStart,
  raceKey,
  seasonNumber,
  formatEventDate,
} from "../../../assets/js/season.js";

export { normalizeSearch, compareNumber, raceStart, raceKey, formatEventDate };
const own = (object, key) =>
  Object.hasOwn(object, key) ? object[key] : undefined;
export const unavailable = (value) =>
  value === null || value === undefined || value === ""
    ? "Não disponível"
    : String(value);
export const safeColor = (value) =>
  /^#[\da-f]{6}$/i.test(value || "") ? value : "#a8adb8";
const imageHosts = new Set([
  "media.formula1.com",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
]);
export function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      imageHosts.has(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function normalizeResource(result, season) {
  if (result.status === "rejected")
    return {
      status: "error",
      items: [],
      season,
      error: "A fonte não respondeu com dados válidos. Tente novamente.",
    };
  const value = result.value;
  if (
    !value ||
    !Array.isArray(value.items) ||
    seasonNumber(value.season) !== seasonNumber(season) ||
    seasonNumber(season) === null
  ) {
    return {
      status: "error",
      items: [],
      season,
      error: "A referência de temporada não corresponde à seleção.",
    };
  }
  return {
    ...value,
    status: value.items.length ? "ready" : "empty",
    error: null,
  };
}
export function driversFrom(resource) {
  return resource.items.map((entry) => {
    // Preserve the legacy lookup: Jolpica short IDs and verified photo keys differ.
    const key = (value) =>
      normalizeSearch(value)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    const reference = [
      key(entry.Driver.driverId),
      key(`${entry.Driver.givenName}_${entry.Driver.familyName}`),
    ]
      .map((id) => own(DRIVER_STATIC, id))
      .find((ref) => ref?.season === resource.season);
    const model = mapDriver(
      entry,
      null,
      reference,
      resource.season,
      TEAM_STATIC,
    );
    return {
      ...model,
      photo: safeImage(model.photo),
      teamColor: safeColor(model.teamColor),
      constructorIds: entry.Constructors.map((c) => c.constructorId),
    };
  });
}
export function normalizeRaceResource(result, race, now = Date.now()) {
  const resource = normalizeResource(result, Number(race.season));
  if (
    resource.status === "ready" &&
    !confirmedRaceKeys([race], resource.races || [], now).has(raceKey(race))
  ) {
    return {
      status: "error",
      items: [],
      season: Number(race.season),
      error:
        "O resultado não corresponde a um evento confirmado deste calendário.",
    };
  }
  return resource;
}
export function constructorsFrom(resource, driverResource) {
  return resource.items.map((entry) => {
    const id = entry.Constructor.constructorId;
    const model = mapConstructor(
      entry,
      driverResource.season === resource.season ? driverResource.items : [],
      own(TEAM_STATIC, id),
      resource.season >= 2025 ? own(CONSTRUCTOR_SNAPSHOTS, id) : null,
      resource.season,
    );
    return {
      ...model,
      color: safeColor(model.color),
      carImage: safeImage(model.carImage)?.replace("w_3392", "w_960"),
      participants:
        driverResource.season === resource.season
          ? driverResource.items
              .filter((d) => d.Constructors.some((c) => c.constructorId === id))
              .map((d) => ({
                id: d.Driver.driverId,
                name: `${d.Driver.givenName} ${d.Driver.familyName}`,
              }))
          : [],
    };
  });
}
export function calendarFrom(schedule, results, now = Date.now()) {
  const matching = results.filter((r) => Number(r.season) === schedule.season);
  const confirmed = confirmedRaceKeys(schedule.items, matching, now);
  const next = nextScheduledRace(schedule.items, confirmed, now);
  return schedule.items.map((r) => ({
    ...r,
    status: raceStatus(r, confirmed, now, r === next),
    isNext: r === next,
    result: confirmed.has(raceKey(r))
      ? matching.find((m) => raceKey(m) === raceKey(r))
      : null,
  }));
}
export function comparisonFrom(a, b, champions = []) {
  if (!a || !b || a.id === b.id || a.season !== b.season) return null;
  const titles = (d) =>
    champions.length
      ? (champions.find((c) => c.id === d.id)?.titleYears.length ?? 0)
      : null;
  return {
    season: a.season,
    drivers: [a, b],
    metrics: [
      {
        label: "Pontos na temporada",
        values: [a.points, b.points],
        unit: "pts",
        higher: true,
      },
      {
        label: "Vitórias na temporada",
        values: [a.wins, b.wins],
        unit: "vitórias",
        higher: true,
      },
      {
        label: "Posição no campeonato",
        values: [a.position, b.position],
        unit: "posição",
        higher: false,
      },
      {
        label: "Títulos mundiais · arquivo até 2025",
        values: [titles(a), titles(b)],
        unit: "títulos",
        higher: true,
      },
    ],
  };
}
// Providers have explicit namespaces. No OpenF1/F1DB identifier coercion or guessed telemetry.
export const providerContracts = Object.freeze({
  jolpica: {
    namespace: "jolpica",
    available: ["schedule", "standings", "race-results"],
  },
  openf1: {
    namespace: "openf1",
    available: [],
    reason: "Telemetria ainda não integrada.",
  },
  f1db: {
    namespace: "f1db",
    available: [],
    reason: "Mapeamento de identidades ainda não integrado.",
  },
});
export function resultRows(race) {
  return (race?.Results || []).map((r) => ({
    id: r.Driver.driverId,
    name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    team: r.Constructor?.name || "Não disponível",
    position: numberOrNull(r.position, true),
    points: numberOrNull(r.points),
    laps: numberOrNull(r.laps, true),
    time: r.Time?.time || r.status || "Não disponível",
  }));
}

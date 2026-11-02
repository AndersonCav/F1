import { describe, it, expect } from "vitest";
import recording from "./fixtures/jolpica-recording.json";
import { decodeResponse } from "../../assets/js/data-model.js";
import { CHAMPIONS_HISTORY } from "../../assets/js/champion-history.js";
import { DRIVER_STATIC } from "../../assets/js/driver-metadata.js";
import {
  normalizeResource,
  normalizeRaceResource,
  driversFrom,
  constructorsFrom,
  calendarFrom,
  comparisonFrom,
  safeImage,
  safeLink,
  safeColor,
  resultRows,
} from "../src/adapters/portal.js";
const snapshot = (route, kind, year = 2026) => ({
  ...decodeResponse(structuredClone(recording.responses[route]), kind, year),
  timestamp: 123456789,
  source: "cache",
  stale: true,
});
const drivers = () =>
  snapshot("2026/driverStandings.json?limit=100", "driver-standings");
const teams = () =>
  snapshot("2026/constructorStandings.json?limit=100", "constructor-standings");
const schedule = () => snapshot("current/races.json?limit=100", "schedule");
describe("presentation adapters preserve validated domain rules", () => {
  it("resolves verified portraits whose catalog keys differ from Jolpica IDs", () => {
    const ds = driversFrom(drivers());
    expect(ds.find((d) => d.id === "hamilton").photo).toBe(
      DRIVER_STATIC.lewis_hamilton.photo,
    );
    expect(ds.find((d) => d.id === "norris").photo).toBe(
      DRIVER_STATIC.lando_norris.photo,
    );
  });
  function raceResource() {
    const decoded = snapshot("2026/last/results.json?limit=100", "results");
    return {
      ...decoded,
      races: decoded.items,
      items: decoded.items[0].Results,
    };
  }
  it("accepts full results only for a matching confirmed calendar event", () => {
    const race = schedule().items.find((r) => r.round === "19");
    expect(
      normalizeRaceResource(
        { status: "fulfilled", value: raceResource() },
        race,
        Date.parse("2026-11-02"),
      ).items,
    ).toHaveLength(22);
  });
  it("rejects mismatched result circuit, date and round instead of displaying them", () => {
    const race = schedule().items.find((r) => r.round === "19");
    for (const change of [
      (r) => {
        r.Circuit.circuitId = "wrong";
      },
      (r) => {
        r.date = "2026-01-01";
      },
      (r) => {
        r.round = "18";
      },
    ]) {
      const value = structuredClone(raceResource());
      change(value.races[0]);
      expect(
        normalizeRaceResource(
          { status: "fulfilled", value },
          race,
          Date.parse("2026-11-02"),
        ).status,
      ).toBe("error");
    }
  });
  it("rejects results for an event whose scheduled start is still in the future", () => {
    const value = structuredClone(raceResource());
    value.races[0].date = "2099-11-01";
    const race = { ...value.races[0] };
    expect(
      normalizeRaceResource(
        { status: "fulfilled", value },
        race,
        Date.parse("2026-11-02"),
      ).status,
    ).toBe("error");
  });
  it("normalizes success without renewing cache timestamps", () => {
    const r = normalizeResource(
      { status: "fulfilled", value: drivers() },
      2026,
    );
    expect(r.status).toBe("ready");
    expect(r.source).toBe("cache");
    expect(r.stale).toBe(true);
    expect(r.timestamp).toBe(123456789);
  });
  it("represents a valid empty response", () =>
    expect(
      normalizeResource(
        { status: "fulfilled", value: { season: 2026, items: [] } },
        2026,
      ).status,
    ).toBe("empty"));
  it("separates a provider failure from empty data", () =>
    expect(
      normalizeResource({ status: "rejected", reason: Error("network") }, 2026)
        .status,
    ).toBe("error"));
  it("rejects mismatched reference seasons", () =>
    expect(
      normalizeResource({ status: "fulfilled", value: drivers() }, 2025).status,
    ).toBe("error"));
  it("rejects missing and malformed result envelopes", () => {
    for (const value of [undefined, {}, { season: 2026, items: null }])
      expect(
        normalizeResource({ status: "fulfilled", value }, 2026).status,
      ).toBe("error");
  });
  it("rejects a malformed source identifier before presentation", () => {
    const raw = structuredClone(
      recording.responses["2026/driverStandings.json?limit=100"],
    );
    raw.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].Driver.driverId =
      "../bad";
    expect(() => decodeResponse(raw, "driver-standings", 2026)).toThrow();
  });
  it("keeps missing optional points as null, not zero", () => {
    const r = drivers();
    r.items[0].points = null;
    expect(driversFrom(r)[0].points).toBeNull();
  });
  it("never generates poles", () =>
    expect(driversFrom(drivers()).every((d) => d.poles === null)).toBe(true));
  it("does not borrow current-season portraits for historical drivers", () => {
    const r = snapshot(
      "2025/driverStandings.json?limit=100",
      "driver-standings",
      2025,
    );
    expect(driversFrom(r).every((d) => d.photo === null)).toBe(true);
  });
  it("preserves replacements and multiple constructor associations", () => {
    const r = drivers();
    r.items[0].Constructors = [
      r.items[0].Constructors[0],
      { constructorId: "ferrari", name: "Ferrari" },
    ];
    const d = driversFrom(r)[0];
    expect(d.constructorIds).toHaveLength(2);
    expect(d.association).toContain("vínculo atual não confirmado");
    expect(d.teamLogo).toBeNull();
  });
  it("associates season participants using identifiers", () => {
    const cs = constructorsFrom(teams(), drivers());
    expect(cs[0].participants.map((d) => d.id)).toContain("antonelli");
    expect(cs[0].snapshotSeason).toBe(2025);
  });
  it("does not combine a constructor with driver standings from another season", () => {
    const ds = drivers();
    ds.season = 2025;
    expect(constructorsFrom(teams(), ds)[0].participants).toEqual([]);
  });
  it("does not inherit historical titles into unknown constructors", () => {
    const cs = teams();
    cs.items[0].Constructor.constructorId = "unknown";
    const c = constructorsFrom(cs, drivers())[0];
    expect(c.championships).toBeNull();
    expect(c.color).toBe("#a8adb8");
  });
  it("cannot confirm a race from the clock alone", () => {
    const races = calendarFrom(
      schedule(),
      [],
      Date.parse("2026-11-02T12:00:00Z"),
    );
    expect(races.filter((r) => r.status === "completed")).toHaveLength(0);
    expect(races[0].status).toBe("result_pending");
  });
  it("requires matching schedule, season, circuit and published winner", () => {
    const result = snapshot("2026/results/1.json?limit=100", "winners");
    const now = Date.parse("2026-11-02T12:00:00Z");
    expect(
      calendarFrom(schedule(), result.items, now).filter(
        (r) => r.status === "completed",
      ),
    ).toHaveLength(19);
    result.items[0].Circuit.circuitId = "wrong";
    expect(calendarFrom(schedule(), result.items, now)[0].status).toBe(
      "result_pending",
    );
  });
  it("exposes the next scheduled event without claiming live status", () => {
    const rs = calendarFrom(schedule(), [], Date.parse("2026-11-02T12:00:00Z"));
    expect(rs.find((r) => r.isNext).round).toBe("20");
    expect(rs.every((r) => r.status !== "live")).toBe(true);
  });
  it("preserves unknown dates and missing start times", () => {
    const s = schedule();
    s.items = [{ ...s.items[0], date: "bad", time: null }];
    expect(calendarFrom(s, [])[0].status).toBe("status_unknown");
  });
  it("separates season wins from verified historical titles", () => {
    const ds = driversFrom(drivers());
    const c = comparisonFrom(
      ds.find((d) => d.id === "hamilton"),
      ds.find((d) => d.id === "norris"),
      CHAMPIONS_HISTORY,
    );
    expect(c.metrics[1].values).toEqual([1, 2]);
    expect(c.metrics[3].values).toEqual([7, 1]);
    expect(c.season).toBe(2026);
  });
  it("rejects identical or cross-season comparisons", () => {
    const ds = driversFrom(drivers());
    expect(comparisonFrom(ds[0], ds[0])).toBeNull();
    expect(comparisonFrom(ds[0], { ...ds[1], season: 2025 })).toBeNull();
  });
  it("keeps missing race timings explicit", () =>
    expect(
      resultRows({
        Results: [
          {
            Driver: {
              driverId: "test",
              givenName: "Missing",
              familyName: "Time",
            },
            position: "1",
          },
        ],
      })[0],
    ).toMatchObject({ time: "Não disponível", laps: null, points: null }));
});
describe("untrusted presentation values", () => {
  it("does not claim zero titles when the historical archive is unavailable", () => {
    const ds = driversFrom(drivers());
    expect(comparisonFrom(ds[0], ds[1]).metrics[3].values).toEqual([
      null,
      null,
    ]);
  });
  it("allows only approved HTTPS photo providers", () => {
    expect(safeImage("https://media.formula1.com/photo.webp")).toBeTruthy();
    for (const value of [
      "javascript:alert(1)",
      "data:image/svg+xml,bad",
      "https://media.formula1.com.evil.test/a",
      "https://user:pass@media.formula1.com/a",
      null,
    ])
      expect(safeImage(value)).toBeNull();
  });
  it("rejects unsafe outbound URL schemes", () => {
    expect(safeLink("https://commons.wikimedia.org/wiki/Test")).toBeTruthy();
    expect(safeLink("javascript:alert(1)")).toBeNull();
  });
  it("does not accept arbitrary CSS as a team color", () => {
    expect(safeColor("#00d2be")).toBe("#00d2be");
    expect(safeColor("url(evil)")).toBe("#a8adb8");
  });
});

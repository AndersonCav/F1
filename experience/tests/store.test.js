import { describe, it, expect, vi } from "vitest";
import { createPortal } from "../src/composables/usePortal.js";
const resource = (season, items = []) => ({
  season,
  items,
  timestamp: 100,
  stale: false,
  source: "network",
});
function source() {
  return Object.fromEntries(
    [
      "fetchCurrentSchedule",
      "fetchScheduleBySeason",
      "fetchCurrentDriverStandings",
      "fetchCurrentConstructorStandings",
      "fetchCurrentResults",
      "fetchSeasonWinners",
    ].map((k) => [k, vi.fn(async (season) => resource(season || 2026))]),
  );
}
describe("shared season resource lifecycle", () => {
  it("derives current season from API and deduplicates concurrent mounts", async () => {
    const api = source(),
      p = createPortal(api);
    await Promise.all([p.load(2026), p.load(2026)]);
    expect(api.fetchScheduleBySeason).toHaveBeenCalledTimes(1);
    expect(api.fetchCurrentDriverStandings).toHaveBeenCalledTimes(1);
    expect(p.state.season).toBe(2026);
  });
  it("keeps archive navigation available when sporting API fails", async () => {
    const api = source();
    api.fetchCurrentSchedule.mockRejectedValue(Error("offline"));
    const p = createPortal(api);
    await p.load();
    expect(p.state.schedule.status).toBe("error");
    expect(p.state.loading).toBe(false);
  });
  it("reports partial failure without discarding other panels", async () => {
    const api = source();
    api.fetchCurrentDriverStandings.mockRejectedValue(Error("down"));
    const p = createPortal(api);
    await p.load();
    expect(p.state.driverStandings.status).toBe("error");
    expect(p.state.constructorStandings.status).toBe("empty");
    expect(p.freshness.value.partial).toBe(true);
  });
  it("rejects inconsistent season results", async () => {
    const api = source();
    api.fetchCurrentDriverStandings.mockResolvedValue(resource(2025));
    const p = createPortal(api);
    await p.load();
    expect(p.state.driverStandings.status).toBe("error");
  });
  it("does not let a slow prior season overwrite a newer selection", async () => {
    const api = source();
    let resolveOld;
    api.fetchScheduleBySeason.mockImplementation((year) =>
      year === 2025
        ? new Promise((r) => {
            resolveOld = r;
          })
        : Promise.resolve(resource(year)),
    );
    const p = createPortal(api);
    const old = p.load(2025);
    await p.load(2026);
    resolveOld(resource(2025));
    await old;
    expect(p.state.season).toBe(2026);
    expect(p.state.schedule.season).toBe(2026);
  });
  it("retains freshness and stale cache provenance", async () => {
    const api = source();
    api.fetchCurrentSchedule.mockResolvedValue({
      ...resource(2026),
      stale: true,
      source: "cache",
      timestamp: 50,
    });
    const p = createPortal(api);
    await p.load();
    expect(p.freshness.value).toMatchObject({
      stale: true,
      cached: true,
      timestamp: 50,
    });
  });
});

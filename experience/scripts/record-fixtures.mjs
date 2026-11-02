import { mkdir, writeFile } from "node:fs/promises";
import { decodeResponse } from "../../assets/js/data-model.js";
const base = "https://api.jolpi.ca/ergast/f1/";
const report = {
  recordedAt: new Date().toISOString(),
  purpose:
    "Recorded real Jolpica responses for reproducible tests; never imported by the production app.",
  responses: {},
};
async function capture(route, kind, season = null) {
  const response = await fetch(base + route, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${route}: ${response.status}`);
  const json = await response.json();
  const model = decodeResponse(json, kind, season);
  report.responses[route] = json;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return model;
}
const schedule = await capture("current/races.json?limit=100", "schedule");
report.season = schedule.season;
for (const year of [schedule.season, 2025]) {
  if (year !== schedule.season)
    await capture(`${year}/races.json?limit=100`, "schedule", year);
  for (const [route, kind] of [
    ["driverStandings", "driver-standings"],
    ["constructorStandings", "constructor-standings"],
    ["last/results", "results"],
    ["results/1", "winners"],
  ]) {
    await capture(`${year}/${route}.json?limit=100`, kind, year);
  }
}
await mkdir(new URL("../tests/fixtures/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../tests/fixtures/jolpica-recording.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(`Recorded validated ${report.season} and 2025 source responses.`);

import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const oldApiReport = new URL("docs/phase-2/validation/live-api.json", root);
const original = await readFile(oldApiReport);
const imageDir = await mkdtemp(join(tmpdir(), "f1-phase5-live-"));
const results = [];
try {
  for (const [name, path] of [
    ["api", "tests/browser/live-api.mjs"],
    ["pages", "tests/browser/live.browser.mjs"],
    ["images", "tests/browser/champion-images.live.mjs"],
  ]) {
    const chunks = [];
    const child = spawn(process.execPath, ["--test", path], {
      cwd: fileURLToPath(root),
      env: { ...process.env, F1_IMAGE_AUDIT_DIR: imageDir },
    });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    const code = await new Promise((resolve) => child.on("close", resolve));
    await writeFile(
      new URL(`docs/phase-5/validation/legacy-live-${name}.txt`, root),
      Buffer.concat(chunks),
    );
    results.push({ name, code });
    console.log(`[legacy live] ${name}: exit ${code}`);
    if (name === "api")
      await writeFile(
        new URL("docs/phase-5/validation/legacy-live-api.json", root),
        await readFile(oldApiReport),
      );
    if (name === "images") {
      try {
        await writeFile(
          new URL("docs/phase-5/validation/legacy-live-images.json", root),
          await readFile(join(imageDir, "results.json")),
        );
      } catch {
        /* Failure is retained in the command log. */
      }
    }
  }
} finally {
  await writeFile(oldApiReport, original);
  await writeFile(
    new URL("docs/phase-5/validation/legacy-live-summary.json", root),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results,
        imageEvidenceDirectory: imageDir,
        legacyReportRestored: true,
      },
      null,
      2,
    ) + "\n",
  );
}
process.exitCode = results.some((r) => r.code !== 0) ? 1 : 0;

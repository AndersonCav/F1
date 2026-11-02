import { readFile, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const saved = new Map();
async function snapshot(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (entry.name === "phase-5") continue;
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
    if (entry.isDirectory()) await snapshot(path);
    else if (/\.(json|txt)$/.test(entry.name))
      saved.set(path.href, await readFile(path));
  }
}
await snapshot(new URL("docs/", root));
const log = [];
const child = spawn(
  process.execPath,
  [
    "--test",
    "tests/browser/phase1.browser.mjs",
    "tests/browser/champion-images.browser.mjs",
    "tests/browser/phase2.browser.mjs",
    "tests/browser/phase4.browser.mjs",
  ],
  { cwd: fileURLToPath(root), env: process.env },
);
child.stdout.on("data", (d) => log.push(d));
child.stderr.on("data", (d) => log.push(d));
const code = await new Promise((resolve) => child.on("close", resolve));
await writeFile(
  new URL("docs/phase-5/validation/legacy-browser.txt", root),
  Buffer.concat(log),
);
for (const [url, bytes] of saved) await writeFile(new URL(url), bytes);
console.log(
  `Legacy browser regression exit: ${code}. Existing evidence restored byte for byte.`,
);
process.exitCode = code || 0;

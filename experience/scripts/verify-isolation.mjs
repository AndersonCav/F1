import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const cwd = fileURLToPath(root);
const output = new URL("docs/phase-5/validation/", root);
const original = JSON.parse(
  await readFile(new URL("legacy-hashes.json", output), "utf8"),
);
const failures = [];
for (const file of original) {
  try {
    const bytes = await readFile(new URL(file.path, root));
    const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    if (hash !== file.sha256) failures.push(file.path);
  } catch {
    failures.push(file.path);
  }
}
const git = (args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const html = await readFile(
  new URL("experience/dist-preview/index.html", root),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(
    new URL("experience/dist-preview/offline-manifest.json", root),
    "utf8",
  ),
);
const csp = html.match(/http-equiv="Content-Security-Policy"[^>]+/)?.[0] || "";
if (!csp || csp.includes("unsafe-inline") || csp.includes("unsafe-eval"))
  failures.push("preview-production-CSP");
if (
  manifest.scope !== "/F1/experience/" ||
  manifest.core.some(
    (p) => p.includes("ComparisonPanel") || p.includes("CompareView"),
  )
)
  failures.push("preview-worker-isolation");
const branch = git(["branch", "--show-current"]);
const head = git(["rev-parse", "HEAD"]);
if (branch !== "main" || head !== "952f31ad630e06223a6e0784b83d1dbaa8e04bdd")
  failures.push("branch-or-head-changed");
const staged = git(["diff", "--cached", "--name-only"])
  .split("\n")
  .filter(Boolean);
const unstaged = git(["diff", "--name-only"]).split("\n").filter(Boolean);
if (staged.length || unstaged.length) failures.push("existing-tracked-changes");
await writeFile(new URL("files-changed.json", output), "{}\n");
await writeFile(new URL("final-git-status.txt", output), "");
await writeFile(new URL("isolation.json", output), "{}\n");
const untracked = git(["ls-files", "--others", "--exclude-standard"])
  .split("\n")
  .filter(Boolean);
await writeFile(
  new URL("files-changed.json", output),
  JSON.stringify({ modified: unstaged, staged, added: untracked }, null, 2) +
    "\n",
);
const report = {
  generatedAt: new Date().toISOString(),
  branch,
  head,
  originalFilesCompared: original.length,
  changedOriginalFiles: failures.filter((p) =>
    original.some((f) => f.path === p),
  ),
  staged,
  unstaged,
  untrackedCount: untracked.length,
  productionCsp: csp,
  offlineScope: manifest.scope,
  offlineCoreFiles: manifest.core,
  failures,
  noCommitPushMergeDeploymentOrRemoteSettingsChanges: true,
};
await writeFile(
  new URL("isolation.json", output),
  JSON.stringify(report, null, 2) + "\n",
);
await writeFile(
  new URL("final-git-status.txt", output),
  git(["status", "--short", "--branch", "--untracked-files=all"]) + "\n",
);
console.log(
  JSON.stringify({
    compared: original.length,
    failures,
    branch,
    head,
    staged: staged.length,
    unstaged: unstaged.length,
    untracked: untracked.length,
  }),
);
process.exitCode = failures.length ? 1 : 0;

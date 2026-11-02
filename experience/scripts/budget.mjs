import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = new URL("../dist-preview/", import.meta.url);
const files = [];
async function walk(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
    if (entry.isDirectory()) await walk(path);
    else {
      const body = await readFile(path);
      files.push({
        path: path.href.slice(root.href.length),
        bytes: body.length,
        gzip: gzipSync(body).length,
      });
    }
  }
}
await walk(root);
const total = (extension) =>
  files
    .filter((f) => f.path.endsWith(extension))
    .reduce((n, f) => n + f.bytes, 0);
const manifest = JSON.parse(
  await readFile(new URL(".vite/manifest.json", root), "utf8"),
);
const entry = Object.values(manifest).find((e) => e.isEntry);
const initial = new Set([entry.file, ...(entry.css || []), "index.html"]);
function imports(chunk) {
  for (const name of chunk.imports || []) {
    const m = manifest[name];
    initial.add(m.file);
    for (const css of m.css || []) initial.add(css);
    imports(m);
  }
}
imports(entry);
const initialGzip = files
  .filter((f) => initial.has(f.path))
  .reduce((n, f) => n + f.gzip, 0);
const limits = {
  totalBytes: 650 * 1024,
  jsBytes: 360 * 1024,
  cssBytes: 100 * 1024,
  initialCodeGzipBytes: 95 * 1024,
};
const actual = {
  totalBytes: files.reduce((n, f) => n + f.bytes, 0),
  jsBytes: total(".js"),
  cssBytes: total(".css"),
  initialCodeGzipBytes: initialGzip,
};
const report = {
  generatedAt: new Date().toISOString(),
  limits,
  actual,
  initialFiles: [...initial],
  files,
  notes:
    "Initial static entry excludes the lazy dashboard, font files, remote data and photos. Browser network measurements record those separately. Gzip is a deterministic estimate; Browser measurements record actual HTTP content encodings and transfers separately.",
};
await mkdir(new URL("../../docs/phase-5/validation/", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL("../../docs/phase-5/validation/bundle.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
for (const [key, value] of Object.entries(actual))
  if (value > limits[key])
    throw new Error(
      `Preview budget exceeded: ${key} ${value} > ${limits[key]}`,
    );
console.log("[preview budget]", JSON.stringify(actual), "PASS");
console.log("Output:", fileURLToPath(root));

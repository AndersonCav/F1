import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, relative, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const distDir = resolve(rootDir, 'dist');

export const PRODUCTION_ALLOWLIST = [
  // HTML Entrypoints
  'index.html',
  'drivers.html',
  'teams.html',
  'champions.html',
  'calendar.html',
  '404.html',

  // PWA & Service Worker
  'manifest.json',
  'sw.js',
  '.nojekyll',

  // Stylesheets
  'assets/css/styles-v7.css',
  'assets/css/animations.css',

  // Static Local Images
  'assets/images/placeholder-driver.svg',

  // Application ES Modules
  'assets/js/api.js',
  'assets/js/calendar.js',
  'assets/js/champion-history.js',
  'assets/js/champions.js',
  'assets/js/circuit-metadata.js',
  'assets/js/constructor-metadata.js',
  'assets/js/data-model.js',
  'assets/js/driver-metadata.js',
  'assets/js/drivers-v10.js',
  'assets/js/historical-snapshots.js',
  'assets/js/main-v10.js',
  'assets/js/season.js',
  'assets/js/static-data.js',
  'assets/js/teams-v10.js',
  'assets/js/ui-utils.js'
];

export async function build(options = {}) {
  const targetDir = options.distDir ? resolve(options.distDir) : distDir;
  const sourceDir = options.rootDir ? resolve(options.rootDir) : rootDir;
  const allowlist = options.allowlist || PRODUCTION_ALLOWLIST;
  const silent = options.silent || false;

  // Security check: ensure target directory does not escape or collide unexpectedly
  const relTarget = relative(sourceDir, targetDir);
  if (relTarget.startsWith('..') && !options.distDir) {
    throw new Error(`Unsafe target directory: ${targetDir}`);
  }

  if (!silent) {
    console.log(`[build] Starting production build...`);
    console.log(`[build] Source: ${sourceDir}`);
    console.log(`[build] Target: ${targetDir}`);
  }

  // Clean target directory safely
  try {
    const targetStat = await stat(targetDir);
    if (!targetStat.isDirectory()) {
      throw new Error(`Target path exists and is not a directory: ${targetDir}`);
    }
    await rm(targetDir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  await mkdir(targetDir, { recursive: true });

  let totalBytes = 0;
  const packagedFiles = [];

  for (const relPath of allowlist) {
    // Prevent path traversal
    const normalized = normalize(relPath).replace(/\\/g, '/');
    if (normalized.startsWith('../') || normalized.includes('/../')) {
      throw new Error(`Unsafe allowlist path traversal: ${relPath}`);
    }

    const srcPath = resolve(sourceDir, normalized);
    const destPath = resolve(targetDir, normalized);

    // Verify source exists and is a regular file
    let fileStat;
    try {
      fileStat = await stat(srcPath);
    } catch {
      throw new Error(`Required production asset missing from source: ${relPath}`);
    }

    if (!fileStat.isFile()) {
      throw new Error(`Allowlist path is not a file: ${relPath}`);
    }

    // Ensure parent directory exists
    const destParent = resolve(destPath, '..');
    await mkdir(destParent, { recursive: true });

    // Copy file
    await cp(srcPath, destPath);

    totalBytes += fileStat.size;
    packagedFiles.push({ path: normalized, size: fileStat.size });
  }

  if (!silent) {
    console.log(`[build] Successfully packaged ${packagedFiles.length} files (${(totalBytes / 1024).toFixed(2)} KB).`);
  }

  return { targetDir, packagedFiles, totalBytes };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  build().catch(err => {
    console.error(`[build] ERROR:`, err.message);
    process.exit(1);
  });
}

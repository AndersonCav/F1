import { execFileSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function getJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      files.push(...await getJsFiles(fullPath));
    } else if (['.js', '.mjs'].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function checkSyntax(options = {}) {
  const targetDir = options.rootDir ? resolve(options.rootDir) : rootDir;
  const silent = options.silent || false;

  const targetDirs = ['assets', 'scripts', 'tests'].map(d => join(targetDir, d));
  const files = [];
  for (const d of targetDirs) {
    try {
      const s = await stat(d);
      if (s.isDirectory()) files.push(...await getJsFiles(d));
    } catch {
      // directory might not exist in fixtures
    }
  }

  // Also include root sw.js
  const rootSw = join(targetDir, 'sw.js');
  try {
    const s = await stat(rootSw);
    if (s.isFile()) files.push(rootSw);
  } catch {}

  if (!silent) {
    console.log(`[check-syntax] Checking syntax across ${files.length} JavaScript/MJS files...`);
  }

  const errors = [];
  for (const file of files) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      errors.push({ file, error: stderr.trim() });
    }
  }

  if (errors.length > 0) {
    const msg = `Syntax check failed for ${errors.length} file(s):\n` +
      errors.map(e => `  - ${e.file}\n    ${e.error}`).join('\n');
    if (!silent) console.error(`[check-syntax] ERROR:\n` + msg);
    throw new Error(msg);
  }

  if (!silent) {
    console.log(`[check-syntax] PASSED: All ${files.length} files passed syntax validation.`);
  }

  return { verified: true, fileCount: files.length };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  checkSyntax().catch(() => process.exit(1));
}

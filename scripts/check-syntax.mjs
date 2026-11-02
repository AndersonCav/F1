import { execFileSync } from 'node:child_process';
import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve, join, extname, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));

export async function getJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      files.push(...await getJsFiles(fullPath));
    } else if (['.js', '.mjs', '.cjs'].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function determineFormat(file, content) {
  const ext = extname(file);
  if (ext === '.mjs') return 'module';
  if (ext === '.cjs') return 'commonjs';

  // For .js, look for the nearest package.json
  let dir = dirname(resolve(file));
  const { root } = parse(dir);
  while (dir) {
    const pkgPath = join(dir, 'package.json');
    try {
      const pkgContent = await readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      if (pkg.type === 'module' || pkg.type === 'commonjs') {
        return pkg.type;
      }
      break;
    } catch (err) {
      if (err.code !== 'ENOENT') break;
    }
    if (dir === root) break;
    dir = dirname(dir);
  }

  // Fallback: detect module syntax (import/export keywords)
  const hasModuleSyntax = /\b(import\s*['"*{]|import\s*[\w$]|export\s*[{*]|export\s+(default|const|let|var|function|class|async))\b/.test(content);
  return hasModuleSyntax ? 'module' : 'commonjs';
}

export async function checkSyntax(options = {}) {
  const targetDir = options.rootDir ? resolve(options.rootDir) : rootDir;
  const silent = options.silent || false;
  const readFileFn = options.readFile || readFile;

  // 1. Verify target directory exists
  try {
    const targetStat = await stat(targetDir);
    if (!targetStat.isDirectory()) {
      throw new Error(`Target directory is not a directory: ${targetDir}`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Target directory does not exist: ${targetDir}`);
    }
    throw err;
  }

  // 2. Discover files
  const fileSet = new Set();
  const targetDirs = ['assets', 'scripts', 'tests'].map(d => join(targetDir, d));

  for (const d of targetDirs) {
    try {
      const s = await stat(d);
      if (s.isDirectory()) {
        const found = await getJsFiles(d);
        for (const f of found) fileSet.add(f);
      }
    } catch {
      // directory might not exist in fixtures
    }
  }

  // Also include root sw.js or other root JS files
  const rootSw = join(targetDir, 'sw.js');
  try {
    const s = await stat(rootSw);
    if (s.isFile()) fileSet.add(rootSw);
  } catch {}

  // If no files were found via standard directories, scan targetDir directly
  if (fileSet.size === 0) {
    const found = await getJsFiles(targetDir);
    for (const f of found) fileSet.add(f);
  }

  const files = Array.from(fileSet);

  if (files.length === 0) {
    if (options.allowEmpty) {
      return { verified: true, fileCount: 0 };
    }
    throw new Error(`No JavaScript files found to validate in target directory: ${targetDir}`);
  }

  if (!silent) {
    console.log(`[check-syntax] Checking syntax across ${files.length} JavaScript/MJS/CJS files...`);
  }

  const errors = [];
  for (const file of files) {
    let content;
    try {
      content = await readFileFn(file, 'utf8');
    } catch (fsErr) {
      errors.push({ file, error: `Filesystem read error: ${fsErr.message}` });
      continue;
    }

    const format = await determineFormat(file, content);

    try {
      execFileSync(
        process.execPath,
        ['--check', `--input-type=${format}`],
        {
          input: content,
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf8'
        }
      );
    } catch (err) {
      let stderr = err.stderr ? err.stderr.toString() : err.message;
      stderr = stderr.replaceAll('[stdin]', file);
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

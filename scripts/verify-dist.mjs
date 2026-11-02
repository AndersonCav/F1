import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, normalize, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_ALLOWLIST } from './build.mjs';
import { DEFAULT_BUDGETS } from './check-budget.mjs';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const defaultDistDir = resolve(rootDir, 'dist');

const REQUIRED_HTML = [
  'index.html',
  'drivers.html',
  'teams.html',
  'champions.html',
  'calendar.html',
  '404.html'
];

const FORBIDDEN_PATTERNS = [
  /^\.git/,
  /^\.github/,
  /^docs/,
  /^tests/,
  /^scripts/,
  /^node_modules/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.editorconfig$/,
  /\.md$/i,
  /\.txt$/i,
  /\.log$/i,
  /\.env/i,
  /\.test\.js$/,
  /\.mjs$/
];

async function collectFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(fullPath, relPath));
    } else {
      results.push({ relPath, fullPath, name: entry.name });
    }
  }
  return results;
}

export async function verifyDist(options = {}) {
  const distDir = options.distDir ? resolve(options.distDir) : defaultDistDir;
  const silent = options.silent || false;
  const errors = [];

  if (!silent) {
    console.log(`[verify-dist] Verifying production artifact in: ${distDir}`);
  }

  // 1. Verify dist exists and is a directory
  try {
    const s = await stat(distDir);
    if (!s.isDirectory()) throw new Error('Not a directory');
  } catch {
    throw new Error(`Production directory does not exist or is invalid: ${distDir}. Run 'npm run build' first.`);
  }

  // 2. Collect all files in dist
  const files = await collectFiles(distDir);
  const fileSet = new Set(files.map(f => f.relPath.replace(/\\/g, '/')));

  // 3. Security & Exclusion Checks
  for (const file of files) {
    const normalized = file.relPath.replace(/\\/g, '/');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if ((pattern.test(normalized) || pattern.test(file.name)) && normalized !== 'robots.txt') {
        errors.push(`Forbidden file found in production artifact: ${normalized} (matched ${pattern})`);
      }
    }
  }

  // 4. Verify all required HTML entrypoints exist
  for (const htmlFile of REQUIRED_HTML) {
    if (!fileSet.has(htmlFile)) {
      errors.push(`Missing required HTML entrypoint in dist: ${htmlFile}`);
    }
  }

  // 5. Verify .nojekyll exists
  if (!fileSet.has('.nojekyll')) {
    errors.push('Missing .nojekyll in dist (required for GitHub Pages static serving)');
  }

  // 6. Verify manifest.json exists and references valid assets
  if (!fileSet.has('manifest.json')) {
    errors.push('Missing manifest.json in dist');
  } else {
    try {
      const manifestRaw = await readFile(join(distDir, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw);
      if (manifest.start_url) {
        const startPath = manifest.start_url.replace(/^\.\//, '');
        if (!fileSet.has(startPath)) {
          errors.push(`manifest.json start_url resolves to missing file: ${manifest.start_url}`);
        }
      }
      if (Array.isArray(manifest.icons)) {
        for (const icon of manifest.icons) {
          const iconPath = icon.src.replace(/^\.\//, '');
          if (!fileSet.has(iconPath)) {
            errors.push(`manifest.json icon resolves to missing file: ${icon.src}`);
          }
        }
      }
    } catch (err) {
      errors.push(`manifest.json is invalid JSON: ${err.message}`);
    }
  }

  // 7. Verify Service Worker precache integrity
  if (!fileSet.has('sw.js')) {
    errors.push('Missing sw.js in dist');
  } else {
    const swSource = await readFile(join(distDir, 'sw.js'), 'utf8');
    const versionMatch = swSource.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!versionMatch) {
      errors.push('sw.js does not specify CACHE_VERSION');
    }

    const assetsMatch = swSource.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    if (!assetsMatch) {
      errors.push('sw.js does not contain ASSETS_TO_CACHE array');
    } else {
      const precachePaths = [...assetsMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(m => m[1]);
      if (precachePaths.length !== DEFAULT_BUDGETS.expectedPrecacheCount) {
        errors.push(`Expected exactly ${DEFAULT_BUDGETS.expectedPrecacheCount} precached shell resources in sw.js, found ${precachePaths.length}`);
      }

      for (const assetPath of precachePaths) {
        if (!assetPath.startsWith('./')) {
          errors.push(`sw.js precache path must start with './': ${assetPath}`);
          continue;
        }
        const relAsset = assetPath.slice(2);
        if (!fileSet.has(relAsset)) {
          errors.push(`sw.js precaches missing file: ${assetPath} (resolved: ${relAsset})`);
        }
      }
    }
  }

  // 8. Verify CSP synchronization across all HTML files
  let sharedPolicy = null;
  for (const htmlFile of REQUIRED_HTML) {
    if (!fileSet.has(htmlFile)) continue;
    const html = await readFile(join(distDir, htmlFile), 'utf8');
    const cspMatch = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"\s*\/?>/i)
      || html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content='([^']*)'\s*\/?>/i);
    if (!cspMatch) {
      errors.push(`Missing CSP meta tag in dist/${htmlFile}`);
      continue;
    }
    const policy = cspMatch[1];
    if (sharedPolicy === null) {
      sharedPolicy = policy;
    } else if (policy !== sharedPolicy) {
      errors.push(`CSP policy in dist/${htmlFile} does not match other pages`);
    }

    // CSP security assertions
    if (/unsafe-inline|unsafe-eval|\*/.test(policy)) {
      errors.push(`CSP in dist/${htmlFile} contains unsafe-inline, unsafe-eval, or wildcards`);
    }
    if (!policy.includes("script-src-attr 'none'") || !policy.includes("style-src-attr 'none'")) {
      errors.push(`CSP in dist/${htmlFile} must include script-src-attr 'none' and style-src-attr 'none'`);
    }

    // Check stylesheet links
    for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
      const href = match[1].split('?')[0];
      if (/^https?:\/\//.test(href)) continue; // external Google Fonts
      const relCss = href.replace(/^\.\//, '');
      if (!fileSet.has(relCss)) {
        errors.push(`dist/${htmlFile} references missing stylesheet: ${href}`);
      }
    }

    // Check script tags
    for (const match of html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      const src = match[1].split('?')[0];
      if (/^https?:\/\//.test(src)) continue;
      const relJs = src.replace(/^\.\//, '');
      if (!fileSet.has(relJs)) {
        errors.push(`dist/${htmlFile} references missing script: ${src}`);
      }
    }

    // Check local img tags
    for (const match of html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      const src = match[1].split('?')[0];
      if (/^https?:\/\/|^data:/.test(src)) continue;
      const relImg = src.replace(/^\.\//, '');
      if (!fileSet.has(relImg)) {
        errors.push(`dist/${htmlFile} references missing local image: ${src}`);
      }
    }
  }

  // 9. Verify ES Module imports within dist/assets/js/
  for (const file of files) {
    if (file.relPath.startsWith('assets/js/') && file.name.endsWith('.js')) {
      const js = await readFile(file.fullPath, 'utf8');
      for (const match of js.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)) {
        const importTarget = match[1];
        const resolvedPath = normalize(join('assets/js', importTarget)).replace(/\\/g, '/');
        if (!fileSet.has(resolvedPath)) {
          errors.push(`ES module ${file.relPath} imports missing file: ${importTarget} (resolved: ${resolvedPath})`);
        }
      }
    }
  }

  // 10. Verify the exact explicit allowlist, including optional SEO artwork.
  if (files.length !== PRODUCTION_ALLOWLIST.length) {
    errors.push(`Expected exactly ${PRODUCTION_ALLOWLIST.length} files in production artifact, found ${files.length}`);
  }
  for (const required of PRODUCTION_ALLOWLIST) if (!fileSet.has(required)) errors.push(`Missing allowlisted production asset: ${required}`);
  for (const path of fileSet) if (!PRODUCTION_ALLOWLIST.includes(path)) errors.push(`Unexpected production asset: ${path}`);

  if (errors.length > 0) {
    const message = `Production artifact verification failed with ${errors.length} error(s):\n  - ` + errors.join('\n  - ');
    if (!silent) console.error(`[verify-dist] ERROR:\n` + message);
    throw new Error(message);
  }

  if (!silent) {
    console.log(`[verify-dist] PASSED: All ${files.length} production files verified successfully.`);
  }

  return { verified: true, fileCount: files.length };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  verifyDist().catch(() => process.exit(1));
}

import { readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const defaultDistDir = resolve(rootDir, 'dist');

// Explicit, documented performance budgets based on measured baseline
export const DEFAULT_BUDGETS = {
  maxHtmlEntrypointBytes: 12 * 1024,      // 12 KB max per HTML page (baseline: index.html 5.6 KB)
  maxTotalCssBytes: 35 * 1024,            // 35 KB max for all CSS (baseline: 22.1 KB)
  maxTotalJsBytes: 200 * 1024,            // 200 KB max for all JS modules (baseline: ~150 KB)
  maxTotalDistBytes: 250 * 1024,          // 250 KB max for entire production bundle (baseline: ~184 KB)
  expectedPrecacheCount: 25               // Exactly 25 precached shell resources in sw.js
};

export async function checkBudget(options = {}) {
  const distDir = options.distDir ? resolve(options.distDir) : defaultDistDir;
  const budgets = { ...DEFAULT_BUDGETS, ...(options.budgets || {}) };
  const silent = options.silent || false;
  const errors = [];

  if (!silent) {
    console.log(`[check-budget] Checking performance and size budgets for: ${distDir}`);
  }

  // Walk dist directory
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) files.push(...await walk(full));
      else files.push(full);
    }
    return files;
  }

  const allFiles = await walk(distDir);
  let totalBytes = 0;
  let totalCssBytes = 0;
  let totalJsBytes = 0;
  const htmlSizes = {};

  for (const filePath of allFiles) {
    const s = await stat(filePath);
    const size = s.size;
    totalBytes += size;
    const rel = filePath.slice(distDir.length + 1).replace(/\\/g, '/');

    if (rel.endsWith('.html')) {
      htmlSizes[rel] = size;
      if (size > budgets.maxHtmlEntrypointBytes) {
        errors.push(`HTML file ${rel} (${(size / 1024).toFixed(2)} KB) exceeds budget of ${(budgets.maxHtmlEntrypointBytes / 1024).toFixed(2)} KB`);
      }
    } else if (rel.endsWith('.css')) {
      totalCssBytes += size;
    } else if (rel.endsWith('.js')) {
      totalJsBytes += size;
    }
  }

  if (totalCssBytes > budgets.maxTotalCssBytes) {
    errors.push(`Total CSS (${(totalCssBytes / 1024).toFixed(2)} KB) exceeds budget of ${(budgets.maxTotalCssBytes / 1024).toFixed(2)} KB`);
  }

  if (totalJsBytes > budgets.maxTotalJsBytes) {
    errors.push(`Total JS (${(totalJsBytes / 1024).toFixed(2)} KB) exceeds budget of ${(budgets.maxTotalJsBytes / 1024).toFixed(2)} KB`);
  }

  if (totalBytes > budgets.maxTotalDistBytes) {
    errors.push(`Total package size (${(totalBytes / 1024).toFixed(2)} KB) exceeds budget of ${(budgets.maxTotalDistBytes / 1024).toFixed(2)} KB`);
  }

  if (!silent) {
    console.log(`[check-budget] Summary:`);
    console.log(`  - Total Package:   ${(totalBytes / 1024).toFixed(2)} KB / ${(budgets.maxTotalDistBytes / 1024).toFixed(2)} KB budget`);
    console.log(`  - Total CSS:       ${(totalCssBytes / 1024).toFixed(2)} KB / ${(budgets.maxTotalCssBytes / 1024).toFixed(2)} KB budget`);
    console.log(`  - Total JS:        ${(totalJsBytes / 1024).toFixed(2)} KB / ${(budgets.maxTotalJsBytes / 1024).toFixed(2)} KB budget`);
    for (const [page, size] of Object.entries(htmlSizes)) {
      console.log(`  - ${page.padEnd(16)}: ${(size / 1024).toFixed(2)} KB / ${(budgets.maxHtmlEntrypointBytes / 1024).toFixed(2)} KB budget`);
    }
  }

  if (errors.length > 0) {
    const msg = `Budget check failed with ${errors.length} error(s):\n  - ` + errors.join('\n  - ');
    if (!silent) console.error(`[check-budget] ERROR:\n` + msg);
    throw new Error(msg);
  }

  if (!silent) {
    console.log(`[check-budget] PASSED: All sizes are within defined budgets.`);
  }

  return { verified: true, totalBytes, totalCssBytes, totalJsBytes, htmlSizes };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  checkBudget().catch(() => process.exit(1));
}

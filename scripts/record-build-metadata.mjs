import { createHash } from 'node:crypto';
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const defaultDistDir = resolve(rootDir, 'dist');
const defaultMetaDir = resolve(rootDir, 'build-metadata');

export function getGitHeadSha(cwd = rootDir) {
  try {
    return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export async function hashFile(filePath) {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export async function recordBuildMetadata(options = {}) {
  const distDir = options.distDir ? resolve(options.distDir) : defaultDistDir;
  const metaDir = options.metaDir ? resolve(options.metaDir) : defaultMetaDir;
  const silent = options.silent || false;

  // Validate dist exists
  const s = await stat(distDir);
  if (!s.isDirectory()) {
    throw new Error(`dist directory does not exist or is not a directory: ${distDir}`);
  }

  const rawSha = options.commitSha || process.env.WORKFLOW_SHA || process.env.GITHUB_SHA || getGitHeadSha();
  if (!rawSha || !/^[0-9a-f]{40}$/i.test(rawSha.trim())) {
    throw new Error(`Invalid or missing commit SHA for build metadata: ${rawSha}`);
  }
  const commitSha = rawSha.trim().toLowerCase();

  // Recursively collect all files in dist
  async function collectFiles(dir, base = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const results = [];
    for (const e of entries) {
      const rel = base ? `${base}/${e.name}` : e.name;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...await collectFiles(full, rel));
      } else {
        results.push({ relPath: rel.replace(/\\/g, '/'), fullPath: full, size: (await stat(full)).size });
      }
    }
    return results;
  }

  const files = await collectFiles(distDir);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const fileRecords = [];
  const aggregateHasher = createHash('sha256');

  for (const f of files) {
    const sha256 = await hashFile(f.fullPath);
    fileRecords.push({ path: f.relPath, size: f.size, sha256 });
    aggregateHasher.update(`${f.relPath}:${sha256}\n`);
  }

  const artifactSha256 = aggregateHasher.digest('hex');

  const metadata = {
    commitSha,
    ref: options.ref || process.env.TARGET_REF || process.env.GITHUB_REF || 'refs/heads/main',
    fileCount: files.length,
    artifactSha256,
    files: fileRecords,
    createdAt: new Date().toISOString()
  };

  await mkdir(metaDir, { recursive: true });
  const metaFilePath = join(metaDir, 'metadata.json');
  await writeFile(metaFilePath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  if (!silent) {
    console.log(`[build-metadata] Recorded metadata for commit ${metadata.commitSha} (${metadata.fileCount} files, sha256: ${metadata.artifactSha256.slice(0, 12)}...)`);
  }

  return { metadata, metaFilePath };
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  recordBuildMetadata().catch(err => {
    console.error(`[build-metadata] ERROR: ${err.message}`);
    process.exit(1);
  });
}

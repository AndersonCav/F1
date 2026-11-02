import { createHash } from 'node:crypto';
import { readFile, readdir, stat, appendFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const rootDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const defaultDistDir = resolve(rootDir, 'dist');
const defaultMetaPath = resolve(rootDir, 'build-metadata/metadata.json');

/**
 * Validates whether a value is a standard 40-character hexadecimal Git commit SHA.
 * @param {unknown} sha
 * @returns {boolean}
 */
export function isValidSha(sha) {
  return typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha.trim());
}

/**
 * Pure deterministic decision function for deployment gate eligibility.
 * Evaluates revision freshness, ref restrictions, event restrictions, and artifact provenance.
 *
 * @param {object} params
 * @param {string} params.workflowSha
 * @param {string} params.remoteHeadSha
 * @param {string} [params.ref]
 * @param {string} [params.eventName]
 * @param {string} [params.artifactSha]
 * @param {boolean} [params.distIntegrityMatch]
 * @returns {{ eligible: boolean, action: 'deploy' | 'skip' | 'block', reason: string }}
 */
export function evaluateDeploymentEligibility(params = {}) {
  const {
    workflowSha,
    remoteHeadSha,
    ref,
    eventName,
    artifactSha,
    distIntegrityMatch
  } = params;

  // 1. Validate Workflow SHA presence and format (Scenario 5, Scenario 4)
  if (!workflowSha || typeof workflowSha !== 'string' || !workflowSha.trim()) {
    throw new Error('Missing or empty workflow SHA');
  }
  if (!isValidSha(workflowSha)) {
    throw new Error(`Malformed workflow SHA: ${workflowSha}`);
  }

  // 2. Validate Remote HEAD SHA presence and format (Scenario 3, Scenario 4, Scenario 5)
  if (!remoteHeadSha || typeof remoteHeadSha !== 'string' || !remoteHeadSha.trim()) {
    throw new Error('Missing or empty remote HEAD SHA');
  }
  if (!isValidSha(remoteHeadSha)) {
    throw new Error(`Malformed remote HEAD SHA: ${remoteHeadSha}`);
  }

  // 3. Prohibit pull request deployments (Scenario 6)
  if (eventName === 'pull_request') {
    return {
      eligible: false,
      action: 'block',
      reason: 'Production deployment prohibited for pull_request event'
    };
  }

  // 4. Prohibit non-main ref deployments
  if (ref && ref !== 'refs/heads/main') {
    return {
      eligible: false,
      action: 'block',
      reason: `Production deployment prohibited for ref '${ref}' (only 'refs/heads/main' permitted)`
    };
  }

  // 5. Permitted events check
  if (eventName && eventName !== 'push' && eventName !== 'workflow_dispatch') {
    return {
      eligible: false,
      action: 'block',
      reason: `Production deployment prohibited for unsupported event: '${eventName}'`
    };
  }

  // 6. Artifact revision verification (Scenario 10)
  if (artifactSha !== undefined) {
    if (!artifactSha || typeof artifactSha !== 'string' || !isValidSha(artifactSha)) {
      throw new Error(`Malformed or missing artifact revision SHA: ${artifactSha}`);
    }
    if (artifactSha.trim().toLowerCase() !== workflowSha.trim().toLowerCase()) {
      return {
        eligible: false,
        action: 'block',
        reason: `Artifact revision mismatch: artifact was built for ${artifactSha.trim().toLowerCase()} but workflow is executing ${workflowSha.trim().toLowerCase()}`
      };
    }
  }

  // 7. Dist file integrity verification (if checked)
  if (distIntegrityMatch === false) {
    return {
      eligible: false,
      action: 'block',
      reason: 'Production artifact integrity mismatch: files in dist do not match recorded build checksums'
    };
  }

  // 8. Remote branch freshness comparison (Scenarios 1, 2, 7, 8)
  const normWorkflow = workflowSha.trim().toLowerCase();
  const normRemote = remoteHeadSha.trim().toLowerCase();

  if (normWorkflow === normRemote) {
    return {
      eligible: true,
      action: 'deploy',
      reason: `Workflow revision matches current remote refs/heads/main HEAD (${normRemote})`
    };
  }

  // Outdated revision
  return {
    eligible: false,
    action: 'skip',
    reason: `Workflow revision ${normWorkflow} is outdated. Current remote refs/heads/main HEAD is ${normRemote}`
  };
}

/**
 * Retrieves the current HEAD commit SHA of the specified branch from the GitHub repository.
 * Queries GitHub REST API with fallback to git ls-remote.
 *
 * @param {object} [options]
 * @returns {Promise<string>}
 */
export async function fetchRemoteHeadSha(options = {}) {
  const repository = options.repository || process.env.REPOSITORY || process.env.GITHUB_REPOSITORY || 'AndersonCav/F1';
  const targetRef = options.ref || process.env.TARGET_REF || process.env.GITHUB_REF || 'refs/heads/main';
  const token = options.token !== undefined ? options.token : process.env.GITHUB_TOKEN;
  const customFetch = options.fetchFn || globalThis.fetch;
  const branch = targetRef.replace(/^refs\/heads\//, '');

  if (options.mockRemoteSha !== undefined) {
    if (options.mockRemoteSha instanceof Error) throw options.mockRemoteSha;
    return options.mockRemoteSha;
  }

  // 1. Query GitHub REST API
  if (typeof customFetch === 'function') {
    try {
      const url = `https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`;
      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'f1-deployment-freshness-guard',
        'Cache-Control': 'no-cache, no-store'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

      const res = await customFetch(url, {
        headers,
        signal: controller.signal,
        cache: 'no-store'
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        const data = await res.json();
        const sha = data.object?.sha;
        if (sha && isValidSha(sha)) {
          return sha.trim().toLowerCase();
        }
        throw new Error(`GitHub API returned invalid commit SHA structure: ${JSON.stringify(data)}`);
      }
      if (res.status === 404) {
        throw new Error(`Remote branch '${targetRef}' not found in repository '${repository}' (HTTP 404)`);
      }
      throw new Error(`GitHub API returned HTTP ${res.status}: ${res.statusText || 'Error'}`);
    } catch (apiErr) {
      if (options.fetchFn) throw apiErr;
      // If running locally without mock, attempt git ls-remote fallback
    }
  }

  // 2. Fallback: git ls-remote
  try {
    const gitUrl = token
      ? `https://x-access-token:${token}@github.com/${repository}.git`
      : `https://github.com/${repository}.git`;
    const gitRunner = options.gitRunner || execSync;
    const stdout = gitRunner(`git ls-remote ${gitUrl} ${targetRef}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: options.timeoutMs || 10000
    });
    const match = stdout.match(/^([0-9a-f]{40})\s+/i);
    if (match && isValidSha(match[1])) {
      return match[1].trim().toLowerCase();
    }
    throw new Error(`git ls-remote returned no matching ref for ${targetRef}`);
  } catch (gitErr) {
    throw new Error(`Failed to determine remote HEAD SHA for ${targetRef} from ${repository}: ${gitErr.message}`);
  }
}

/**
 * End-to-end freshness validation runner for deployment stage.
 *
 * @param {object} [options]
 * @returns {Promise<{ eligible: boolean, action: string, reason: string }>}
 */
export async function verifyDeploymentFreshness(options = {}) {
  const silent = options.silent || false;
  const workflowSha = options.workflowSha || process.env.WORKFLOW_SHA || process.env.GITHUB_SHA;
  const ref = options.ref || process.env.TARGET_REF || process.env.GITHUB_REF || 'refs/heads/main';
  const eventName = options.eventName || process.env.EVENT_NAME || process.env.GITHUB_EVENT_NAME || 'push';
  const metaPath = options.metaPath || defaultMetaPath;
  const distDir = options.distDir || defaultDistDir;

  if (!silent) {
    console.log(`[freshness-guard] Evaluating deployment revision freshness...`);
    console.log(`[freshness-guard] Workflow SHA: ${workflowSha}`);
    console.log(`[freshness-guard] Target Ref:   ${ref}`);
    console.log(`[freshness-guard] Event Name:   ${eventName}`);
  }

  // 1. Read artifact metadata if present
  let artifactSha = undefined;
  let distIntegrityMatch = undefined;

  try {
    const metaRaw = await readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaRaw);
    artifactSha = meta.commitSha;

    // Verify dist files match artifact checksums if dist is present
    try {
      const s = await stat(distDir);
      if (s.isDirectory() && meta.artifactSha256) {
        async function collectFiles(dir, base = '') {
          const entries = await readdir(dir, { withFileTypes: true });
          const results = [];
          for (const e of entries) {
            const rel = base ? `${base}/${e.name}` : e.name;
            const full = join(dir, e.name);
            if (e.isDirectory()) {
              results.push(...await collectFiles(full, rel));
            } else {
              results.push({ relPath: rel.replace(/\\/g, '/'), fullPath: full });
            }
          }
          return results;
        }

        const files = await collectFiles(distDir);
        files.sort((a, b) => a.relPath.localeCompare(b.relPath));
        const hasher = createHash('sha256');
        for (const f of files) {
          const buf = await readFile(f.fullPath);
          const fSha = createHash('sha256').update(buf).digest('hex');
          hasher.update(`${f.relPath}:${fSha}\n`);
        }
        distIntegrityMatch = (hasher.digest('hex') === meta.artifactSha256);
      }
    } catch {
      // dist directory not present or unreadable
    }
  } catch (err) {
    if (options.requireArtifactMetadata) {
      throw new Error(`Build metadata required but missing or invalid at ${metaPath}: ${err.message}`);
    }
  }

  // 2. Fetch remote HEAD SHA
  let remoteHeadSha;
  try {
    remoteHeadSha = await fetchRemoteHeadSha(options);
    if (!silent) {
      console.log(`[freshness-guard] Remote HEAD:   ${remoteHeadSha}`);
    }
  } catch (err) {
    const errorMsg = `Deployment blocked: Unable to determine current remote HEAD SHA for ${ref}: ${err.message}`;
    if (!silent) console.error(`[freshness-guard] ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // 3. Evaluate eligibility
  const result = evaluateDeploymentEligibility({
    workflowSha,
    remoteHeadSha,
    ref,
    eventName,
    artifactSha,
    distIntegrityMatch
  });

  // 4. Record outputs for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    try {
      await appendFile(process.env.GITHUB_OUTPUT, `eligible=${result.eligible}\naction=${result.action}\n`);
    } catch (ioErr) {
      console.warn(`[freshness-guard] Warning: failed to write to GITHUB_OUTPUT: ${ioErr.message}`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const summaryMarkdown = `### Deployment Freshness Guard\n\n` +
        `- **Status:** ${result.eligible ? '✅ Eligible for publication' : (result.action === 'skip' ? '⚠️ Skipped (outdated revision)' : '🛑 Blocked')}\n` +
        `- **Action:** \`${result.action}\`\n` +
        `- **Workflow SHA:** \`${workflowSha}\`\n` +
        `- **Remote HEAD SHA:** \`${remoteHeadSha}\`\n` +
        `- **Reason:** ${result.reason}\n\n`;
      await appendFile(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown);
    } catch {
      // Ignore summary write errors
    }
  }

  if (result.action === 'block') {
    const errorMsg = `Deployment BLOCKED: ${result.reason}`;
    if (!silent) console.error(`[freshness-guard] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (result.action === 'skip') {
    if (!silent) {
      console.log(`[freshness-guard] DEPLOYMENT SKIPPED: ${result.reason}`);
    }
    return result;
  }

  if (!silent) {
    console.log(`[freshness-guard] DEPLOYMENT PERMITTED: ${result.reason}`);
  }
  return result;
}

// Execute if run directly from CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  verifyDeploymentFreshness()
    .then(result => {
      if (!result.eligible) {
        process.exit(0);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error(`[freshness-guard] FATAL: ${err.message}`);
      process.exit(1);
    });
}

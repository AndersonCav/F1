import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, cp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';
import { checkSyntax } from '../scripts/check-syntax.mjs';
import { checkBudget } from '../scripts/check-budget.mjs';
import {
  evaluateDeploymentEligibility,
  fetchRemoteHeadSha,
  verifyDeploymentFreshness,
  isValidSha
} from '../scripts/verify-deployment-freshness.mjs';
import { recordBuildMetadata } from '../scripts/record-build-metadata.mjs';

test('Quality Gate Failure Simulations in isolated temporary fixtures', async t => {
  let tempRoot;

  t.beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'f1-gate-test-'));
  });

  t.afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  await t.test('Simulation 1: Missing required production asset causes build to fail', async () => {
    const fixtureDir = join(tempRoot, 'fixture-src');
    const fixtureDist = join(tempRoot, 'fixture-dist');
    // Copy a subset missing placeholder-driver.svg
    await cp('assets', join(fixtureDir, 'assets'), { recursive: true });
    await rm(join(fixtureDir, 'assets/images/placeholder-driver.svg'));

    await assert.rejects(
      async () => {
        await build({ rootDir: fixtureDir, distDir: fixtureDist, silent: true });
      },
      /Required production asset missing from source/
    );
  });

  await t.test('Simulation 2: JavaScript syntax error causes checkSyntax to fail', async () => {
    const fixtureDir = join(tempRoot, 'fixture-src');
    await cp('assets', join(fixtureDir, 'assets'), { recursive: true });
    // Inject a syntax error into a module
    await writeFile(join(fixtureDir, 'assets/js/api.js'), 'export function broken() { const = 123; }');

    await assert.rejects(
      async () => {
        await checkSyntax({ rootDir: fixtureDir, silent: true });
      },
      /Syntax check failed/
    );
  });

  await t.test('Simulation 3: CSP policy divergence between pages causes verifyDist to fail', async () => {
    const fixtureDist = join(tempRoot, 'fixture-dist');
    await cp('dist', fixtureDist, { recursive: true });
    // Alter CSP in one page
    const driversHtml = await readFile(join(fixtureDist, 'drivers.html'), 'utf8');
    const altered = driversHtml.replace("default-src 'self'", "default-src 'self' https://unauthorized.evil.test");
    await writeFile(join(fixtureDist, 'drivers.html'), altered);

    await assert.rejects(
      async () => {
        await verifyDist({ distDir: fixtureDist, silent: true });
      },
      /CSP policy in dist\/drivers\.html does not match other pages/
    );
  });

  await t.test('Simulation 4: Invalid Service Worker precache path causes verifyDist to fail', async () => {
    const fixtureDist = join(tempRoot, 'fixture-dist');
    await cp('dist', fixtureDist, { recursive: true });
    // Alter precache array in sw.js to reference missing file
    const swSource = await readFile(join(fixtureDist, 'sw.js'), 'utf8');
    const altered = swSource.replace("'./assets/css/styles-v7.css'", "'./assets/css/obsolete-styles.css'");
    await writeFile(join(fixtureDist, 'sw.js'), altered);

    await assert.rejects(
      async () => {
        await verifyDist({ distDir: fixtureDist, silent: true });
      },
      /sw\.js precaches missing file/
    );
  });

  await t.test('Simulation 5: Missing HTML entrypoint causes verifyDist to fail', async () => {
    const fixtureDist = join(tempRoot, 'fixture-dist');
    await cp('dist', fixtureDist, { recursive: true });
    // Delete teams.html
    await rm(join(fixtureDist, 'teams.html'));

    await assert.rejects(
      async () => {
        await verifyDist({ distDir: fixtureDist, silent: true });
      },
      /Missing required HTML entrypoint in dist: teams\.html/
    );
  });

  await t.test('Simulation 6: Forbidden development-only file in dist causes verifyDist to fail', async () => {
    const fixtureDist = join(tempRoot, 'fixture-dist');
    await cp('dist', fixtureDist, { recursive: true });
    // Inject development files
    await writeFile(join(fixtureDist, 'package.json'), '{"name":"leaked"}');

    await assert.rejects(
      async () => {
        await verifyDist({ distDir: fixtureDist, silent: true });
      },
      /Forbidden file found in production artifact: package\.json/
    );
  });

  await t.test('Simulation 7: Asset size budget violation causes checkBudget to fail', async () => {
    const fixtureDist = join(tempRoot, 'fixture-dist');
    await cp('dist', fixtureDist, { recursive: true });

    // Set artificially tight budget (e.g. 100 KB total dist budget)
    await assert.rejects(
      async () => {
        await checkBudget({
          distDir: fixtureDist,
          silent: true,
          budgets: { maxTotalDistBytes: 100 * 1024 }
        });
      },
      /Total package size .* exceeds budget/
    );
  });

  await t.test('Workflow structural and security verification', async () => {
    const deployYml = await readFile('.github/workflows/deploy.yml', 'utf8');
    const liveYml = await readFile('.github/workflows/live-audit.yml', 'utf8');

    // 1. Triggers
    assert.match(deployYml, /push:\s*\n\s+branches:\s*\[main\]/);
    assert.match(deployYml, /pull_request:\s*\n\s+branches:\s*\[main\]/);
    assert.match(deployYml, /workflow_dispatch:/);

    // 2. Top-level permissions
    assert.match(deployYml, /^permissions:\s*\n\s+contents:\s*read/m);

    // 3. Concurrency serialization
    assert.match(deployYml, /concurrency:\s*\n\s+group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}/);
    assert.match(deployYml, /cancel-in-progress:\s*\$\{\{\s*github\.ref\s*!=\s*'refs\/heads\/main'\s*\}\}/);

    // 4. Job dependencies
    assert.match(deployYml, /needs:\s*\[validate,\s*build-and-verify\]/);

    // 5. PR deployment prevention
    assert.match(deployYml, /if:\s*github\.ref\s*==\s*'refs\/heads\/main'\s*&&\s*\(github\.event_name\s*==\s*'push'\s*\|\|\s*github\.event_name\s*==\s*'workflow_dispatch'\)/);

    // 6. Artifact path is dist (never .)
    assert.match(deployYml, /path:\s*dist/);
    assert.doesNotMatch(deployYml, /path:\s*['"]?\./);

    // 7. Mandatory checks in validate job
    assert.match(deployYml, /npm run check:syntax/);
    assert.match(deployYml, /npm run check:csp/);
    assert.match(deployYml, /npm run check:whitespace/);
    assert.match(deployYml, /npm test/);
    assert.match(deployYml, /npm run test:browser/);

    // 8. Mandatory checks in build-and-verify job
    assert.match(deployYml, /npm run build/);
    assert.match(deployYml, /npm run check:dist/);
    assert.match(deployYml, /npm run check:budget/);
    assert.match(deployYml, /node --test tests\/dist-integrity\.test\.js/);
    assert.match(deployYml, /node scripts\/record-build-metadata\.mjs/);
    assert.match(deployYml, /name:\s*build-metadata/);

    // 9. Deployment stage revision freshness guard
    assert.match(deployYml, /node scripts\/verify-deployment-freshness\.mjs/);
    assert.match(deployYml, /steps\.freshness-check\.outputs\.eligible\s*==\s*'true'/);
    assert.match(deployYml, /steps\.freshness-check\.outputs\.eligible\s*!=\s*'true'/);
    assert.match(deployYml, /concurrency:\s*\n\s+group:\s*['"]pages['"]\s*\n\s+cancel-in-progress:\s*false/);

    // 10. Safe environment parameter passing without unsafe shell interpolation
    assert.doesNotMatch(deployYml, /run:.*node scripts\/verify-deployment-freshness\.mjs.*\$\{\{\s*github\.sha\s*\}\}/);

    // 11. Separate live audit workflow
    assert.match(liveYml, /schedule:/);
    assert.match(liveYml, /cron:\s*'0 12 \* \* 1'/);
    assert.match(liveYml, /npm run test:api:live/);
    assert.match(liveYml, /npm run audit:images:live/);
    assert.match(liveYml, /npm run test:browser:live/);
    assert.doesNotMatch(liveYml, /deploy-pages/);
  });
});

test('Deployment Concurrency Hardening & Revision Freshness Gates (Phase 3.1)', async t => {
  let tempRoot;

  t.beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'f1-freshness-test-'));
  });

  t.afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  await t.test('Scenario 1: Workflow SHA equals current remote main SHA: deployment is eligible', () => {
    const matchingSha = '1111222233334444555566667777888899990000';
    const result = evaluateDeploymentEligibility({
      workflowSha: matchingSha,
      remoteHeadSha: matchingSha,
      ref: 'refs/heads/main',
      eventName: 'push',
      artifactSha: matchingSha
    });

    assert.equal(result.eligible, true);
    assert.equal(result.action, 'deploy');
    assert.match(result.reason, /matches current remote refs\/heads\/main HEAD/);
  });

  await t.test('Scenario 2: Workflow SHA differs from current main: deployment is skipped', () => {
    const staleWorkflowSha = 'aaaa111122223333444455556666777788889999';
    const currentRemoteSha = 'bbbb111122223333444455556666777788889999';
    const result = evaluateDeploymentEligibility({
      workflowSha: staleWorkflowSha,
      remoteHeadSha: currentRemoteSha,
      ref: 'refs/heads/main',
      eventName: 'push',
      artifactSha: staleWorkflowSha
    });

    assert.equal(result.eligible, false);
    assert.equal(result.action, 'skip');
    assert.match(result.reason, /is outdated/);
  });

  await t.test('Scenario 3: Current branch SHA cannot be retrieved: deployment is blocked (fail-closed)', async () => {
    // 3a. Network failure during API query rejects
    await assert.rejects(
      async () => {
        await fetchRemoteHeadSha({
          repository: 'AndersonCav/F1',
          ref: 'refs/heads/main',
          fetchFn: async () => {
            throw new Error('Connection refused / DNS lookup failed');
          }
        });
      },
      /Connection refused/
    );

    // 3b. HTTP 500 error from API rejects
    await assert.rejects(
      async () => {
        await fetchRemoteHeadSha({
          repository: 'AndersonCav/F1',
          ref: 'refs/heads/main',
          fetchFn: async () => ({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
          })
        });
      },
      /HTTP 500/
    );

    // 3c. verifyDeploymentFreshness runner fails closed when remote cannot be fetched
    await assert.rejects(
      async () => {
        await verifyDeploymentFreshness({
          workflowSha: '1111222233334444555566667777888899990000',
          ref: 'refs/heads/main',
          eventName: 'push',
          silent: true,
          fetchFn: async () => {
            throw new Error('Remote host unavailable');
          }
        });
      },
      /Deployment blocked: Unable to determine current remote HEAD SHA/
    );
  });

  await t.test('Scenario 4: Retrieved SHA is malformed: deployment is blocked', async () => {
    // 4a. API returns non-hex or invalid SHA
    await assert.rejects(
      async () => {
        await fetchRemoteHeadSha({
          repository: 'AndersonCav/F1',
          ref: 'refs/heads/main',
          fetchFn: async () => ({
            ok: true,
            json: async () => ({ object: { sha: 'not-a-valid-40-hex-sha' } })
          })
        });
      },
      /invalid commit SHA structure/
    );

    // 4b. Malformed remote SHA in decision function blocks
    assert.throws(
      () => {
        evaluateDeploymentEligibility({
          workflowSha: '1111222233334444555566667777888899990000',
          remoteHeadSha: 'xyz-corrupted-hash',
          ref: 'refs/heads/main',
          eventName: 'push'
        });
      },
      /Malformed remote HEAD SHA: xyz-corrupted-hash/
    );

    // 4c. Malformed workflow SHA in decision function blocks
    assert.throws(
      () => {
        evaluateDeploymentEligibility({
          workflowSha: 'too-short',
          remoteHeadSha: '1111222233334444555566667777888899990000',
          ref: 'refs/heads/main',
          eventName: 'push'
        });
      },
      /Malformed workflow SHA: too-short/
    );
  });

  await t.test('Scenario 5: Empty SHA or missing metadata: deployment is blocked', () => {
    // Empty workflow SHA
    assert.throws(
      () => {
        evaluateDeploymentEligibility({
          workflowSha: '',
          remoteHeadSha: '1111222233334444555566667777888899990000',
          ref: 'refs/heads/main'
        });
      },
      /Missing or empty workflow SHA/
    );

    // Whitespace workflow SHA
    assert.throws(
      () => {
        evaluateDeploymentEligibility({
          workflowSha: '   ',
          remoteHeadSha: '1111222233334444555566667777888899990000',
          ref: 'refs/heads/main'
        });
      },
      /Missing or empty workflow SHA/
    );

    // Empty remote HEAD SHA
    assert.throws(
      () => {
        evaluateDeploymentEligibility({
          workflowSha: '1111222233334444555566667777888899990000',
          remoteHeadSha: '',
          ref: 'refs/heads/main'
        });
      },
      /Missing or empty remote HEAD SHA/
    );

    // Undefined parameters
    assert.throws(
      () => {
        evaluateDeploymentEligibility({});
      },
      /Missing or empty workflow SHA/
    );
  });

  await t.test('Scenario 6: Pull-request execution: production deployment is prohibited', () => {
    const validSha = '1111222233334444555566667777888899990000';

    // PR event with main ref
    const prResult = evaluateDeploymentEligibility({
      workflowSha: validSha,
      remoteHeadSha: validSha,
      ref: 'refs/heads/main',
      eventName: 'pull_request',
      artifactSha: validSha
    });
    assert.equal(prResult.eligible, false);
    assert.equal(prResult.action, 'block');
    assert.match(prResult.reason, /prohibited for pull_request/);

    // PR ref (refs/pull/...)
    const branchResult = evaluateDeploymentEligibility({
      workflowSha: validSha,
      remoteHeadSha: validSha,
      ref: 'refs/pull/15/merge',
      eventName: 'push',
      artifactSha: validSha
    });
    assert.equal(branchResult.eligible, false);
    assert.equal(branchResult.action, 'block');
    assert.match(branchResult.reason, /only 'refs\/heads\/main' permitted/);
  });

  await t.test('Scenario 7: Manual execution from an outdated revision: deployment is prohibited', () => {
    const staleDispatchSha = '3333000011112222333344445555666677778888';
    const latestRemoteSha = '4444000011112222333344445555666677778888';

    const result = evaluateDeploymentEligibility({
      workflowSha: staleDispatchSha,
      remoteHeadSha: latestRemoteSha,
      ref: 'refs/heads/main',
      eventName: 'workflow_dispatch',
      artifactSha: staleDispatchSha
    });

    assert.equal(result.eligible, false);
    assert.equal(result.action, 'skip');
    assert.match(result.reason, /is outdated/);
  });

  await t.test('Scenario 8: Older workflow completes after newer workflow: older deployment is rejected', () => {
    // Commit 1 was superseded on remote main by Commit 2
    const commit1Sha = '1010101010101010101010101010101010101010';
    const commit2Sha = '2020202020202020202020202020202020202020';

    const result = evaluateDeploymentEligibility({
      workflowSha: commit1Sha,
      remoteHeadSha: commit2Sha,
      ref: 'refs/heads/main',
      eventName: 'push',
      artifactSha: commit1Sha
    });

    assert.equal(result.eligible, false);
    assert.equal(result.action, 'skip');
    assert.match(result.reason, /Workflow revision 1010101010101010101010101010101010101010 is outdated/);
  });

  await t.test('Scenario 9: Newer revision fails validation: no invalid artifact is deployed', async () => {
    // In GitHub Actions, deploy job requires [validate, build-and-verify]
    const deployYml = await readFile('.github/workflows/deploy.yml', 'utf8');
    assert.match(deployYml, /needs:\s*\[validate,\s*build-and-verify\]/);

    // Verify syntax failure stops validate job
    const fixtureDir = join(tempRoot, 'fixture-fail');
    await mkdir(join(fixtureDir, 'assets/js'), { recursive: true });
    await writeFile(join(fixtureDir, 'assets/js/broken.js'), 'export const syntaxError = ;;;');
    await assert.rejects(
      async () => {
        await checkSyntax({ rootDir: fixtureDir, silent: true });
      },
      /Syntax check failed/
    );
  });

  await t.test('Scenario 10: Artifact revision differs from validated workflow revision: deployment is rejected', () => {
    const validatedWorkflowSha = '5555555555555555555555555555555555555555';
    const mismatchedArtifactSha = '7777777777777777777777777777777777777777';

    const result = evaluateDeploymentEligibility({
      workflowSha: validatedWorkflowSha,
      remoteHeadSha: validatedWorkflowSha,
      ref: 'refs/heads/main',
      eventName: 'push',
      artifactSha: mismatchedArtifactSha
    });

    assert.equal(result.eligible, false);
    assert.equal(result.action, 'block');
    assert.match(result.reason, /Artifact revision mismatch/);
  });

  await t.test('Build metadata recording and artifact provenance verification end-to-end', async () => {
    const fixtureDist = join(tempRoot, 'dist');
    const fixtureMeta = join(tempRoot, 'build-metadata');
    await cp('dist', fixtureDist, { recursive: true });

    const testSha = 'abcdef0123456789abcdef0123456789abcdef01';
    const { metadata } = await recordBuildMetadata({
      distDir: fixtureDist,
      metaDir: fixtureMeta,
      commitSha: testSha,
      ref: 'refs/heads/main',
      silent: true
    });

    assert.equal(metadata.commitSha, testSha);
    assert.equal(metadata.fileCount, 27);
    assert.ok(metadata.artifactSha256);
    assert.equal(metadata.files.length, 27);

    // Verify freshness check with matching recorded metadata
    const freshResult = await verifyDeploymentFreshness({
      workflowSha: testSha,
      ref: 'refs/heads/main',
      eventName: 'push',
      metaPath: join(fixtureMeta, 'metadata.json'),
      distDir: fixtureDist,
      mockRemoteSha: testSha,
      silent: true
    });

    assert.equal(freshResult.eligible, true);
    assert.equal(freshResult.action, 'deploy');

    // Tampering test: modify a file in dist -> integrity check fails and blocks deployment
    const indexHtml = await readFile(join(fixtureDist, 'index.html'), 'utf8');
    await writeFile(join(fixtureDist, 'index.html'), indexHtml + '<!-- tampered comment -->');

    await assert.rejects(
      async () => {
        await verifyDeploymentFreshness({
          workflowSha: testSha,
          ref: 'refs/heads/main',
          eventName: 'push',
          metaPath: join(fixtureMeta, 'metadata.json'),
          distDir: fixtureDist,
          mockRemoteSha: testSha,
          silent: true
        });
      },
      /Production artifact integrity mismatch/
    );
  });
});


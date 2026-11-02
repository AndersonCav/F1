import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';
import { checkSyntax } from '../scripts/check-syntax.mjs';
import { checkBudget } from '../scripts/check-budget.mjs';

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

    // 3. Job dependencies
    assert.match(deployYml, /needs:\s*\[validate,\s*build-and-verify\]/);

    // 4. PR deployment prevention
    assert.match(deployYml, /if:\s*github\.ref\s*==\s*'refs\/heads\/main'\s*&&\s*\(github\.event_name\s*==\s*'push'\s*\|\|\s*github\.event_name\s*==\s*'workflow_dispatch'\)/);

    // 5. Artifact path is dist (never .)
    assert.match(deployYml, /path:\s*dist/);
    assert.doesNotMatch(deployYml, /path:\s*['"]?\./);

    // 6. Mandatory checks in validate job
    assert.match(deployYml, /npm run check:syntax/);
    assert.match(deployYml, /npm run check:csp/);
    assert.match(deployYml, /npm run check:whitespace/);
    assert.match(deployYml, /npm test/);
    assert.match(deployYml, /npm run test:browser/);

    // 7. Mandatory checks in build-and-verify job
    assert.match(deployYml, /npm run build/);
    assert.match(deployYml, /npm run check:dist/);
    assert.match(deployYml, /npm run check:budget/);
    assert.match(deployYml, /node --test tests\/dist-integrity\.test\.js/);

    // 8. Separate live audit workflow
    assert.match(liveYml, /schedule:/);
    assert.match(liveYml, /cron:\s*'0 12 \* \* 1'/);
    assert.match(liveYml, /npm run test:api:live/);
    assert.match(liveYml, /npm run audit:images:live/);
    assert.match(liveYml, /npm run test:browser:live/);
    assert.doesNotMatch(liveYml, /deploy-pages/);
  });
});

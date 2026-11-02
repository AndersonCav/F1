import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CHAMPIONS_HISTORY, PLACEHOLDER_DRIVER_IMAGE } from '../assets/js/static-data.js';
import { createWorker } from './helpers/sw-harness.js';

// Independently reviewed source/identity/license evidence, not fetched during unit tests.
const audit = JSON.parse(await readFile(new URL('../docs/phase-1.1/image-audit.json', import.meta.url)));
const previousAudit = [...audit.records];
audit.records.push(...JSON.parse(await readFile(new URL('../docs/phase-2/image-audit.json', import.meta.url))).records);
const imageOrigins = new Set(['https://upload.wikimedia.org', 'https://thumb.wikimedia.org']);

for (const champion of CHAMPIONS_HISTORY) {
  test(`approved photograph and attribution remain associated with ${champion.name}`, () => {
    const approved = audit.records.find(record => record.name === champion.name);
    assert.ok(approved, 'New records require an image and license review');
    const url = new URL(champion.photo);
    assert.equal(url.protocol, 'https:');
    assert.ok(imageOrigins.has(url.origin));
    assert.equal(url.username + url.password + url.hash, '');
    assert.ok(url.pathname.startsWith('/wikipedia/commons/'));
    assert.equal(champion.photo, approved.replacement.url, 'Do not silently swap people or sources');
    assert.equal(approved.replacement.status, 200);
    assert.equal(approved.replacement.contentType, 'image/jpeg');
    assert.match(approved.replacement.sha256, /^[a-f0-9]{64}$/);
    assert.ok(approved.replacement.width > 0 && approved.replacement.height > 0);
    assert.deepEqual(champion.photoCredit, approved.replacement.credit);
    for (const field of ['attribution', 'sourceUrl', 'license', 'licenseUrl']) {
      assert.ok(champion.photoCredit[field]?.trim(), `Missing ${field}`);
    }
    const source = new URL(champion.photoCredit.sourceUrl);
    assert.equal(source.origin, 'https://commons.wikimedia.org');
    assert.equal(decodeURIComponent(source.pathname.slice('/wiki/'.length)).replaceAll('_', ' '),
      approved.replacement.sourceFile.replaceAll('_', ' '));
    const license = new URL(champion.photoCredit.licenseUrl);
    assert.equal(license.protocol, 'https:');
    assert.ok(['https://creativecommons.org', 'https://commons.wikimedia.org', 'https://www.nationalarchives.gov.uk'].includes(license.origin));
    assert.match(champion.photoCredit.license, /^(CC BY(?:-SA)? [234]\.0(?: de| nl)?|CC0|Public domain|OGL 3)$/);
    assert.ok(approved.replacement.licenseBasis);
    assert.ok(approved.replacement.identityEvidence.url.startsWith('https:'));
  });
}

test('all 35 approved champions have distinct photograph resources and complete audit entries', () => {
  assert.equal(CHAMPIONS_HISTORY.length, 35);
  assert.equal(audit.records.length, 35);
  assert.equal(new Set(CHAMPIONS_HISTORY.map(champion => champion.name)).size, 35);
  assert.equal(new Set(CHAMPIONS_HISTORY.map(champion => champion.photo)).size, 35);
  assert.deepEqual(CHAMPIONS_HISTORY.map(champion => champion.name).sort(), audit.records.map(record => record.name).sort());
  assert.equal(previousAudit.length, 33);
});

test('Phase 2 preserves all 33 existing photographs, credits, title years and relative record order', async () => {
  const baseline = JSON.parse(await readFile(new URL('../docs/phase-2/initial-state.json', import.meta.url))).champions;
  assert.equal(createHash('sha256').update(JSON.stringify(baseline.map(({ photo, photoCredit, ...record }) => record))).digest('hex'), audit.nonImageDataSha256);
  const existing = CHAMPIONS_HISTORY.filter(c => baseline.some(b => b.name === c.name));
  assert.deepEqual(existing.map(c => c.name), baseline.map(c => c.name));
  for (const before of baseline) {
    const after = existing.find(c => c.name === before.name);
    for (const field of ['name', 'nationality', 'teams', 'titleYears', 'photo', 'photoCredit']) assert.deepEqual(after[field], before[field]);
    assert.equal(after.wins, before.name === 'Max Verstappen' ? 71 : before.wins);
  }
});

test('the local fallback is a real SVG and stays in the expanded 27-resource mandatory shell', async () => {
  await access(new URL(PLACEHOLDER_DRIVER_IMAGE));
  assert.match(await readFile(new URL(PLACEHOLDER_DRIVER_IMAGE), 'utf8'), /<svg\b/);
  const assets = createWorker().ASSETS_TO_CACHE;
  assert.equal(assets.length, 27);
  assert.ok(assets.includes('./assets/images/placeholder-driver.svg'));
  assert.ok(!assets.some(path => /wikimedia|champions\/.+\.(jpg|webp)/.test(path)));
});

test('special public-domain grants and OGL notice remain documented', () => {
  for (const record of previousAudit.filter(record => record.replacement.credit.license === 'Public domain')) {
    assert.match(record.replacement.licenseBasis, /PD-/);
    assert.ok(record.replacement.credit.licenseUrl.endsWith('#Licensing'));
  }
  const farina = CHAMPIONS_HISTORY.find(champion => champion.id === 'farina');
  assert.equal(farina.photoCredit.licenseUrl, 'https://creativecommons.org/licenses/by/4.0');
  assert.match(CHAMPIONS_HISTORY.find(champion => champion.name === 'Lewis Hamilton').photoCredit.attribution,
    /Contains public sector information licensed under the Open Government Licence v3\.0/);
});

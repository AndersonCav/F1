import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CHAMPIONS_HISTORY, PLACEHOLDER_DRIVER_IMAGE } from '../assets/js/static-data.js';
import { createWorker } from './helpers/sw-harness.js';

// Independently reviewed source/identity/license evidence, not fetched during unit tests.
const audit = JSON.parse(await readFile(new URL('../docs/phase-1.1/image-audit.json', import.meta.url)));
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

test('all 33 approved champions have distinct photograph resources and complete audit entries', () => {
  assert.equal(CHAMPIONS_HISTORY.length, 33);
  assert.equal(audit.records.length, 33);
  assert.equal(new Set(CHAMPIONS_HISTORY.map(champion => champion.name)).size, 33);
  assert.equal(new Set(CHAMPIONS_HISTORY.map(champion => champion.photo)).size, 33);
  assert.deepEqual(CHAMPIONS_HISTORY.map(champion => champion.name), audit.records.map(record => record.name));
});

test('image recovery preserves every historical field and record order from Phase 1', () => {
  const historicalData = CHAMPIONS_HISTORY.map(({ photo, photoCredit, ...record }) => record);
  assert.equal(createHash('sha256').update(JSON.stringify(historicalData)).digest('hex'), audit.nonImageDataSha256);
});

test('the local fallback is a real SVG and stays in the unchanged 18-resource mandatory shell', async () => {
  await access(new URL(PLACEHOLDER_DRIVER_IMAGE));
  assert.match(await readFile(new URL(PLACEHOLDER_DRIVER_IMAGE), 'utf8'), /<svg\b/);
  const assets = createWorker().ASSETS_TO_CACHE;
  assert.equal(assets.length, 18);
  assert.ok(assets.includes('./assets/images/placeholder-driver.svg'));
  assert.ok(!assets.some(path => /wikimedia|champions\/.+\.(jpg|webp)/.test(path)));
});

test('special public-domain grants and OGL notice remain documented', () => {
  for (const record of audit.records.filter(record => record.replacement.credit.license === 'Public domain')) {
    assert.match(record.replacement.licenseBasis, /PD-/);
    assert.ok(record.replacement.credit.licenseUrl.endsWith('#Licensing'));
  }
  assert.match(CHAMPIONS_HISTORY.find(champion => champion.name === 'Lewis Hamilton').photoCredit.attribution,
    /Contains public sector information licensed under the Open Government Licence v3\.0/);
});

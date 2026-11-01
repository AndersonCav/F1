import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export const { chromium } = await import(process.env.F1_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.F1_PLAYWRIGHT_MODULE).href : 'playwright');
export const launchOptions = { headless: true,
  ...(process.env.F1_BROWSER_EXECUTABLE ? { executablePath: process.env.F1_BROWSER_EXECUTABLE } : { channel: 'chrome' }) };

export async function observe(context) {
  await context.addInitScript(() => {
    window.imageAudit = { violations: [], rejections: [], failures: {} };
    document.addEventListener('securitypolicyviolation', event => imageAudit.violations.push({ directive: event.effectiveDirective, uri: event.blockedURI }));
    window.addEventListener('unhandledrejection', event => imageAudit.rejections.push(String(event.reason)));
    document.addEventListener('error', event => {
      if (event.target instanceof HTMLImageElement) {
        const key = event.target.alt;
        imageAudit.failures[key] = (imageAudit.failures[key] || 0) + 1;
      }
    }, true);
  });
}

export async function loadAll(page) {
  await page.locator('.champion-card').first().waitFor();
  // Only the audit forces eagerly loading offscreen images. Production remains lazy.
  await page.locator('.portrait').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => document.querySelectorAll('.portrait').length === 33 &&
    [...document.querySelectorAll('.portrait')].every(image => image.complete), null, { timeout: 45000 });
  return page.locator('.champion-card').evaluateAll(cards => cards.map(card => {
    const image = card.querySelector('img');
    return { name: card.querySelector('.name').textContent, url: image.currentSrc,
      alt: image.alt, width: image.naturalWidth, height: image.naturalHeight,
      fallback: image.currentSrc.endsWith('/placeholder-driver.svg') };
  }));
}

export async function assertClean(page, errors) {
  const state = await page.evaluate(() => imageAudit);
  assert.deepEqual(state.violations, []);
  assert.deepEqual(state.rejections, []);
  assert.deepEqual(errors, []);
}

# F1 Portal · Race Center preview

An isolated Vue 3, Vite and Bootstrap 6 experiment. The stable portal, its URLs, root dependencies, build, deployment workflow and worker are unchanged. This application is **not published**.

From the repository root, using Node 22.22.2+, 24.15+ or 26+ (verified with Node 26.13.0). These ranges include the test environment's jsdom requirement:

```powershell
cd experience
npm ci --ignore-scripts --include=optional
npm run dev
```

Development: <http://127.0.0.1:5175/F1/experience/>. Vite's HMR requires a development-only inline-style allowance and its local WebSocket. The configuration applies that allowance only while serving source. The built HTML retains the strict CSP.

```powershell
npm run build
npm run preview
```

Production preview: <http://127.0.0.1:4175/F1/experience/>. Build output is `experience/dist-preview/`, ignored by Git and separate from the root `dist/`. Its own budget is checked during every build. No command here publishes files or triggers a workflow.

```powershell
npm test
npm run test:browser
npm run measure
node scripts/visuals.mjs
```

The browser, accessibility and measurement scripts reuse the root's pinned Playwright and axe packages, so run root `npm ci` first on a new checkout. Chrome is used by default, matching the existing suites. The existing `F1_BROWSER_CHANNEL` and `F1_BROWSER_EXECUTABLE` overrides remain supported. Browser tests build against the latest `dist-preview/`; run `npm run build` before them. Tests use a second local port, 4185; measurement uses 4186/4189 for the new/legacy builds, and screenshots use 4187.

`node scripts/legacy-browser-regression.mjs` runs the four existing controlled browser suites and restores their original evidence files byte for byte. `node scripts/legacy-live-regression.mjs` runs the optional existing live API, pages and photograph checks, preserves the older API report and stores new summaries under `docs/phase-5/validation/`.

## Data and scope

- Runtime data comes exclusively from existing, tested modules under `assets/js/`. Jolpica transport validates identifiers, season, round and response completeness, deduplicates pending requests, caches for one hour and falls back to valid data up to seven days old without renewing timestamps.
- Presentation adapters retain unknown values, season-specific teams, multiple constructors, replacement drivers and the explicitly dated archive through 2025. Race results must also match the calendar's circuit, date, round and confirmed-event rules.
- The champions gallery imports the existing 35 records, exact photograph URLs and all career/photograph/license sources. Current-season reference photography and team metadata retain their original verification periods. A failed photograph receives an explicitly unavailable local silhouette.
- The Race Center compares **championship** metrics for the selected season. Qualifying, sprint, practice sessions, individual laps and telemetry show unavailable states. No OpenF1 or F1DB requests are made.
- `tests/fixtures/jolpica-recording.json` is a validated capture of real source responses dated in its metadata. It is used only in tests. `scripts/record-fixtures.mjs` deliberately refreshes that recording; it is not part of application loading or ordinary testing. Controlled error/empty/loading scenarios are test states, not sporting claims.

## Routing and offline behavior

Hash routes work under the explicit `/F1/experience/` base, including refreshes and direct links. Search, filters, sorting and comparison identifiers live in the hash query; the Race Center adds season, round, session and panel state. Invalid query values cannot become API routes.

The production preview registers **its own** worker at `/F1/experience/experience-sw.js`, with only `/F1/experience/` scope and `f1-experience-*` caches. It never reads or removes the stable portal's caches. The dashboard shell, fonts and fallback image are precached. Other route code caches when visited, preserving lazy loading. A route not yet visited may require a connection; a failed lazy navigation has an accessible recovery message. Sporting data uses the existing transport cache and its seven-day validity limit. Remote photographs are not precached. Offline startup still requires a prior online installation; browser storage eviction can remove cached resources.

## Future promotion (requires separate authorization)

Preserve `/F1/`, `index.html`, `drivers.html`, `teams.html`, `champions.html`, `calendar.html` and `404.html`. Proposed mappings are `/F1/` → overview, `drivers.html` → drivers, `teams.html` → constructors, `champions.html` → champions and `calendar.html` → calendar. Preserve legacy search/sort parameters through explicit compatibility pages and test links/bookmarks before choosing redirects. Hash queries belong after `#/route`; do not silently reinterpret legacy query strings.

Before a promotion, reconcile the root worker scope, CSP, asset allowlist, canonical URLs, sitemap, offline migration, deployment provenance and revised production budgets through a separately reviewed migration. No redirect, production link, Pages workflow or root worker change is included here.

See [the Phase 5 report](../docs/phase-5/REPORT.md), [design system](../docs/phase-5/DESIGN-SYSTEM.md) and [visual gallery](../docs/phase-5/GALLERY.md).

Redistributed framework/layout/font license texts are preserved in [third-party notices](public/third-party-notices.txt), also included in the static build. Dashboard avatars resize the same verified F1 asset; the original catalog URLs and detailed-view portraits remain intact.

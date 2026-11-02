# Phase 5 — F1 Interactive Experience

`PHASE_5_COMPLETE_WITH_DEBT`

A separate, working Vue race center is implemented in `experience/`. The stable portal remains intact and unpublished changes are confined to the new application and this evidence directory. Remaining debt concerns startup performance, development-only dependency advisories, broader assistive-technology/browser validation and production promotion work; it does not substitute placeholder sporting results for required functionality.

## 1. Phase status

The seven requested views run locally and produce an isolated static production preview. Bootstrap 6, dependencies, routing, build output, tests and the preview worker are isolated from the existing site. No commit, push, merge, deployment, Actions trigger or repository-settings change was performed.

## 2. Initial repository audit

- Branch: `main`; HEAD: `952f31ad630e06223a6e0784b83d1dbaa8e04bdd`.
- Initial index and working tree: clean, with no staged, unstaged or untracked work. This differs from the pasted Phase 4 report's earlier uncommitted state: Phase 4 is already present in this HEAD.
- Baseline: native ES modules, six root HTML pages, validated Jolpica transport/domain functions, an immutable champions archive through 2025, season-scoped metadata, cache resilience and the v6 production worker.
- The original `check:all` passes: 253 Node tests, syntax, CSP, whitespace, production packaging/integrity and the existing 250 KiB budget. Packaging remains 32 allowlisted files, about 234.05 KiB; CSS 16.67 KiB and JavaScript 139.76 KiB.
- [Initial audit](validation/initial-audit.json), [baseline command log](validation/legacy-baseline.txt) and [SHA-256 inventory](validation/legacy-hashes.json) record the starting state. Existing test-generated reports were backed up and restored byte for byte rather than discarded with Git operations.

## 3. Architecture decisions

| Decision | Implementation and purpose |
| --- | --- |
| Vue | Vue 3.5.44, Composition API and SFCs with `script setup`; predictable computed models and explicit events. A small shared resource composable replaces the need for Pinia/Vuex. |
| Vite | Vite 8.3.5 and Vue plugin 6.0.10, exact versions and a separate lockfile. All seven route components are lazy imports; comparison code is also lazy inside Race Center. ES2022 output; no unnecessary polyfills. |
| Bootstrap | Exact requested 6.0.0-alpha.1. Official Vite, installation and color skills were inspected from the upstream repository. Only Sass container/grid/label foundations compile through `@use`; no Bootstrap JS owns Vue's DOM. |
| Routing | Vue Router 5.4.0, hash history and explicit `/F1/experience/` base. Queries retain search, filters, sorts, comparison, season, round, session and panel state. Pending query changes merge so fast control updates cannot overwrite each other. |
| Data | Existing root API, decoder, season helpers, metadata, constructor history and champion history are imported without changes. Adapters normalize state/provenance/nulls and preserve multi-constructor participation. Race results additionally require a matching calendar identity, date, round and verified completion. |
| State | Current season comes from the API, not the clock. Resource failures are independent, stale timestamps remain unchanged and generation counters prevent old season responses overwriting a newer selection. Shared navigation causes no duplicate API requests. |
| Charts | Small Vue/CSS bars, visible values/units and semantic table alternatives. No chart library or invented interpolation; smaller championship position is explicitly explained as better. |
| Assets | Three local Latin WOFF2 weights, two preloads, original small SVG icons and a neutral unavailable-photo silhouette. ID/full-name reference lookup follows the legacy behavior; dashboard avatars use 96px variants of the same source image. Verified remote photo URLs and original credits remain available. Assets are emitted as files so strict CSP needs neither data images nor inline scripts/styles. |
| Isolation | Ports 5175/4175; output `experience/dist-preview/`, ignored by the application-local `.gitignore`. Root package/lock, public URLs, allowlist, workflow and worker remain unchanged. |
| Offline | An independently generated worker is registered only for `/F1/experience/`, with separate cache names. The core dashboard shell is precached; other route modules cache when visited. Never-visited offline routes have an accessible recovery path. API retention continues to use the existing tested transport. |

Compatibility was checked against package-registry metadata and [Vue's official quick start](https://vuejs.org/guide/quick-start.html), [Vite's official guide](https://vite.dev/guide/) and the upstream [Bootstrap Vite skill](https://github.com/twbs/bootstrap/blob/main/skills/bootstrap-vite/SKILL.md), [installation skill](https://github.com/twbs/bootstrap/blob/main/skills/bootstrap-v6-install/SKILL.md) and [color skill](https://github.com/twbs/bootstrap/blob/main/skills/bootstrap-color-system/SKILL.md). The Bootstrap web-guide URL was unavailable through the web reader; upstream skills and installed source were inspected directly. Node 26.13.0/npm 11.20.0 were used locally.

The development-only Vite HTML transform permits HMR-injected styles and its localhost WebSocket. Built HTML keeps strict `script-src 'self'`, `style-src 'self'`, `style-src-attr 'none'`, approved image/API origins, no objects and no forms. No credential or new data-provider integration is introduced. There is no `v-html` or Bootstrap DOM plugin.

## 4. Implemented features

| View | Working behavior |
| --- | --- |
| Dashboard | Next GP, circuit/location/round/season, local scheduled start and real countdown; last-race podium and times; confirmed-results count; driver and constructor championship tables with points/wins; direct race/detail navigation. No fabricated track outline or live status. |
| Drivers | Large existing photos, unavailable-image fallback, number, source nationality, represented constructor(s), position, points and season wins. Instant name search, constructor filter, sort, keyboard disclosure, URL state and a two-driver selection tray. |
| Constructors | Ranked team cards, verified season colors/cars where available, points/wins, participant links and expandable technical/reference information. Search/sort work reactively. Historical titles are explicitly bounded to 2025 and never inherit an unknown brand's history. |
| Champions | All 35 original champions, complete title years and counts, original photographs, career sources and all photograph/license references. Name/accent search, era selection, sort and native career/credit disclosures. Works independently of sporting API availability. |
| Calendar | All published rounds, local dates/times, circuits/countries, next-event focus jump, status filters and event links. Only matching published winners can mark an event completed. Elapsed start alone remains pending. |
| Comparison | Distinct same-season drivers, points/wins/positions and separately scoped world-title archive through 2025. Bars and a table expose actual values. Missing archive/data is unavailable; no unverified poles or podium counts. |
| Race Center | Season selector 1950 through the API's current season; GP and session selection; published final results, laps, points and time/status. Selectable results/comparison/timing panels, per-result freshness and honest unavailable session/telemetry states. Championship comparison is labeled separately from session performance. |

## 5. Visual design and evidence

The design uses charcoal panels, an original slash identity, red structural accents, strong italic headings, restrained diagonal geometry, team accents and aligned rankings. It is a new application shell and component system, not a replacement stylesheet for the root site.

See the [design system](DESIGN-SYSTEM.md) and [curated visual gallery](GALLERY.md). Nine main captures cover the desktop/mobile dashboard and every view, including an expanded driver profile. Four additional captures show clearly labeled controlled loading, empty, failure and long-name/missing-image states. Real-provider captures may contain truthful unavailable-photo fallbacks; their individual image decode metadata is retained in [visuals.json](validation/visuals.json).

## 6. Accessibility

- Fourteen axe audits cover seven views at 390px and 1440px, including expanded details and comparison/results content, using WCAG 2/2.1/2.2 A/AA tags and best practices. Final results are recorded in [browser.json](validation/browser.json).
- Browser keyboard checks exercise native disclosures, mobile drawer initial focus, Tab/Shift+Tab containment, Escape/opener restoration, route heading focus, next-race focus and comparison selection. Retry failures restore focus. Inputs/buttons have at least 44px dimensions in the tested touch layout.
- Charts retain names, numbers, units and table alternatives. Results tables have captions and scoped headers inside a labeled keyboard-scrollable region. Statuses have explicit text rather than only color.
- Reduced-motion and responsive checks cover all six required widths and 844×390 landscape. Every route is checked for page overflow; long names and failed images receive a separate stress case.
- Manual visual inspection used Chrome screenshots and computed layout/console checks. Keyboard sequences were exercised through Playwright, not an assistive-technology user study. Screen reader announcements, browser zoom beyond tested viewport layouts, alternate browser engines and real touch hardware still need broader evaluation. No formal WCAG compliance claim is made.

## 7. Performance

Final medians of three cold runs per artifact, served by the same Vite preview HTTP stack with actual gzip encoding recorded. Chrome 156.0.8078.80; 390×844; America/Sao_Paulo; 150ms RTT, 200,000 B/s down, 93,750 B/s up and CPU 4×; observation continues five seconds after load. Service workers are blocked for the comparison. These are local **production builds**, not development-mode measurements.

| Metric | Existing Phase 4 | Phase 5 preview |
| --- | ---: | ---: |
| LCP | 1,232 ms | 1,820 ms |
| CLS | 0.048682 | 0.086556 |
| FCP | 808 ms | 1,240 ms |
| TBT diagnostic, after FCP | 74 ms | 429 ms |
| Total transferred in observed window | 285,233 bytes | 191,834 bytes |
| JavaScript transferred | 28,716 bytes | 59,837 bytes |
| CSS transferred | 5,822 bytes | 10,269 bytes |
| Total requests, including failures | 34 | 24 |

The framework preview is slower at first paint and has more post-paint blocking and layout movement than Phase 4; these regressions are recorded as P2 work before promotion. The median LCP is 1.820s, while median CLS is 0.086556, leaving limited headroom below 0.1. Compact dashboard avatars request 96px variants of the same verified source assets. Lower transfer does not imply faster startup: the measured framework cost remains visible in FCP and blocking. Per-resource records include failed requests as well as HTTP responses. HTTP/resource detail and every run are in [performance.json](validation/performance.json). Worker registration/install traffic is excluded from this comparison; offline behavior has a separate functional check.

TBT here sums the part of each long task above 50ms **after FCP through the end of the stated observation window**. It is not a Lighthouse-to-TTI score. The JSON separately retains pre-FCP-inclusive blocking work and task timings so these quantities cannot be confused. This follows the metric window distinction in [web.dev’s TBT definition](https://web.dev/articles/tbt). No field INP is reported; load diagnostics and scripted interactions do not establish representative real-user INP.

| Static preview output | Measured | Separate enforced limit |
| --- | ---: | ---: |
| Entire build | 296.13 KiB | 650 KiB |
| All JavaScript | 194.36 KiB | 360 KiB |
| All CSS | 48.32 KiB | 100 KiB |
| Initial static code, gzip estimate | 61.06 KiB | 95 KiB |

Validated datasets are immutable resource snapshots, replaced atomically through shallow reactivity. Unused Vue Options API support is excluded with [official compile-time flags](https://vuejs.org/api/compile-time-flags.html); all authored components use Composition API. These changes reduced the startup bundle without introducing a new state-management dependency.

The preview has its own enforced limits: total artifact 650 KiB, JavaScript 360 KiB, CSS 100 KiB and initial static-code gzip estimate 95 KiB. The original root budget remains 250 KiB without alteration. [bundle.json](validation/bundle.json) records every output file, raw/gzip sizes and entry dependency closure. The initial-code estimate excludes lazy dashboard code, fonts, API responses and remote photos; browser network diagnostics measure those separately.

Only WOFF2 fonts ship; there are no duplicate remote font stylesheets. Heavy comparison modules are absent from the dashboard entry and offline core. Static skeleton regions reserve hero space, images have dimensions, no icon/chart library is included and chart code loads with the comparison route. Bootstrap's selective Sass reduced the first trial's oversized all-grid/reboot CSS to the measured custom foundation. No budget was silently raised after measurement.

## 8. Testing results

| Category | Final result | Evidence |
| --- | --- | --- |
| Existing native regression | 253 passed; baseline and final runs count as the same 253 tests | [Final checks](validation/legacy-final.txt) |
| New adapter tests | 28 passed | [Vitest](validation/unit-components.txt), `experience/tests/adapters.test.js` |
| New shared resource/state tests | 6 passed | [Vitest](validation/unit-components.txt), `experience/tests/store.test.js` |
| New component tests | 17 passed | [Vitest](validation/unit-components.txt), `experience/tests/components.test.js` |
| New unit/component total | **51 passed** across three files | [Final log](validation/unit-components.txt) |
| Existing controlled browser regression | 60 runner-reported tests passed, including suite parents | [Legacy browser](validation/legacy-browser.txt) |
| New production browser regression | 34 leaf scenarios passed; Node reports 35 including the parent suite | [Browser log](validation/browser.txt), [structured evidence](validation/browser.json) |
| New accessibility audits | 14 audits, **zero violations**; included in the 34 browser scenarios above | [Axe detail](validation/browser.json) |
| Existing live API checks | 6 leaf checks plus parent: 7 runner-reported passes | [Live API](validation/legacy-live-api.txt) |
| Existing live page checks | 6 page checks plus parent: 7 runner-reported passes | [Live pages](validation/legacy-live-pages.txt) |
| Existing live photograph checks | 4 scenarios plus parent: 5 runner-reported passes; all 35 photographs decode | [Live images](validation/legacy-live-images.txt), [source audit](validation/legacy-live-images.json) |
| Builds and isolation | Preview build/budgets, root 32-file build/integrity/budgets, strict production CSP and 421 original-file hashes pass | [Build](validation/build.txt), [isolation](validation/isolation.json) |
| Extra syntax checks | 18 experimental JS/MJS files parse; Vue templates compile in the production build | [File inventory](validation/experimental-syntax.txt) |

The 14 axe audits are a subset of the browser scenarios; the 51 Vitest total is the sum of the three new categories, not an extra test category to add again. Parent-suite counters are not presented as independent user scenarios.

Fixtures are validated real Jolpica responses captured at the time recorded in the fixture metadata. They never enter the production bundle. Controlled transport failures/empty responses and long names are explicitly marked as test scenarios. Live API, page and photo checks remain separate evidence, not substitutes for deterministic tests. Test runners' parent-suite counts are disclosed below rather than added to leaf scenarios or axe audits.

A clean `npm ci --ignore-scripts --include=optional` was verified from the new lockfile. An initial reinstall attempt encountered a Windows native-module lock from the task's running Vite processes; those exact local processes were stopped before the successful clean install. No root dependency directory was changed.

## 9. Legacy compatibility and security

Every original tracked file is compared by SHA-256 against the initial working tree in [isolation.json](validation/isolation.json). This covers root pages, data, styles, dependency files, tests, service worker and workflow files, plus existing documentation/evidence. The stable 32-file packaging/integrity/budget checks pass again in [legacy-final.txt](validation/legacy-final.txt). Existing public routes and the `/F1/` base are preserved; no preview link or redirect was added to production.

The preview has no backend/database, credentials, unsafe HTML injection or cross-origin API requests beyond the existing Jolpica origin. Safe photo schemes/hosts and color formats are constrained. Outbound source links use HTTPS and `noopener noreferrer`. Production browser checks observe CSP and unhandled exceptions/rejections; zero are required by the suite.

Runtime dependency audit: zero reported vulnerabilities. The full development tree retains four moderate advisory entries in the test-formatting dependency chain (`js-beautify`, `glob`, `editorconfig`, `minimatch`); see [runtime audit](validation/runtime-dependency-audit.json) and [full audit](validation/dependency-audit.json). No forced, incompatible transitive override was applied. These packages are not included in the production output. Runtime/framework and font license texts are included in `experience/public/third-party-notices.txt` and the standalone artifact. [Artifact equivalence](validation/artifact-equivalence.json) verifies that adding those notices leaves every tested executable asset unchanged.

## 10. Phase 6 readiness

- Jolpica is implemented through the existing tested transport: schedules, championship standings, published winners, last race and individual race results. Cache/failure/season normalization is already in use.
- `providerContracts` distinguishes `jolpica`, `openf1` and `f1db` namespaces. The latter two explicitly advertise no implemented capabilities. Comparison accepts additional verified metrics through the presentation boundary; the timing panel has explicit unavailable regions.
- OpenF1 session/driver identifiers must be reconciled with Jolpica identities through a reviewed mapping. F1DB historical identity and predecessor rules also require deliberate mapping. No interchangeability is assumed.
- No exploratory OpenF1/F1DB requests were necessary or made. Usage limits, licensing, browser CORS, endpoint validation and integration feasibility remain work for the actual Phase 6 integrations; this phase makes no unverified claim about those providers.

## 11. Remaining debt

| Priority | Item | Practical scope |
| --- | --- | --- |
| P0 | None identified | No known loss of original work, fabricated sporting data or unauthorized publication. |
| P1 | None identified within the authorized preview | Required views, controls, source integrity, build and validation are implemented. |
| P2 | Four moderate development-only advisory entries | Resolve the upstream test formatter dependency chain with a compatible release and rerun component tests. Runtime audit is clean. |
| P2 | Broader accessibility/device/performance evidence | Real screen reader and touch hardware, zoom scenarios, Firefox/WebKit and representative field INP require additional evidence. Current evidence is Chrome laboratory testing and visual review. |
| P2 | Remote-photo availability | Drivers without a verified catalog reference retain an explicit unavailable portrait. Existing ID/full-name resolution is preserved and covered by regression tests; new photographs still require verification. All 35 historical photographs passed the separate legacy live audit. |
| P2 | Measured startup responsiveness | The framework preview has higher FCP, CLS and post-FCP blocking than the stable static site. Its 429ms median observation-window TBT diagnostic merits further profiling before promotion; exact measurements and limits appear above. |
| P3 | Future production promotion | Deliberately outside authorization: legacy URL migration, root/preview worker reconciliation, canonical/sitemap changes, deployment allowlist/provenance and an authorized production budget decision. |

Unavailable telemetry and non-race sessions are intentional Phase 5 scope boundaries, not fabricated placeholders for implemented metrics. Cold offline use before installation and never-visited route code require a connection; the preview explains failures and retains the existing API age bound.

## 12. Files changed

No original tracked file is modified. Newly created files are confined to `experience/` and `docs/phase-5/`. The exact inventory is in [files-changed.json](validation/files-changed.json).

```text
docs/phase-5/DESIGN-SYSTEM.md
docs/phase-5/GALLERY.md
docs/phase-5/REPORT.md
docs/phase-5/screenshots/calendar.png
docs/phase-5/screenshots/champions.png
docs/phase-5/screenshots/comparison.png
docs/phase-5/screenshots/constructors.png
docs/phase-5/screenshots/dashboard-desktop.png
docs/phase-5/screenshots/dashboard-mobile.png
docs/phase-5/screenshots/drivers-expanded.png
docs/phase-5/screenshots/drivers.png
docs/phase-5/screenshots/race-center.png
docs/phase-5/screenshots/test-empty.png
docs/phase-5/screenshots/test-error.png
docs/phase-5/screenshots/test-loading.png
docs/phase-5/screenshots/test-long-name-missing-image.png
docs/phase-5/validation/artifact-equivalence.json
docs/phase-5/validation/browser.json
docs/phase-5/validation/browser.txt
docs/phase-5/validation/build.txt
docs/phase-5/validation/bundle.json
docs/phase-5/validation/dependency-audit.json
docs/phase-5/validation/experimental-syntax.txt
docs/phase-5/validation/files-changed.json
docs/phase-5/validation/final-git-status.txt
docs/phase-5/validation/format.txt
docs/phase-5/validation/initial-audit.json
docs/phase-5/validation/isolation.json
docs/phase-5/validation/legacy-baseline.txt
docs/phase-5/validation/legacy-browser.txt
docs/phase-5/validation/legacy-final.txt
docs/phase-5/validation/legacy-hashes.json
docs/phase-5/validation/legacy-live-api.json
docs/phase-5/validation/legacy-live-api.txt
docs/phase-5/validation/legacy-live-images.json
docs/phase-5/validation/legacy-live-images.txt
docs/phase-5/validation/legacy-live-pages.txt
docs/phase-5/validation/legacy-live-summary.json
docs/phase-5/validation/measurement-command.txt
docs/phase-5/validation/npm-ci.txt
docs/phase-5/validation/performance.json
docs/phase-5/validation/runtime-dependency-audit.json
docs/phase-5/validation/summary.json
docs/phase-5/validation/unit-components.txt
docs/phase-5/validation/visual-command.txt
docs/phase-5/validation/visuals.json
experience/.gitignore
experience/README.md
experience/index.html
experience/package-lock.json
experience/package.json
experience/public/favicon.svg
experience/public/third-party-notices.txt
experience/scripts/budget.mjs
experience/scripts/legacy-browser-regression.mjs
experience/scripts/legacy-live-regression.mjs
experience/scripts/measure.mjs
experience/scripts/offline.mjs
experience/scripts/record-fixtures.mjs
experience/scripts/verify-isolation.mjs
experience/scripts/visuals.mjs
experience/src/App.vue
experience/src/adapters/portal.js
experience/src/assets/placeholder-driver.svg
experience/src/components/calendar/RaceCard.vue
experience/src/components/champions/ChampionCard.vue
experience/src/components/common/DataState.vue
experience/src/components/common/FeatureUnavailable.vue
experience/src/components/common/Icon.vue
experience/src/components/common/MetricBars.vue
experience/src/components/common/PageHeader.vue
experience/src/components/common/Portrait.vue
experience/src/components/common/RaceStatus.vue
experience/src/components/common/ResultsTable.vue
experience/src/components/common/SectionHeader.vue
experience/src/components/dashboard/Leaderboard.vue
experience/src/components/dashboard/NextRaceHero.vue
experience/src/components/drivers/ComparisonPanel.vue
experience/src/components/drivers/DriverCard.vue
experience/src/components/teams/ConstructorCard.vue
experience/src/composables/usePortal.js
experience/src/composables/useQuery.js
experience/src/main.js
experience/src/router/index.js
experience/src/styles/app.css
experience/src/styles/bootstrap.scss
experience/src/styles/tokens.css
experience/src/views/CalendarView.vue
experience/src/views/ChampionsView.vue
experience/src/views/CompareView.vue
experience/src/views/ConstructorsView.vue
experience/src/views/DashboardView.vue
experience/src/views/DriversView.vue
experience/src/views/NotFoundView.vue
experience/src/views/RaceCenterView.vue
experience/tests/adapters.test.js
experience/tests/browser.mjs
experience/tests/components.test.js
experience/tests/fixtures/jolpica-recording.json
experience/tests/store.test.js
experience/vite.config.js
```

## 13. Final Git status

- Branch: `main`.
- HEAD: `952f31ad630e06223a6e0784b83d1dbaa8e04bdd` (unchanged).
- Staged files: **0**.
- Unstaged tracked files: **0**.
- Untracked new files: **101**, listed above and in [the full final status](validation/final-git-status.txt).
- Original tracked files compared: **421**; changed original files: **0**.
- No commit, push, merge or deployment occurred.

No commit, push, merge, deployment, GitHub Actions trigger, repository setting, secret, environment or branch-protection change was performed. Local development/preview servers are unrelated to production hosting.

## Local commands

```powershell
cd C:\xampp\htdocs\F1\experience
npm ci --ignore-scripts --include=optional
npm run dev
npm run build
npm run preview
npm test
npm run test:browser
npm run measure
```

Detailed usage, test prerequisites, preview worker behavior and future URL compatibility are in [experience/README.md](../../experience/README.md).

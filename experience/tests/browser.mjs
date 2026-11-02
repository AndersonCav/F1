import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import {
  chromium,
  launchOptions,
} from "../../tests/helpers/champion-browser.js";
import AxeBuilder from "@axe-core/playwright";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../../docs/phase-5/validation/", import.meta.url);
const shots = new URL("../../docs/phase-5/screenshots/", import.meta.url);
const recording = JSON.parse(
  await readFile(new URL("./fixtures/jolpica-recording.json", import.meta.url)),
);
const fallback = await readFile(
  new URL("../../assets/images/placeholder-driver.svg", import.meta.url),
);
const lastRound =
  recording.responses["2026/last/results.json?limit=100"].MRData.RaceTable
    .Races[0].round;
const paths = [
  "/",
  "/drivers",
  "/constructors",
  "/champions",
  "/calendar",
  `/race-center?round=${lastRound}`,
  "/compare?a=hamilton&b=norris",
];

export async function installRecording(context, mode = "ready") {
  const requests = [];
  await context.route("https://api.jolpi.ca/**", async (route) => {
    const u = new URL(route.request().url());
    const key = u.pathname.replace("/ergast/f1/", "") + u.search;
    requests.push(key);
    if (mode === "error") return route.abort("failed");
    if (mode === "loading")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    let body = recording.responses[key];
    if (key === "2026/races.json?limit=100")
      body = recording.responses["current/races.json?limit=100"];
    const result = key.match(/^(\d{4})\/(\d+)\/results\.json/);
    if (!body && result) {
      const last =
        recording.responses[`${result[1]}/last/results.json?limit=100`];
      body =
        last?.MRData.RaceTable.Races[0]?.round === result[2]
          ? last
          : {
              MRData: {
                total: "0",
                offset: "0",
                RaceTable: { season: result[1], round: result[2], Races: [] },
              },
            };
    }
    if (!body)
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}",
      });
    body = structuredClone(body);
    if (mode === "empty") {
      const table = body.MRData.StandingsTable;
      if (table) table.StandingsLists = [];
      if (body.MRData.RaceTable) body.MRData.RaceTable.Races = [];
      body.MRData.total = "0";
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await context.route(
    /https:\/\/(media\.formula1\.com|thumb\.wikimedia\.org|upload\.wikimedia\.org)\//,
    (route) => route.fulfill({ contentType: "image/svg+xml", body: fallback }),
  );
  return requests;
}

test("Phase 5 isolated production preview", { timeout: 300000 }, async (t) => {
  await mkdir(output, { recursive: true });
  await mkdir(shots, { recursive: true });
  const server = await preview({
    root,
    configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
    preview: { host: "127.0.0.1", port: 4185, strictPort: true },
  });
  const browser = await chromium.launch(launchOptions);
  const origin = "http://127.0.0.1:4185/F1/experience/";
  const report = {
    browser: browser.version(),
    recordedAt: recording.recordedAt,
    generatedAt: new Date().toISOString(),
    controlledData:
      "Real recorded Jolpica data, fixed reference clock; remote photos replaced with local SVG for deterministic tests. Empty/error/loading cases are controlled test states.",
    scenarios: [],
    axe: [],
  };
  t.after(async () => {
    await writeFile(
      new URL("browser.json", output),
      JSON.stringify(report, null, 2) + "\n",
    );
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  });
  async function session(width = 1440, mode = "ready", options = {}) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "block",
      reducedMotion: "reduce",
      ...options,
    });
    const requests = await installRecording(context, mode);
    await context.addInitScript(() => {
      window.previewAudit = { csp: [], rejections: [] };
      document.addEventListener("securitypolicyviolation", (e) =>
        previewAudit.csp.push({
          directive: e.effectiveDirective,
          uri: e.blockedURI,
        }),
      );
      window.addEventListener("unhandledrejection", (e) =>
        previewAudit.rejections.push(String(e.reason)),
      );
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-02T15:00:00Z"));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    return { page, context, errors, requests };
  }
  async function goto(s, path = "/") {
    await s.page.goto(origin + "#" + path);
    const titles = {
      "/": "Dentro do campeonato.",
      "/drivers": "Talento. Coragem. Precisão.",
      "/constructors": "A força por trás do grid.",
      "/champions": "O tempo passa. A lenda fica.",
      "/calendar": "Um mundo de disputas.",
      "/race-center": "Cada corrida tem uma história.",
      "/compare": "Lado a lado. Ponto a ponto.",
    };
    await s.page
      .getByRole("heading", {
        level: 1,
        name: titles[path.split("?")[0]] || "Vamos voltar à pista.",
        exact: true,
      })
      .waitFor();
    await s.page.waitForFunction(
      () =>
        !document
          .querySelector(".topbar-end")
          ?.textContent.includes("Buscando dados"),
    );
  }
  async function finish(s, name) {
    assert.deepEqual(s.errors, []);
    assert.deepEqual(await s.page.evaluate(() => previewAudit), {
      csp: [],
      rejections: [],
    });
    report.scenarios.push(name);
    await s.context.close();
  }

  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await t.test(
      `all seven routes have no horizontal page overflow at ${width}px`,
      async () => {
        const s = await session(width);
        for (const path of paths) {
          await goto(s, path);
          if (path.startsWith("/race-center"))
            await s.page.locator("table").waitFor();
          assert.ok(
            await s.page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${width}px ${path}: page overflow`,
          );
          if (path === "/champions")
            assert.equal(await s.page.locator(".champion-card").count(), 35);
        }
        await finish(s, `responsive seven routes ${width}`);
      },
    );
  }
  for (const width of [390, 1440])
    for (const path of paths) {
      await t.test(`axe WCAG 2.2 AA: ${path} at ${width}px`, async () => {
        const s = await session(width);
        await goto(s, path);
        if (
          path === "/drivers" ||
          path === "/constructors" ||
          path === "/champions"
        )
          await s.page.locator("summary").first().click();
        if (path.startsWith("/race-center"))
          await s.page.locator("table").waitFor();
        const axe = await new AxeBuilder({ page: s.page })
          .options({ preload: false })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ])
          .analyze();
        report.axe.push({
          width,
          path,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          incomplete: axe.incomplete.map((r) => ({
            id: r.id,
            targets: r.nodes.map((n) => n.target),
          })),
          passedRules: axe.passes.length,
        });
        assert.deepEqual(report.axe.at(-1).violations, []);
        await finish(s, `axe ${path} ${width}`);
      });
    }
  await t.test(
    "driver query, constructor filter, sort and two-driver comparison",
    async () => {
      const s = await session();
      await goto(s, "/drivers");
      await s.page.getByLabel("Buscar piloto").fill("hamilton");
      await s.page.waitForFunction(
        () => document.querySelectorAll(".driver-card").length === 1,
      );
      assert.ok(s.page.url().includes("q=hamilton"));
      await s.page.reload();
      await s.page.locator(".driver-card").waitFor();
      assert.equal(await s.page.locator(".driver-card").count(), 1);
      await s.page.getByLabel("Buscar piloto").fill("");
      await s.page
        .getByLabel("Construtor", { exact: true })
        .selectOption("mercedes");
      await s.page.waitForFunction(
        () => document.querySelectorAll(".driver-card").length === 2,
      );
      await s.page.getByLabel("Ordenar por").selectOption("name");
      for (const button of await s.page.locator(".card-compare").all())
        await button.click();
      await s.page.getByRole("link", { name: /Comparar agora/ }).click();
      await s.page.locator(".comparison-panel").waitFor();
      assert.equal(await s.page.locator("figure").count(), 4);
      assert.ok(s.page.url().includes("season=2026"));
      await s.page.getByText("Ver tabela de dados", { exact: true }).click();
      assert.equal(await s.page.locator("table tbody tr").count(), 4);
      await finish(s, "driver controls and comparison");
    },
  );
  await t.test(
    "constructor search, native disclosure and driver navigation",
    async () => {
      const s = await session();
      await goto(s, "/constructors");
      await s.page.getByLabel("Buscar construtor").fill("Ferrari");
      await s.page.waitForFunction(
        () => document.querySelectorAll(".constructor-card").length === 1,
      );
      const summary = s.page.locator("summary");
      await summary.focus();
      await s.page.keyboard.press("Enter");
      assert.equal(await s.page.locator("details").getAttribute("open"), "");
      await s.page.locator(".participant-list a").first().click();
      await s.page.locator(".driver-card").waitFor();
      assert.equal(await s.page.locator(".driver-card").count(), 1);
      await finish(s, "constructor controls");
    },
  );
  await t.test(
    "champion search, era, sort and complete photo attribution",
    async () => {
      const s = await session();
      await goto(s, "/champions");
      assert.equal(
        await s.page.locator(".champion-card details a").count(),
        105,
      );
      await s.page.getByLabel("Buscar campeão").fill("senna");
      await s.page.waitForFunction(
        () => document.querySelectorAll(".champion-card").length === 1,
      );
      await s.page.getByLabel("Época dos títulos").selectOption("1990");
      await s.page.getByLabel("Ordenar por").selectOption("name");
      await s.page.locator("summary").focus();
      await s.page.keyboard.press("Enter");
      assert.ok(await s.page.locator("details").evaluate((d) => d.open));
      await s.page.getByLabel("Buscar campeão").fill("zzzz");
      await s.page
        .getByText("Nenhum campeão encontrado para esta seleção.")
        .waitFor();
      await finish(s, "champion controls and credits");
    },
  );
  await t.test(
    "calendar statuses, next focus and event selection",
    async () => {
      const s = await session();
      await goto(s, "/calendar");
      await s.page.getByLabel("Exibir corridas").selectOption("completed");
      await s.page.waitForFunction(
        () => document.querySelectorAll(".race-card").length === 19,
      );
      await s.page
        .getByRole("button", { name: "Ir à próxima corrida" })
        .click();
      await s.page.waitForFunction(
        () => document.activeElement?.id === "round-20",
      );
      await s.page.locator("#round-19 a").click();
      await s.page.locator("table").waitFor();
      assert.equal(await s.page.locator("table tbody tr").count(), 22);
      await finish(s, "calendar status and results");
    },
  );
  await t.test(
    "Race Center changes season and session without fabricating telemetry",
    async () => {
      const s = await session();
      await goto(s, `/race-center?round=${lastRound}`);
      await s.page.locator("table").waitFor();
      await s.page
        .getByLabel("Sessão", { exact: true })
        .selectOption("qualifying");
      await s.page.getByText(/Esta sessão não está integrada/).waitFor();
      await s.page.getByRole("button", { name: "Tempos e telemetria" }).click();
      await s.page
        .getByText("TELEMETRIA INDISPONÍVEL", { exact: true })
        .waitFor();
      assert.equal(await s.page.locator("canvas").count(), 0);
      await s.page
        .getByLabel("Temporada", { exact: true })
        .selectOption("2025");
      await s.page.waitForFunction(
        () =>
          document.querySelector(".race-center-heading h2")?.textContent ===
          "Abu Dhabi Grand Prix",
      );
      await s.page.getByLabel("Sessão", { exact: true }).selectOption("race");
      await s.page.locator("table").waitFor();
      assert.equal(await s.page.locator("table tbody tr").count(), 20);
      await finish(s, "race season session and missing telemetry");
    },
  );
  await t.test(
    "desktop navigation uses SPA routes without duplicate API requests",
    async () => {
      const s = await session();
      await goto(s);
      const count = s.requests.length;
      for (const path of [
        "/drivers",
        "/constructors",
        "/champions",
        "/calendar",
        "/compare",
      ]) {
        await s.page.locator(`.sidebar nav a[href="#${path}"]`).click();
        await s.page.waitForFunction(
          () => document.activeElement?.tagName === "H1",
        );
        assert.equal(
          await s.page.locator('nav [aria-current="page"]').count(),
          1,
        );
      }
      assert.equal(s.requests.length, count);
      assert.ok(!s.requests.some((r) => r.includes("openf1")));
      await finish(s, "SPA navigation and request deduplication");
    },
  );
  await t.test(
    "mobile drawer traps keyboard focus and restores its opener",
    async () => {
      const s = await session(375);
      await goto(s);
      const opener = s.page.getByRole("button", { name: "Abrir navegação" });
      await opener.click();
      assert.equal(await s.page.locator('[role="dialog"]').count(), 1);
      await s.page.locator(".sidebar .legacy-link").focus();
      await s.page.keyboard.press("Tab");
      assert.equal(
        await s.page.evaluate(() =>
          document.activeElement.getAttribute("aria-label"),
        ),
        "F1 Portal — visão geral",
      );
      await s.page.keyboard.press("Shift+Tab");
      assert.ok(
        await s.page
          .locator(".sidebar .legacy-link")
          .evaluate((e) => e === document.activeElement),
      );
      await s.page.keyboard.press("Escape");
      assert.ok(await opener.evaluate((e) => document.activeElement === e));
      await opener.click();
      await s.page.locator(".sidebar nav a").nth(1).click();
      await s.page.locator(".driver-card").first().waitFor();
      assert.equal(await s.page.locator(".sidebar.open").count(), 0);
      await finish(s, "mobile drawer keyboard");
    },
  );
  await t.test(
    "reduced motion and touch targets in meaningful landscape viewport",
    async () => {
      const s = await session(844, "ready", {
        viewport: { width: 844, height: 390 },
      });
      await goto(s, "/drivers");
      assert.ok(
        await s.page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      );
      const maxDuration = await s.page
        .locator(".driver-card")
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration);
      assert.ok(parseFloat(maxDuration) < 0.001);
      assert.ok(
        await s.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      for (const e of await s.page
        .locator("main input, main select, main button")
        .all()) {
        const box = await e.boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44);
      }
      await finish(s, "landscape reduced motion and touch targets");
    },
  );
  for (const mode of ["loading", "empty", "error"])
    await t.test(`${mode} states and retry stay accessible`, async () => {
      const s = await session(390, mode);
      if (mode === "loading") {
        await s.page.goto(origin + "#/drivers");
        await s.page.getByText("Carregando pilotos…").waitFor();
      } else await goto(s, "/drivers");
      assert.ok((await s.page.locator('[role="status"]').count()) > 0);
      if (mode === "error") {
        await s.page.getByRole("button", { name: "Tentar novamente" }).click();
        await s.page
          .getByRole("button", { name: "Tentar novamente" })
          .waitFor();
      }
      await s.page.screenshot({
        path: fileURLToPath(new URL(`test-${mode}.png`, shots)),
      });
      await finish(s, `${mode} accessible state`);
    });
  await t.test("unknown route has a working recovery destination", async () => {
    const s = await session();
    await goto(s, "/unknown");
    assert.ok((await s.page.locator("h1").innerText()).includes("voltar"));
    await s.page.getByRole("link", { name: "Ir à visão geral" }).click();
    await s.page.locator(".next-race-hero").waitFor();
    await finish(s, "route recovery");
  });
  await t.test(
    "long-name layout and missing image fallback remain usable",
    async () => {
      const s = await session(320);
      await goto(s, "/drivers");
      await s.context.route(
        "https://media.formula1.com/phase5-missing.webp",
        (route) => route.abort("failed"),
      );
      await s.page
        .locator(".driver-card")
        .first()
        .evaluate((card) => {
          card.querySelector("h2").textContent =
            "Layout fixture: um nome excepcionalmente longo para validar a quebra de linha";
          card.querySelector("img").src =
            "https://media.formula1.com/phase5-missing.webp";
        });
      await s.page.waitForFunction(() =>
        document
          .querySelector(".driver-card img")
          .src.includes("placeholder-driver"),
      );
      await s.page.locator("summary").first().click();
      assert.ok(
        await s.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await s.page.screenshot({
        path: fileURLToPath(new URL("test-long-name-missing-image.png", shots)),
      });
      await finish(s, "long-name and missing image");
    },
  );
  await t.test(
    "scoped offline shell reloads visited routes with cached API data",
    async () => {
      const s = await session(390, "ready", { serviceWorkers: "allow" });
      await goto(s, "/drivers");
      await s.page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller)
          await new Promise((resolve) =>
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              resolve,
              { once: true },
            ),
          );
      });
      await s.page.reload();
      await s.page.locator(".driver-card").first().waitFor();
      await s.context.setOffline(true);
      await s.page.reload();
      await s.page.locator(".driver-card").first().waitFor();
      assert.ok(
        (await s.page.locator(".topbar-end").innerText()).includes("cache"),
      );
      assert.ok(
        await s.page.evaluate(() =>
          navigator.serviceWorker.controller.scriptURL.endsWith(
            "/F1/experience/experience-sw.js",
          ),
        ),
      );
      await s.page.getByRole("button", { name: "Abrir navegação" }).click();
      await s.page.locator('.sidebar nav a[href="#/champions"]').click();
      await s.page
        .getByText("Não foi possível abrir esta página.", { exact: true })
        .waitFor();
      await s.page.getByRole("link", { name: "Voltar à visão geral" }).click();
      await s.page.locator(".next-race-hero").waitFor();
      await finish(s, "offline reload scoped worker");
    },
  );
});

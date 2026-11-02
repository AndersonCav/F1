import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import {
  chromium,
  launchOptions,
} from "../../tests/helpers/champion-browser.js";
const output = new URL("../../docs/phase-5/screenshots/", import.meta.url);
await mkdir(output, { recursive: true });
const server = await preview({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
  preview: { port: 4187, strictPort: true, host: "127.0.0.1" },
});
const browser = await chromium.launch(launchOptions);
const report = {
  generatedAt: new Date().toISOString(),
  source:
    "Unmocked browser, real Jolpica and verified image URLs; no fixed clock. Providers may fail independently; local fallback is preserved.",
  captures: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    timezoneId: "America/Sao_Paulo",
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4187/F1/experience/");
  await page.locator(".next-race-hero").waitFor({ timeout: 25000 });
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".topbar-end")
        ?.textContent.includes("Buscando dados"),
  );
  const last = await page.locator(".last-race > a").getAttribute("href");
  for (const [name, route, width] of [
    ["dashboard-desktop", "/", 1440],
    ["dashboard-mobile", "/", 390],
    ["drivers", "/drivers", 1440],
    ["constructors", "/constructors", 1440],
    ["champions", "/champions", 1440],
    ["calendar", "/calendar", 1440],
    ["race-center", last?.slice(1) || "/race-center", 1440],
    ["comparison", "/compare?a=antonelli&b=max_verstappen", 1440],
  ]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1050 });
    await page.goto(`http://127.0.0.1:4187/F1/experience/#${route}`);
    await page.locator("h1").waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, output)),
    });
    report.captures.push({
      file: `${name}.png`,
      route,
      width,
      errors: [...errors],
      images: await page.locator("main img").evaluateAll((imgs) =>
        imgs.slice(0, 8).map((i) => ({
          alt: i.alt,
          complete: i.complete,
          width: i.naturalWidth,
          source: i.currentSrc,
        })),
      ),
    });
    if (name === "drivers") {
      await page.locator("summary").first().click();
      await page.screenshot({
        path: fileURLToPath(new URL("drivers-expanded.png", output)),
      });
    }
  }
  await context.close();
} finally {
  await writeFile(
    new URL("../validation/visuals.json", output),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

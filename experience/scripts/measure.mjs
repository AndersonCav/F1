import { mkdir, writeFile } from "node:fs/promises";
import { preview } from "vite";
import { fileURLToPath } from "node:url";
import {
  chromium,
  launchOptions,
} from "../../tests/helpers/champion-browser.js";

const output = new URL("../../docs/phase-5/validation/", import.meta.url);
await mkdir(output, { recursive: true });
const local = await preview({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
  preview: { port: 4186, strictPort: true, host: "127.0.0.1" },
});
const legacy = await preview({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  configFile: false,
  base: "/F1/",
  build: { outDir: "dist" },
  preview: { port: 4189, strictPort: true, host: "127.0.0.1" },
});
const browser = await chromium.launch(launchOptions);
const report = {
  generatedAt: new Date().toISOString(),
  browser: browser.version(),
  conditions:
    "Local production builds; real Jolpica and image providers; 390x844 Chrome; cold contexts; service workers blocked; 150ms RTT, 200000 bytes/s down, 93750 bytes/s up, CPU 4x; 5 seconds after load; 3 runs each. Both artifacts use the same Vite preview HTTP stack. Actual Content-Encoding and CDP transferred bytes are recorded per resource. No Lighthouse score or field INP. TBT diagnostic sums task time above 50ms after FCP through the end of the observation window, not Lighthouse TTI. TotalBlockingWorkMs separately includes pre-FCP startup work.",
  runs: [],
};
try {
  for (const [name, url] of [
    ["phase4", "http://127.0.0.1:4189/F1/"],
    ["phase5", "http://127.0.0.1:4186/F1/experience/"],
  ])
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: "America/Sao_Paulo",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.lab = {
          lcpMs: 0,
          cls: 0,
          totalBlockingWorkMs: 0,
          longTasks: [],
        };
        for (const [type, callback] of [
          [
            "largest-contentful-paint",
            (e) => {
              lab.lcpMs = e.startTime;
            },
          ],
          [
            "layout-shift",
            (e) => {
              if (!e.hadRecentInput) lab.cls += e.value;
            },
          ],
          [
            "longtask",
            (e) => {
              lab.totalBlockingWorkMs += Math.max(0, e.duration - 50);
              lab.longTasks.push({
                startTime: e.startTime,
                duration: e.duration,
              });
            },
          ],
        ])
          new PerformanceObserver((list) =>
            list.getEntries().forEach(callback),
          ).observe({ type, buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      const resources = new Map();
      cdp.on("Network.requestWillBeSent", (e) => {
        if (!resources.has(e.requestId))
          resources.set(e.requestId, {
            url: e.request.url,
            type: e.type,
            status: null,
            bytes: 0,
            contentEncoding: null,
          });
      });
      cdp.on("Network.responseReceived", (e) =>
        resources.set(e.requestId, {
          url: e.response.url,
          type: e.type,
          status: e.response.status,
          bytes: 0,
          contentEncoding:
            e.response.headers["Content-Encoding"] ||
            e.response.headers["content-encoding"] ||
            "identity",
        }),
      );
      cdp.on("Network.loadingFinished", (e) => {
        if (resources.has(e.requestId))
          resources.get(e.requestId).bytes = e.encodedDataLength;
      });
      cdp.on("Network.loadingFailed", (e) => {
        if (resources.has(e.requestId))
          resources.get(e.requestId).failure = e.errorText;
      });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 93750,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      try {
        await page.goto(url, { waitUntil: "load", timeout: 45000 });
        await page.waitForTimeout(5000);
        const metrics = await page.evaluate(() => {
          const fcpMs =
            performance.getEntriesByName("first-contentful-paint")[0]
              ?.startTime || null;
          return {
            ...lab,
            fcpMs,
            tbtDiagnosticMs:
              fcpMs === null
                ? null
                : lab.longTasks
                    .filter((task) => task.startTime >= fcpMs)
                    .reduce(
                      (n, task) => n + Math.max(0, task.duration - 50),
                      0,
                    ),
            observationEndMs: performance.now(),
          };
        });
        const all = [...resources.values()];
        report.runs.push({
          name,
          run,
          ...metrics,
          totalTransferredBytes: all.reduce((n, r) => n + r.bytes, 0),
          jsTransferBytes: all
            .filter((r) => r.type === "Script")
            .reduce((n, r) => n + r.bytes, 0),
          cssTransferBytes: all
            .filter((r) => r.type === "Stylesheet")
            .reduce((n, r) => n + r.bytes, 0),
          requests: all.length,
          failedRequests: all.filter((r) => r.failure).length,
          resources: all,
        });
        console.log(
          `[laboratory] ${name} run ${run}:`,
          JSON.stringify(metrics),
        );
      } catch (error) {
        report.runs.push({
          name,
          run,
          error: error.message,
          resources: [...resources.values()],
        });
      }
      await context.close();
    }
} finally {
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  report.medians = Object.fromEntries(
    ["phase4", "phase5"].map((name) => [
      name,
      Object.fromEntries(
        [
          "lcpMs",
          "cls",
          "fcpMs",
          "tbtDiagnosticMs",
          "totalTransferredBytes",
          "jsTransferBytes",
          "cssTransferBytes",
          "requests",
        ].map((key) => [
          key,
          median(
            report.runs
              .filter((r) => r.name === name && !r.error)
              .map((r) => r[key]),
          ),
        ]),
      ),
    ]),
  );
  await writeFile(
    new URL("performance.json", output),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => legacy.httpServer.close(resolve));
  await new Promise((resolve) => local.httpServer.close(resolve));
}

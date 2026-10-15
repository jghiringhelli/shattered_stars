/**
 * measure_first_load — how many bytes a player downloads before the main
 * menu, from the production build in dist/.
 *
 *   npm run build && npx tsx scripts/measure_first_load.ts [--budget-mb 10] [--dist dist]
 *
 * Serves dist/ from an in-process static server, opens it in headless
 * Chromium and sums every response's transferred size (CDP
 * encodedDataLength) until the network has been idle for a while (the
 * menu is up and nothing else loads). Exits 1 when over budget.
 */

import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

/** Build folder: `--dist <dir>` (compare two builds), default ./dist. */
const DIST_ARG = process.argv.indexOf("--dist");
const DIST =
  DIST_ARG > 0 ? resolve(process.argv[DIST_ARG + 1]!) : join(process.cwd(), "dist");
const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_BUDGET_MB = 10;
/** Quiet period after "networkidle" so late lazy requests are counted. */
const SETTLE_MS = 3000;
/** Interface the dist/ server binds to (loopback by default; MEASURE_HOST overrides). */
const SERVE_HOST = process.env.MEASURE_HOST ?? ["127", "0", "0", "1"].join(".");
/** Viewport point of the "first input" click (top-left corner, no button). */
const INPUT_CLICK = { x: 4, y: 4 } as const;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain",
};

/** @returns Total size of every file below `dir`. */
function folderBytes(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = join(dir, entry.name);
    return (
      sum + (entry.isDirectory() ? folderBytes(full) : statSync(full).size)
    );
  }, 0);
}

/** Static file server for dist/ (index.html for "/"). */
function serveDist(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    const file = normalize(join(DIST, path === "/" ? "index.html" : path));
    if (
      !file.startsWith(DIST + sep) ||
      !existsSync(file) ||
      statSync(file).isDirectory()
    ) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, SERVE_HOST, () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === "object" && address ? address.port : 0,
      });
    }),
  );
}

/** Bytes and request count per file extension. */
type Breakdown = Map<string, { bytes: number; requests: number }>;

/** Totals before and after the first input (music unlocks on first input). */
interface LoadMeasurement {
  readonly total: number;
  readonly requests: number;
  readonly afterInput: number;
  /** Navigation start to the game canvas being attached (ms). */
  readonly canvasMs: number;
  /** Navigation start to network idle (ms). */
  readonly idleMs: number;
  readonly byType: Breakdown;
}

async function measure(url: string): Promise<LoadMeasurement> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (error) =>
    console.error(`page error: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error(`console error: ${message.text()}`);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const urls = new Map<string, string>();
  const byType: Breakdown = new Map();
  let total = 0;
  let requests = 0;
  cdp.on("Network.requestWillBeSent", (e) =>
    urls.set(e.requestId, e.request.url),
  );
  cdp.on("Network.loadingFinished", (e) => {
    const type =
      extname(new URL(urls.get(e.requestId) ?? url).pathname) || "(html)";
    const entry = byType.get(type) ?? { bytes: 0, requests: 0 };
    byType.set(type, {
      bytes: entry.bytes + e.encodedDataLength,
      requests: entry.requests + 1,
    });
    total += e.encodedDataLength;
    requests++;
  });
  const startedAt = Date.now();
  const canvasReady = page
    .waitForSelector("canvas", { state: "attached", timeout: 60_000 })
    .then(() => Date.now() - startedAt);
  await page.goto(url, { waitUntil: "networkidle" });
  const idleMs = Date.now() - startedAt;
  const canvasMs = await canvasReady;
  await page.waitForTimeout(SETTLE_MS);
  const beforeInput = { total, requests, byType: new Map(byType) };
  // A click in an empty corner: unlocks audio without choosing a menu item.
  await page.mouse.click(INPUT_CLICK.x, INPUT_CLICK.y);
  await page.waitForTimeout(SETTLE_MS);
  await browser.close();
  return { ...beforeInput, afterInput: total, canvasMs, idleMs };
}

async function main(): Promise<void> {
  if (!existsSync(DIST))
    throw new Error("dist/ not found — run `npm run build` first");
  const budgetArg = process.argv.indexOf("--budget-mb");
  const budgetMb =
    budgetArg > 0 ? Number(process.argv[budgetArg + 1]) : DEFAULT_BUDGET_MB;
  const { server, port } = await serveDist();
  try {
    const result = await measure(`http://${SERVE_HOST}:${port}/`);
    const mb = (bytes: number): string => (bytes / BYTES_PER_MB).toFixed(2);
    console.log(`dist/ total:            ${mb(folderBytes(DIST))} MB`);
    console.log(
      `first load (to menu):   ${mb(result.total)} MB in ${result.requests} requests`,
    );
    for (const [type, entry] of [...result.byType].sort(
      (a, b) => b[1].bytes - a[1].bytes,
    ))
      console.log(
        `  ${type.padEnd(8)} ${mb(entry.bytes).padStart(8)} MB  ${entry.requests} req`,
      );
    console.log(
      `canvas attached:        ${result.canvasMs} ms (network idle ${result.idleMs} ms)`,
    );
    console.log(
      `after first input:      ${mb(result.afterInput)} MB (menu music starts)`,
    );
    if (result.total > budgetMb * BYTES_PER_MB) {
      console.error(`OVER BUDGET: ${mb(result.total)} MB > ${budgetMb} MB`);
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

void main();

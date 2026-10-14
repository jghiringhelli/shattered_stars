/**
 * perf_probe — measures frame rate in the heaviest battles of a running build.
 *
 *   npx tsx scripts/perf_probe.ts --base http://localhost:4174 --seconds 25 \
 *     --scenarios epic,survival40,boss,campaign [--gpu swiftshader|angle] [--out file.json]
 *
 * The page must expose `window.game` and `window.__perfHooks` (a DEV build, or
 * `NODE_ENV=development vite build`, which is still minified like production).
 * Chromium runs with automation flags hidden so the game picks WebGL, not the
 * Canvas it forces for webdriver. Results go to $TEMP (never into the repo).
 */

import { chromium, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Args {
  readonly base: string;
  readonly seconds: number;
  readonly scenarios: readonly string[];
  readonly gpu: string;
  readonly headed: boolean;
  /** CDP CPU slowdown factor (1 = none), to prove the quality governors react to load. */
  readonly throttle: number;
  readonly out: string;
}

interface Sample {
  readonly deltas: number[];
  /** Main-thread ms of each game step (update + render submission), GPU time excluded. */
  readonly steps: number[];
  /** [seconds into the run, ms] of every frame over 200 ms. */
  readonly gaps: number[][];
  readonly updates: number[];
  readonly renders: number[];
  readonly ships: number[];
  readonly quality: number[];
  readonly heapMb: number[];
}

const WARMUP_MS = 4000;
const SECOND_MS = 1000;
const GAME_READY_TIMEOUT_MS = 90_000;

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback;
  };
  return {
    base: get("base", "http://localhost:3003"),
    seconds: Number(get("seconds", "25")),
    scenarios: get("scenarios", "menu,epic,survival40,boss,campaign").split(","),
    gpu: get("gpu", "swiftshader"),
    headed: argv.includes("--headed"),
    throttle: Number(get("throttle", "1")),
    out: get("out", join(tmpdir(), "ss-perf.json")),
  };
}

function launchArgs(gpu: string): string[] {
  const base = ["--disable-blink-features=AutomationControlled", "--enable-precise-memory-info"];
  // Headless's default GL fails WebGL init ("Framebuffer Unsupported") on some boots; name the backend.
  if (gpu === "angle") return [...base, "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
  return [...base, "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
}

/** Every scene setup runs in the page; each resolves when the fight is under way. */
const SETUP: Record<string, (page: Page) => Promise<void>> = {
  menu: async () => undefined,
  epic: async (page) => {
    await page.evaluate(() => {
      const g = (window as any).game;
      const squad = (faction: string, controller: string, ship: string) => ({
        factionId: faction,
        controller,
        ships: Array.from({ length: 20 }, () => ship),
      });
      g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        gameMode: "epic",
        battle: "reinforcements",
        aiDifficulty: "normal",
        seed: 7,
        factions: [
          squad("free_confederation", "player", "confed_sparrow"),
          squad("synthetic_collective", "ai", "synth_drone"),
        ],
        reinforcements: {
          format: "epic",
          squads: [{ strategy: "swarm" }, { strategy: "swarm" }],
        },
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    });
    await waitShips(page, "ArcadeBattleScene", 10);
    await makePlayerImmortal(page, "ArcadeBattleScene");
  },
  survival40: async (page) => {
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene.stop("MainMenuScene");
      g.scene.start("SurvivalScene", { factionId: "free_confederation" });
    });
    await waitShips(page, "SurvivalScene", 2);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene");
      const slot = { definitionId: "synth_drone", loadoutId: null, tier: "regular" };
      const spec = s.rules.currentWave();
      const ring = 1800;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const at = { x: 3000 + Math.cos(a) * ring, y: 3000 + Math.sin(a) * ring, angle: a + Math.PI };
        s.spawnEnemyShip({ slot, faction: "synthetic_collective", spec, at });
      }
    });
    await makePlayerImmortal(page, "SurvivalScene");
  },
  boss: async (page) => {
    await page.evaluate(() => (window as any).__perfHooks.startCreatureBossNode());
    await page.waitForFunction(() => (window as any).game.scene.isActive("SurvivalScene"));
    const waves: number = await page.evaluate(
      () => (window as any).game.scene.getScene("SurvivalScene").rules.plan.waves,
    );
    for (let wave = 1; wave < waves; wave++) {
      await page.waitForFunction(() => {
        const s = (window as any).game.scene.getScene("SurvivalScene");
        return s?.isWaveActive === true && s.enemyShipIds.length > 0;
      }, undefined, { timeout: 20_000 });
      await page.evaluate(() => {
        const s = (window as any).game.scene.getScene("SurvivalScene");
        for (const id of [...s.enemyShipIds]) s.destroyShip(id, true);
        s.checkWaveComplete();
      });
    }
    await page.waitForFunction(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene");
      return [...s.ships.values()].some((sh: any) => sh.creature && sh.isBossCreature);
    }, undefined, { timeout: 25_000 });
    await makePlayerImmortal(page, "SurvivalScene");
  },
  campaign: async (page) => {
    await page.evaluate(() =>
      (window as any).__perfHooks.startCampaignMission("terran_hegemony", "heg_1_3"),
    );
    await waitShips(page, "CampaignBattleScene", 4);
    await makePlayerImmortal(page, "CampaignBattleScene");
  },
};

async function waitShips(page: Page, key: string, min: number): Promise<void> {
  await page.waitForFunction(
    ({ key: k, min: m }) => ((window as any).game.scene.getScene(k)?.ships?.size ?? 0) >= m,
    { key, min },
    { timeout: GAME_READY_TIMEOUT_MS },
  );
}

/** Keeps the fight going for the whole sample: the player's ships cannot die. */
async function makePlayerImmortal(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => {
    const s = (window as any).game.scene.getScene(k);
    const huge = 1e7;
    for (const ship of s.ships.values()) {
      if (ship.owner !== "player") continue;
      ship.hull = ship.maxHull = ship.shields = ship.maxShields = huge;
    }
  }, key);
}

/** Samples frame deltas, ship count, space quality and heap once per second. */
async function sample(page: Page, key: string, seconds: number): Promise<Sample> {
  return page.evaluate(
    ({ k, ms, warm }) =>
      new Promise<any>((resolve) => {
        const result = { deltas: [] as number[], steps: [] as number[], gaps: [] as number[][], updates: [] as number[], renders: [] as number[], ships: [] as number[], quality: [] as number[], heapMb: [] as number[] };
        let stepStart = 0;
        let renderStart = 0;
        let counting = false;
        const events = (window as any).game.events;
        events.on("prestep", () => { stepStart = performance.now(); });
        events.on("poststep", () => { if (counting) result.updates.push(performance.now() - stepStart); });
        events.on("prerender", () => { renderStart = performance.now(); });
        events.on("postrender", () => { if (counting) result.steps.push(performance.now() - stepStart); if (counting) result.renders.push(performance.now() - renderStart); });
        const scene = () => (window as any).game.scene.getScene(k);
        const governorLevel = (): number => {
          const listeners = scene()?.events?._events?.prerender;
          const list = Array.isArray(listeners) ? listeners : [listeners];
          const view = list.map((l: any) => l?.context).find((c: any) => c?.governor);
          return view ? view.governor.quality : -1;
        };
        const start = performance.now();
        let last = start;
        let nextSecond = start + warm + 1000;
        const tick = (now: number): void => {
          counting = now - start > warm;
          if (counting) result.deltas.push(now - last);
          if (counting && now - last > 200) result.gaps.push([Math.round((now - start) / 100) / 10, Math.round(now - last)]);
          last = now;
          if (now >= nextSecond) {
            nextSecond += 1000;
            result.ships.push(scene()?.ships?.size ?? 0);
            result.quality.push(governorLevel());
            result.heapMb.push(Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1048576));
          }
          if (now - start < warm + ms) requestAnimationFrame(tick);
          else resolve(result);
        };
        requestAnimationFrame(tick);
      }),
    { k: key, ms: seconds * SECOND_MS, warm: WARMUP_MS },
  );
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

function mean_(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function summarize(data: Sample): Record<string, number | number[]> {
  const sorted = [...data.deltas].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, d) => sum + d, 0) / Math.max(1, sorted.length);
  const fps = (ms: number): number => Math.round((SECOND_MS / ms) * 10) / 10;
  return {
    frames: sorted.length,
    avgFps: fps(mean),
    p5Fps: fps(percentile(sorted, 95)),
    low1Fps: fps(percentile(sorted, 99)),
    frameMsP95: Math.round(percentile(sorted, 95) * 10) / 10,
    frameMsMax: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
    stepMsMean: Math.round(mean_(data.steps) * 100) / 100,
    updateMsMean: Math.round(mean_(data.updates) * 100) / 100,
    renderMsMean: Math.round(mean_(data.renders) * 100) / 100,
    stepMsP95: Math.round(percentile([...data.steps].sort((a, b) => a - b), 95) * 100) / 100,
    gaps: data.gaps as unknown as number[],
    ships: data.ships,
    spaceQuality: data.quality,
    heapMb: data.heapMb,
  };
}

const SCENE_KEY: Record<string, string> = {
  menu: "MainMenuScene",
  epic: "ArcadeBattleScene",
  survival40: "SurvivalScene",
  boss: "SurvivalScene",
  campaign: "CampaignBattleScene",
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const results: Record<string, unknown> = { args };
  for (const name of args.scenarios) {
    const browser = await chromium.launch({
      headless: !args.headed,
      args: launchArgs(args.gpu),
      ignoreDefaultArgs: ["--enable-automation"],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    // tsx (esbuild keepNames) wraps the callbacks sent to the page in __name().
    await page.addInitScript("window.__name = (fn) => fn;");
    await page.goto(`${args.base}/?debug=1`);
    await page
      .waitForFunction(
        () => (window as any).game?.isBooted && (window as any).game.scene.isActive("MainMenuScene"),
        undefined,
        { timeout: GAME_READY_TIMEOUT_MS },
      )
      .catch((error) => {
        throw new Error(`${name}: game did not boot (${errors.join(" | ")}): ${error}`);
      });
    await page.waitForTimeout(2500);
    const env = await page.evaluate(() => {
      const gl = (window as any).game.renderer.gl as WebGLRenderingContext | undefined;
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return { rendererType: (window as any).game.renderer.type, gpu: info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "canvas" };
    });
    await SETUP[name]!(page);
    if (args.throttle > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: args.throttle });
    }
    const data = await sample(page, SCENE_KEY[name]!, args.seconds);
    results[name] = { env, ...summarize(data), errors: errors.slice(0, 5) };
    console.log(name, JSON.stringify(results[name]));
    await browser.close();
  }
  writeFileSync(args.out, JSON.stringify(results, null, 2));
  console.log("written", args.out);
}

void main();

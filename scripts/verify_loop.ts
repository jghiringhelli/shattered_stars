/**
 * Verify Loop — phase collapse → recover → verify → regenerate.
 *
 * Drives the running game at its boundary and checks the invariants in
 * docs/specs/verify-loop.md. On failure it prints a regeneration block (which spec
 * and source to reload) instead of guessing a patch.
 *
 * Requires the Vite dev server on port 3003 (npm run dev).
 * Usage: npm run verify:loop   (set ANTHROPIC_API_KEY to enable the vision check)
 */

import { chromium, type Page, type Browser } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { waitForScene, takeShot, callVision } from "./vqa_helpers";
import { SPEED_SCALE_FACTOR, SHIP_SIZES } from "../src/config";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3003";
const OUT_DIR = path.join(
  "screenshots",
  "verify",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
);
const STEP_BUDGET = 5 * SPEED_SCALE_FACTOR + SHIP_SIZES.huge;

interface Scenario {
  readonly name: string;
  readonly sceneKey: string;
  readonly requiresPlayer: boolean;
  readonly runMs: number;
  readonly start: StartSpec;
  /** Exact expected ship count. Omit for dynamic-spawn modes (INV-1 becomes >=1). */
  readonly expected?: number;
  /** Scene method to call right after boot (e.g. Dogfight's setup screen needs startMatch()). */
  readonly postStartMethod?: string;
}

/** How a scenario boots its scene at the game's boundary. */
type StartSpec =
  | { readonly via: "registry"; readonly battleConfig: Record<string, unknown> }
  | { readonly via: "init"; readonly data: Record<string, unknown> }
  | { readonly via: "hook"; readonly hook: string; readonly arg: string };

interface Ship {
  id: string;
  owner: string;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
}
interface Sample {
  shipId: string;
  x: number;
  y: number;
}
interface Capture {
  ships: Ship[];
  projectiles: number;
  samples: Sample[];
  errors: string[];
  shot: string;
  expected: number | null;
}
interface Inv {
  id: string;
  must: boolean;
  passed: boolean;
  detail: string;
}
interface Report {
  scenario: string;
  passed: boolean;
  invariants: Inv[];
}

const REGISTRY_2V2: Record<string, unknown> = {
  factions: [
    {
      factionId: "free_confederation",
      controller: "player",
      ships: ["confed_sparrow", "confed_wasp"],
    },
    {
      factionId: "terran_hegemony",
      controller: "ai",
      ships: ["terran_viper", "terran_gladius"],
    },
  ],
};

const SCENARIOS: Scenario[] = [
  {
    name: "arcade-2v2",
    sceneKey: "ArcadeBattleScene",
    requiresPlayer: true,
    runMs: 3_000,
    expected: 4,
    start: { via: "registry", battleConfig: REGISTRY_2V2 },
  },
  {
    name: "continuous-2v2",
    sceneKey: "ContinuousTacticalScene",
    requiresPlayer: true,
    runMs: 3_000,
    expected: 4,
    start: { via: "registry", battleConfig: REGISTRY_2V2 },
  },
  {
    name: "survival-solo",
    sceneKey: "SurvivalScene",
    requiresPlayer: true,
    runMs: 3_500,
    start: { via: "init", data: { factionId: "free_confederation" } },
  },
  {
    name: "campaign-mission1",
    sceneKey: "CampaignBattleScene",
    requiresPlayer: true,
    runMs: 2_500,
    start: {
      via: "hook",
      hook: "__verifyStartCampaign",
      arg: "free_confederation",
    },
  },
  {
    name: "dogfight-1v1",
    sceneKey: "DogfightScene",
    requiresPlayer: true,
    runMs: 3_000,
    expected: 2,
    start: { via: "init", data: {} },
    postStartMethod: "startMatch",
  },
];

/** COLLAPSE: stop active scenes and boot the target scene by its start strategy. */
async function collapse(page: Page, s: Scenario): Promise<boolean> {
  await page.evaluate(
    (spec: { sceneKey: string; start: StartSpec }) => {
      const g = (window as any).game;
      const active: any[] = g.scene.getScenes(true) ?? [];
      for (const sc of active) g.scene.stop(sc.sys.settings.key);
      const start = spec.start;
      setTimeout(() => {
        if (start.via === "registry") {
          g.registry.set("battleConfig", start.battleConfig);
          g.scene.start(spec.sceneKey);
        } else if (start.via === "init") {
          g.scene.start(spec.sceneKey, start.data);
        } else {
          const fn = (window as any)[start.hook];
          if (typeof fn === "function") fn(start.arg);
        }
      }, 120);
    },
    { sceneKey: s.sceneKey, start: s.start },
  );
  try {
    await waitForScene(page, s.sceneKey, 15_000);
    if (s.postStartMethod) {
      await page.evaluate(
        (spec: { sceneKey: string; method: string }) => {
          const scene = (window as any).game?.scene.getScene(
            spec.sceneKey,
          ) as any;
          scene?.[spec.method]?.();
        },
        { sceneKey: s.sceneKey, method: s.postStartMethod },
      );
    }
    return true;
  } catch {
    return false;
  }
}

/** RECOVER: run the window, then capture live state, telemetry and a screenshot. */
async function recover(
  page: Page,
  s: Scenario,
  errors: string[],
): Promise<Capture> {
  await page.waitForTimeout(s.runMs);
  const ships = (await page.evaluate((key: string) => {
    const scene = (window as any).game?.scene.getScene(key) as any;
    const map = scene?.ships;
    const src = map ? Array.from(map.values()) : [];
    return src.map((sh: any) => ({
      id: sh.id,
      owner: sh.owner,
      x: sh.x,
      y: sh.y,
      angle: sh.angle,
      hull: sh.hull,
      maxHull: sh.maxHull ?? sh.hull,
    }));
  }, s.sceneKey)) as Ship[];
  const projectiles = (await page.evaluate((key: string) => {
    const scene = (window as any).game?.scene.getScene(key) as any;
    // Primaries resolve instantly; only ordnance flies as projectiles.
    return scene?.secondaryWeapons?.runtime?.shotsInFlight?.length ?? 0;
  }, s.sceneKey)) as number;
  const samples = (await page.evaluate(() => {
    const t = (window as any).__shipTelemetry;
    return t?.getSamples
      ? t.getSamples().map((x: any) => ({ shipId: x.shipId, x: x.x, y: x.y }))
      : [];
  })) as Sample[];
  const shot = await takeShot(page, OUT_DIR, s.name);
  return {
    ships,
    projectiles,
    samples,
    errors: [...errors],
    shot,
    expected: s.expected ?? null,
  };
}

/**
 * Console errors that are induced by the harness forcing a scene restart (COLLAPSE)
 * and are NOT gameplay-state defects. Tracked as a SHOULD finding, never as a MUST
 * failure. See docs/specs/verify-loop.md § Error classification.
 */
const KNOWN_REENTRY_ERRORS = [/Texture key already in use/i];

/**
 * Optional-asset load/decode failures. The game treats missing encyclopedia art as
 * expected (BootScene silences these) and falls back to placeholders, so they are not
 * gameplay-state defects — but each names a real asset to (re)generate. Reported under
 * INV-6c with the failing keys as an actionable worklist for the asset audit.
 */
const KNOWN_ASSET_ERRORS = [
  /Failed to process file/i,
  /Failed to load resource/i,
];

function matchesAny(msg: string, res: RegExp[]): boolean {
  return res.some((re) => re.test(msg));
}

/** Extract the trailing asset key from a Phaser "Failed to process file" message. */
function assetKey(msg: string): string {
  const m = msg.match(/(?:image|texture)\s+(\S+)\s*$/i);
  return m?.[1] ?? msg.slice(-40);
}

/** Largest per-frame step per ship, and count of non-finite steps. */
function stepStats(samples: Sample[]): { max: number; nan: number } {
  const byShip = new Map<string, Sample[]>();
  for (const s of samples) {
    if (!byShip.has(s.shipId)) byShip.set(s.shipId, []);
    byShip.get(s.shipId)!.push(s);
  }
  let max = 0;
  let nan = 0;
  for (const list of byShip.values()) {
    for (let i = 1; i < list.length; i++) {
      const step = Math.hypot(
        list[i]!.x - list[i - 1]!.x,
        list[i]!.y - list[i - 1]!.y,
      );
      if (!Number.isFinite(step)) nan++;
      else max = Math.max(max, step);
    }
  }
  return { max, nan };
}

/** VERIFY: evaluate the invariants for one capture. */
async function verify(cap: Capture, s: Scenario): Promise<Inv[]> {
  const inv: Inv[] = [];
  const exp = cap.expected;
  inv.push({
    id: "INV-1 ship count",
    must: true,
    passed: exp == null ? cap.ships.length >= 1 : cap.ships.length === exp,
    detail:
      exp == null
        ? `${cap.ships.length} (dynamic, >=1)`
        : `${cap.ships.length}/${exp}`,
  });
  const players = cap.ships.filter((x) => x.owner === "player").length;
  inv.push({
    id: "INV-2 player present",
    must: true,
    passed: !s.requiresPlayer || players >= 1,
    detail: `${players} player ship(s)`,
  });
  const finite = cap.ships.every((x) =>
    [x.x, x.y, x.angle].every(Number.isFinite),
  );
  inv.push({
    id: "INV-3 finite positions",
    must: true,
    passed: finite,
    detail: finite ? "all finite" : "NaN/Inf found",
  });
  const hullOk = cap.ships.every((x) => x.hull >= 0 && x.hull <= x.maxHull);
  inv.push({
    id: "INV-4 hull bounds",
    must: true,
    passed: hullOk,
    detail: hullOk ? "0<=hull<=max" : "out of range",
  });
  const st = stepStats(cap.samples);
  inv.push({
    id: "INV-5 no teleport",
    must: true,
    passed: st.nan === 0 && st.max <= STEP_BUDGET,
    detail: `maxStep ${st.max.toFixed(1)}<=${STEP_BUDGET}, ${st.nan} NaN, ${cap.samples.length} samples`,
  });
  const fatal = cap.errors.filter(
    (e) =>
      !matchesAny(e, KNOWN_REENTRY_ERRORS) &&
      !matchesAny(e, KNOWN_ASSET_ERRORS),
  );
  const known = cap.errors.filter((e) => matchesAny(e, KNOWN_REENTRY_ERRORS));
  const assets = [
    ...new Set(
      cap.errors.filter((e) => matchesAny(e, KNOWN_ASSET_ERRORS)).map(assetKey),
    ),
  ];
  inv.push({
    id: "INV-6 no fatal errors",
    must: true,
    passed: fatal.length === 0,
    detail: fatal[0]?.slice(0, 80) ?? "clean",
  });
  inv.push({
    id: "INV-6b re-entry noise",
    must: false,
    passed: known.length === 0,
    detail: known.length
      ? `${known.length} known (${known[0]!.slice(0, 50)})`
      : "none",
  });
  inv.push({
    id: "INV-6c asset gaps",
    must: false,
    passed: assets.length === 0,
    detail: assets.length
      ? `${assets.length}: ${assets.slice(0, 6).join(", ")}`
      : "none",
  });
  if (process.env["ANTHROPIC_API_KEY"]) {
    const text = await callVision(
      cap.shot,
      'Reply JSON {"ships_visible":bool,"hud_present":bool,"glitch":bool}. Space combat screenshot.',
    );
    const ok =
      /"ships_visible"\s*:\s*true/.test(text) &&
      !/"glitch"\s*:\s*true/.test(text);
    inv.push({
      id: "INV-7 vision",
      must: false,
      passed: ok,
      detail: text.replace(/\s+/g, " ").slice(0, 80),
    });
  }
  return inv;
}

/** REGENERATE: on failure, point at the spec + source to regenerate (not patch). */
function printRegenerate(r: Report): void {
  const failed = r.invariants.filter((i) => i.must && !i.passed);
  if (failed.length === 0) return;
  console.log(`\n  REGENERATE [${r.scenario}] — do not patch symptoms:`);
  for (const f of failed) console.log(`    - ${f.id}: ${f.detail}`);
  console.log(
    "    Reload spec: docs/specs/verify-loop.md + docs/spec-map.md → the failing slice",
  );
  console.log(
    "    Regenerate that slice from spec with full current file context, then re-run.",
  );
}

async function runScenario(browser: Browser, s: Scenario): Promise<Report> {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/WebGL|favicon|Failed to load resource/i.test(m.text())
    )
      errors.push(m.text());
  });
  await page.goto(`${BASE_URL}/?debug=1`, { waitUntil: "load" });
  await page.waitForFunction(() => (window as any).game?.isBooted === true, {
    timeout: 30_000,
  });
  const started = await collapse(page, s);
  if (!started) {
    await page.close();
    return {
      scenario: s.name,
      passed: false,
      invariants: [
        {
          id: "COLLAPSE",
          must: true,
          passed: false,
          detail: "scene did not start",
        },
      ],
    };
  }
  const cap = await recover(page, s, errors);
  const invariants = await verify(cap, s);
  await page.close();
  return {
    scenario: s.name,
    passed: invariants.every((i) => !i.must || i.passed),
    invariants,
  };
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(
      "Could not launch chromium. Run `npx playwright install chromium`.",
      e,
    );
    process.exit(2);
  }
  const reports: Report[] = [];
  for (const s of SCENARIOS) {
    console.log(`\n== ${s.name} (${s.sceneKey}) ==`);
    try {
      reports.push(await runScenario(browser, s));
    } catch (e) {
      reports.push({
        scenario: s.name,
        passed: false,
        invariants: [
          {
            id: "RUN",
            must: true,
            passed: false,
            detail: String(e).slice(0, 120),
          },
        ],
      });
    }
  }
  await browser.close();

  for (const r of reports) {
    console.log(`\n${r.passed ? "PASS" : "FAIL"}  ${r.scenario}`);
    for (const i of r.invariants)
      console.log(
        `  ${i.passed ? "✓" : i.must ? "✗" : "⚠"} ${i.id.padEnd(24)} ${i.detail}`,
      );
    printRegenerate(r);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(reports, null, 2),
  );
  console.log(`\nReport: ${path.join(OUT_DIR, "report.json")}`);
  process.exit(reports.every((r) => r.passed) ? 0 : 1);
}

main();

/**
 * Playthrough Director — deep, session-length QA harness across every game
 * mode. Combines continuous telemetry, archetype stress drills, event-driven
 * Claude Vision checkpoints, and console/error capture into one JSON report
 * plus a per-mode natural-language verdict: bugs, visual polish, usability
 * friction, incomplete features, and — the primary goal — whether the
 * movement-driven ship-role design produced real differentiation and whether
 * play was fun.
 *
 * Unlike verify_loop.ts (a fast single-snapshot MUST-gate for CI), the
 * Director never blocks CI; it produces a report for human review. Vision
 * calls are event-driven (start/end checkpoints + drill end), never per-frame,
 * and are skipped entirely (zero cost) unless ANTHROPIC_API_KEY is set.
 *
 * Requires the Vite dev server on port 3003 (npm run dev).
 * Usage: npm run playthrough:director   (set ANTHROPIC_API_KEY to enable vision)
 */

import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { takeShot } from "./vqa_helpers";
import {
  collapse,
  MODE_SCENARIOS,
  ROLE_DRILL_SCENARIOS,
} from "./playthrough/scenarios";
import {
  recordTelemetry,
  computeRoleFidelity,
  rankRoleDifferentiation,
} from "./playthrough/telemetry";
import { runDrillWithTelemetry } from "./playthrough/drills";
import { analyzeScreenshot, synthesizeModeVerdict } from "./playthrough/vision";
import type {
  ModeReport,
  ModeScenario,
  RoleFidelityScore,
  TelemetryFrame,
  VisionFinding,
  FrictionEvent,
} from "./playthrough/types";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3003";
const OUT_DIR = path.join(
  "screenshots",
  "playthrough",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
);

/** Console noise the harness itself induces on scene restart — not a gameplay defect. */
const KNOWN_NOISE = [
  /Texture key already in use/i,
  /Failed to process file/i,
  /Failed to load resource/i,
];

/** Findings statically known from prior audits, surfaced for context, not re-derived live. */
const KNOWN_STATIC_FINDINGS: readonly string[] = [
  "incomplete_feature: no s_turn action exists (only segnor_left/right) — naming mismatch with design docs",
  "orphaned_mode: TurnBasedBattleScene is not registered in src/main.ts and absent from the GameMode union",
];

interface InstrumentedPage {
  readonly page: Page;
  readonly errors: string[];
  readonly friction: FrictionEvent[];
}

async function newInstrumentedPage(
  browser: Browser,
): Promise<InstrumentedPage> {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors: string[] = [];
  const friction: FrictionEvent[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" && !KNOWN_NOISE.some((re) => re.test(text)))
      errors.push(text);
    if (m.type() === "warning")
      friction.push({
        tMs: Date.now(),
        kind: "console_warning",
        detail: text.slice(0, 160),
      });
  });
  await page.goto(`${BASE_URL}/?debug=1`, { waitUntil: "load" });
  await page.waitForFunction(() => (window as any).game?.isBooted === true, {
    timeout: 30_000,
  });
  return { page, errors, friction };
}

function emptyReport(s: ModeScenario, errors: readonly string[]): ModeReport {
  return {
    mode: s.mode,
    sceneKey: s.sceneKey,
    durationMs: s.durationMs,
    telemetrySampleCount: 0,
    roleFidelity: [],
    frictionEvents: [],
    consoleErrors: [...errors],
    visionFindings: [],
    finalVerdict: null,
  };
}

function buildReport(
  s: ModeScenario,
  frames: readonly TelemetryFrame[],
  roleFidelity: readonly RoleFidelityScore[],
  findings: readonly VisionFinding[],
  friction: readonly FrictionEvent[],
  errors: readonly string[],
): ModeReport {
  return {
    mode: s.mode,
    sceneKey: s.sceneKey,
    durationMs: s.durationMs,
    telemetrySampleCount: frames.length,
    roleFidelity,
    frictionEvents: friction,
    consoleErrors: errors,
    visionFindings: findings,
    finalVerdict: null,
  };
}

/** Boots a mode and either pilots its drill (if any) or watches it run unattended (AI-driven). */
async function runModeScenario(
  browser: Browser,
  s: ModeScenario,
): Promise<ModeReport> {
  const { page, errors, friction } = await newInstrumentedPage(browser);
  const started = await collapse(page, s.sceneKey, s.start);
  if (!started) {
    await page.close();
    return emptyReport(s, [...errors, "scene did not start"]);
  }

  if (s.postStartMethod) {
    await page.evaluate(
      ({ key, method }: { key: string; method: string }) => {
        const scene = (window as any).game?.scene.getScene(key) as any;
        scene?.[method]?.();
      },
      { key: s.sceneKey, method: s.postStartMethod },
    );
  }

  const findings: VisionFinding[] = [];
  const shotStart = await takeShot(page, OUT_DIR, `${s.mode}-start`);
  const startFinding = await analyzeScreenshot(shotStart, `${s.mode} start`);
  if (startFinding) findings.push(startFinding);

  const shipsVia = s.shipsVia ?? "ships";
  const frames = s.drill
    ? await runDrillWithTelemetry(
        page,
        s.drill,
        s.sceneKey,
        shipsVia,
        Date.now(),
      )
    : await recordTelemetry(page, s.sceneKey, shipsVia, s.durationMs);

  const shotEnd = await takeShot(page, OUT_DIR, `${s.mode}-end`);
  const endFinding = await analyzeScreenshot(shotEnd, `${s.mode} end`);
  if (endFinding) findings.push(endFinding);

  await page.close();
  return buildReport(s, frames, [], findings, friction, errors);
}

/** Boots a role-drill scenario and actively pilots the standardized stress drill. */
async function runDrillScenario(
  browser: Browser,
  s: ModeScenario,
): Promise<{
  readonly report: ModeReport;
  readonly score: RoleFidelityScore | null;
}> {
  const { page, errors, friction } = await newInstrumentedPage(browser);
  const started = await collapse(page, s.sceneKey, s.start);
  if (!started) {
    await page.close();
    return {
      report: emptyReport(s, [...errors, "scene did not start"]),
      score: null,
    };
  }

  const startMs = Date.now();
  const frames = await runDrillWithTelemetry(
    page,
    s.drill!,
    s.sceneKey,
    "ships",
    startMs,
  );
  const shot = await takeShot(page, OUT_DIR, s.mode);
  const finding = await analyzeScreenshot(shot, s.mode);

  const playerShipId = frames.find((f) => f.owner === "player")?.shipId ?? "";
  const score = computeRoleFidelity(
    frames,
    playerShipId,
    s.playerShipRole!,
    s.drill!.name,
  );
  await page.close();
  return {
    report: buildReport(
      s,
      frames,
      [],
      finding ? [finding] : [],
      friction,
      errors,
    ),
    score,
  };
}

function statsSummary(r: ModeReport): string {
  return `${r.telemetrySampleCount} telemetry samples, ${r.consoleErrors.length} console errors, ${r.frictionEvents.length} friction events`;
}

/** ONE closing text-only call per mode, folding in aggregated stats + vision findings. */
async function withVerdict(r: ModeReport): Promise<ModeReport> {
  const finalVerdict = await synthesizeModeVerdict(
    r.mode,
    statsSummary(r),
    r.visionFindings,
    r.frictionEvents.map((f) => f.detail),
    r.consoleErrors,
  );
  console.log(`\n[${r.mode}] ${finalVerdict}`);
  return { ...r, finalVerdict };
}

async function runAllModes(
  browser: Browser,
  scenarios: readonly ModeScenario[],
): Promise<ModeReport[]> {
  const reports: ModeReport[] = [];
  for (const s of scenarios) {
    console.log(`\n== mode: ${s.mode} (${s.sceneKey}) ==`);
    reports.push(await runModeScenario(browser, s));
  }
  return reports;
}

async function runAllDrills(
  browser: Browser,
  scenarios: readonly ModeScenario[],
): Promise<{
  readonly reports: ModeReport[];
  readonly scores: RoleFidelityScore[];
}> {
  const reports: ModeReport[] = [];
  const scores: RoleFidelityScore[] = [];
  for (const s of scenarios) {
    console.log(`\n== drill: ${s.mode} (${s.playerShipRole}) ==`);
    const { report, score } = await runDrillScenario(browser, s);
    reports.push(report);
    if (score) scores.push(score);
  }
  return { reports, scores };
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

  const only = process.env["ONLY"]?.split(",").map((s) => s.trim());
  const modeScenarios = only
    ? MODE_SCENARIOS.filter((s) => only.includes(s.mode))
    : MODE_SCENARIOS;
  const drillScenarios = only
    ? ROLE_DRILL_SCENARIOS.filter((s) => only.includes(s.mode))
    : ROLE_DRILL_SCENARIOS;

  const modeReports = await runAllModes(browser, modeScenarios);
  const { reports: drillReportsRaw, scores } = await runAllDrills(
    browser,
    drillScenarios,
  );
  await browser.close();

  const { scored, findings: roleFindings } = rankRoleDifferentiation(scores);
  const drillReports = drillReportsRaw.map((r) => ({
    ...r,
    roleFidelity: scored.filter((sc) => `role-drill-${sc.role}` === r.mode),
  }));

  const withVerdicts: ModeReport[] = [];
  for (const r of [...modeReports, ...drillReports])
    withVerdicts.push(await withVerdict(r));

  if (roleFindings.length > 0) {
    console.log("\nROLE DIFFERENTIATION FINDINGS:");
    for (const f of roleFindings) console.log(`  - ${f}`);
  }
  console.log(
    "\nKNOWN STATIC FINDINGS (from prior audit, not re-derived live):",
  );
  for (const f of KNOWN_STATIC_FINDINGS) console.log(`  - ${f}`);

  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(
      { reports: withVerdicts, roleFindings, KNOWN_STATIC_FINDINGS },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${path.join(OUT_DIR, "report.json")}`);
  process.exit(0);
}

main();

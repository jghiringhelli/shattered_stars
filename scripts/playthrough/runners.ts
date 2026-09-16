/**
 * Per-scenario runners: boots a scene, drives input (drill or unattended),
 * and assembles the resulting ModeReport. Split out of playthrough_director.ts
 * to stay under the repo's 300-line file limit.
 */

import type { Browser, Page } from "playwright";
import { takeShot } from "../vqa_helpers";
import { collapse } from "./scenarios";
import { recordTelemetry, computeRoleFidelity } from "./telemetry";
import { runDrillWithTelemetry } from "./drills";
import { analyzeScreenshot, synthesizeModeVerdict } from "./vision";
import { emitCardPointerdown } from "./mouse";
import type {
  FrictionEvent,
  ModeReport,
  ModeScenario,
  RoleFidelityScore,
  TelemetryFrame,
  VisionFinding,
} from "./types";

/** Console noise the harness itself induces on scene restart — not a gameplay defect. */
const KNOWN_NOISE = [
  /Texture key already in use/i,
  /Failed to process file/i,
  /Failed to load resource/i,
];

interface InstrumentedPage {
  readonly page: Page;
  readonly errors: string[];
  readonly friction: FrictionEvent[];
}

async function newInstrumentedPage(
  browser: Browser,
  baseUrl: string,
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
  await page.goto(`${baseUrl}/?debug=1`, { waitUntil: "load" });
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
    matchDurationMs: null,
  };
}

function buildReport(
  s: ModeScenario,
  frames: readonly TelemetryFrame[],
  roleFidelity: readonly RoleFidelityScore[],
  findings: readonly VisionFinding[],
  friction: readonly FrictionEvent[],
  errors: readonly string[],
  matchDurationMs: number | null,
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
    matchDurationMs,
  };
}

/** Polls a boolean scene property until true, timestamping elapsed ms (null if it never fires). */
async function watchMatchCompletion(
  page: Page,
  sceneKey: string,
  accessor: string,
  maxMs: number,
): Promise<number | null> {
  const startMs = Date.now();
  try {
    await page.waitForFunction(
      ({ key, prop }: { key: string; prop: string }) => {
        const scene = (window as any).game?.scene.getScene(key) as any;
        return scene?.[prop] === true;
      },
      { key: sceneKey, prop: accessor },
      { timeout: maxMs, polling: 250 },
    );
    return Date.now() - startMs;
  } catch {
    return null;
  }
}

/** Survival's Wave power/escort/hangar drafts only advance on a card pick — auto-picks the first card. */
async function watchAndDismissSurvivalChoice(
  page: Page,
  sceneKey: string,
  maxMs: number,
): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const isOpen = await page.evaluate(
      (key: string) =>
        (window as any).game?.scene.getScene(key)?.choicePanel?.isOpen === true,
      sceneKey,
    );
    if (isOpen) await emitCardPointerdown(page, sceneKey, "choicePanel", 0);
    await page.waitForTimeout(500);
  }
}

/** Boots a mode and either pilots its drill (if any) or watches it run unattended (AI-driven). */
export async function runModeScenario(
  browser: Browser,
  s: ModeScenario,
  outDir: string,
  baseUrl: string,
): Promise<ModeReport> {
  const { page, errors, friction } = await newInstrumentedPage(
    browser,
    baseUrl,
  );
  const started = await collapse(page, s.sceneKey, s.start);
  if (!started) {
    await page.close();
    return emptyReport(s, [...errors, "scene did not start"]);
  }
  if (s.postStartMethod) {
    await page.evaluate(
      ({ key, method }: { key: string; method: string }) => {
        (window as any).game?.scene.getScene(key)?.[method]?.();
      },
      { key: s.sceneKey, method: s.postStartMethod },
    );
  }

  const matchWatch = s.matchCompleteAccessor
    ? watchMatchCompletion(
        page,
        s.sceneKey,
        s.matchCompleteAccessor,
        s.durationMs * 3,
      )
    : Promise.resolve(null);
  const dismissWatch =
    s.mode === "survival"
      ? watchAndDismissSurvivalChoice(page, s.sceneKey, s.durationMs)
      : Promise.resolve();

  const findings: VisionFinding[] = [];
  const shotStart = await takeShot(page, outDir, `${s.mode}-start`);
  const startFinding = await analyzeScreenshot(shotStart, `${s.mode} start`);
  if (startFinding) findings.push(startFinding);

  const frames = s.drill
    ? await runDrillWithTelemetry(page, s.drill, s.sceneKey, Date.now())
    : await recordTelemetry(page, s.sceneKey, s.durationMs);

  const matchDurationMs = await matchWatch;
  await dismissWatch;

  const shotEnd = await takeShot(page, outDir, `${s.mode}-end`);
  const endFinding = await analyzeScreenshot(shotEnd, `${s.mode} end`);
  if (endFinding) findings.push(endFinding);

  await page.close();
  return buildReport(
    s,
    frames,
    [],
    findings,
    friction,
    errors,
    matchDurationMs,
  );
}

/** Boots a role-drill scenario and actively pilots the standardized stress drill. */
export async function runDrillScenario(
  browser: Browser,
  s: ModeScenario,
  outDir: string,
  baseUrl: string,
): Promise<{
  readonly report: ModeReport;
  readonly score: RoleFidelityScore | null;
}> {
  const { page, errors, friction } = await newInstrumentedPage(
    browser,
    baseUrl,
  );
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
  const shot = await takeShot(page, outDir, s.mode);
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
      null,
    ),
    score,
  };
}

function statsSummary(r: ModeReport): string {
  const pacing =
    r.matchDurationMs != null
      ? `, match ended after ${(r.matchDurationMs / 1000).toFixed(1)}s`
      : "";
  return `${r.telemetrySampleCount} telemetry samples, ${r.consoleErrors.length} console errors, ${r.frictionEvents.length} friction events${pacing}`;
}

/** ONE closing text-only call per mode, folding in aggregated stats + vision findings. */
export async function withVerdict(r: ModeReport): Promise<ModeReport> {
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

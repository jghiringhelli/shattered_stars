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

import { chromium, type Browser } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { MODE_SCENARIOS, ROLE_DRILL_SCENARIOS } from "./playthrough/scenarios";
import { rankRoleDifferentiation } from "./playthrough/telemetry";
import {
  runModeScenario,
  runDrillScenario,
  withVerdict,
} from "./playthrough/runners";
import type {
  ModeReport,
  ModeScenario,
  RoleFidelityScore,
} from "./playthrough/types";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3003";
const OUT_DIR = path.join(
  "screenshots",
  "playthrough",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
);

/** Findings statically known from prior audits, surfaced for context, not re-derived live. */
const KNOWN_STATIC_FINDINGS: readonly string[] = [
  "incomplete_feature: no s_turn action exists (only segnor_left/right) — naming mismatch with design docs",
  "orphaned_mode: TurnBasedBattleScene is not registered in src/main.ts and absent from the GameMode union",
];

async function runAllModes(
  browser: Browser,
  scenarios: readonly ModeScenario[],
): Promise<ModeReport[]> {
  const reports: ModeReport[] = [];
  for (const s of scenarios) {
    console.log(`\n== mode: ${s.mode} (${s.sceneKey}) ==`);
    reports.push(await runModeScenario(browser, s, OUT_DIR, BASE_URL));
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
    const { report, score } = await runDrillScenario(
      browser,
      s,
      OUT_DIR,
      BASE_URL,
    );
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

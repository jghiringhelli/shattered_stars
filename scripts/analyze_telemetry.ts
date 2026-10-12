/**
 * Telemetry analyzer — X-Wing 2.0 geometric fidelity report.
 *
 * Compares the game's per-cycle movement (via resolveManeuver) against the physical
 * X-Wing 2.0 reference in docs/specs/telemetry-xwing-reference.md and prints a
 * pass / warn / fail table per RFC 2119 gate (MOV-1..MOV-6).
 *
 * Optionally validates a live run: pass --samples <file.json> containing the array
 * returned by window.__shipTelemetry.getSamples() (captured from a Playwright
 * `?debug=1` session) to confirm the running game matches the pure function.
 *
 * Usage:
 *   npx tsx scripts/analyze_telemetry.ts
 *   npx tsx scripts/analyze_telemetry.ts --samples telemetry.json
 */

import { readFileSync } from "node:fs";
import {
  SPEED_SCALE_FACTOR,
  SHIP_SIZES,
  CYCLE_DURATION_MS,
  type ShipSize,
} from "../src/config";
import {
  measureManeuver,
  expectedStraightPx,
  normalizeDelta,
  XWING_FACING_CHANGE,
  XWING_BASE_MM,
  TRUE_ARC_CHORD,
  DIAL_DIRECTIONS,
} from "../src/simulation/XWingReference";

type Verdict = "PASS" | "WARN" | "FAIL";
interface Row {
  readonly gate: string;
  readonly detail: string;
  readonly verdict: Verdict;
}

const SPEEDS = [1, 2, 3, 4, 5] as const;
/**
 * The X-Wing dial directions only: the arcade-only drift templates have no
 * X-Wing facing to compare against (XWingReference.NON_DIAL_DIRECTIONS).
 */
const DIRECTIONS = DIAL_DIRECTIONS;
const EPS = 1e-6;

/** MOV-1: straight displacement = speed*40 + baseSize. */
function checkStraight(rows: Row[]): void {
  let worst = 0;
  for (const speed of SPEEDS) {
    const m = measureManeuver("straight", speed, "small");
    worst = Math.max(
      worst,
      Math.abs(m.displacementPx - expectedStraightPx(speed, "small")),
    );
  }
  rows.push({
    gate: "MOV-1 straight length (MUST)",
    detail: `max error ${worst.toFixed(4)} px vs speed*40+base`,
    verdict: worst < EPS ? "PASS" : "FAIL",
  });
}

/** MOV-2: facing changes match X-Wing 2.0. */
function checkFacing(rows: Row[]): void {
  const bad = DIRECTIONS.filter(
    (d) =>
      measureManeuver(d, 2, "small").facingChangeDeg !==
      normalizeDelta(XWING_FACING_CHANGE[d]),
  );
  rows.push({
    gate: "MOV-2 facing change (MUST)",
    detail: bad.length
      ? `mismatch: ${bad.join(", ")}`
      : `all ${DIRECTIONS.length} dial directions match`,
    verdict: bad.length ? "FAIL" : "PASS",
  });
}

/** MOV-3: 90° turn chord is a true quarter-arc. */
function checkTurnChord(rows: Row[]): void {
  const t = measureManeuver("turn_right", 3, "small");
  const err = Math.hypot(
    Math.abs(t.chordUnit.x) - TRUE_ARC_CHORD.turn.x,
    t.chordUnit.y - TRUE_ARC_CHORD.turn.y,
  );
  rows.push({
    gate: "MOV-3 turn chord (MUST)",
    detail: `chord error ${err.toFixed(4)} vs true 45° arc`,
    verdict: err < 1e-3 ? "PASS" : "FAIL",
  });
}

/** MOV-5: bank chord vs true 22.5° arc (SHOULD). */
function checkBankChord(rows: Row[]): void {
  const b = measureManeuver("bank_right", 1, "small");
  const angle = (Math.atan2(b.chordUnit.x, -b.chordUnit.y) * 180) / Math.PI;
  const trueAngle =
    (Math.atan2(TRUE_ARC_CHORD.bank.x, -TRUE_ARC_CHORD.bank.y) * 180) / Math.PI;
  const dev = Math.abs(angle - trueAngle);
  rows.push({
    gate: "MOV-5 bank chord (SHOULD)",
    detail: `chord ${angle.toFixed(1)}° vs true ${trueAngle.toFixed(1)}° (Δ${dev.toFixed(1)}°) — ADR-0001`,
    verdict: dev < 1 ? "PASS" : "WARN",
  });
}

/** MOV-6: base scale vs template scale (SHOULD). */
function checkBaseScale(rows: Row[]): void {
  const s = SHIP_SIZES.small / XWING_BASE_MM.small;
  const dev = Math.abs(s - 1);
  rows.push({
    gate: "MOV-6 base scale (SHOULD)",
    detail: `bases at ${s.toFixed(2)} px/mm vs templates 1.00 px/mm — ADR-0001`,
    verdict: dev < 1e-6 ? "PASS" : "WARN",
  });
}

interface Sample {
  readonly t: number;
  readonly shipId: string;
  readonly x: number;
  readonly y: number;
  readonly heading?: number;
}

/** Optional live check: per-cycle step magnitudes from captured telemetry. */
function checkLiveSamples(rows: Row[], path: string): void {
  const samples = JSON.parse(readFileSync(path, "utf8")) as Sample[];
  const byShip = new Map<string, Sample[]>();
  for (const s of samples)
    (byShip.get(s.shipId) ?? byShip.set(s.shipId, []).get(s.shipId)!).push(s);
  let nan = 0;
  let maxStep = 0;
  for (const list of byShip.values()) {
    for (let i = 1; i < list.length; i++) {
      const step = Math.hypot(
        list[i].x - list[i - 1].x,
        list[i].y - list[i - 1].y,
      );
      if (!Number.isFinite(step)) nan++;
      maxStep = Math.max(maxStep, step);
    }
  }
  const budget = 5 * SPEED_SCALE_FACTOR + SHIP_SIZES.huge; // speed 5, largest base
  rows.push({
    gate: "LIVE frame step sanity",
    detail: `${byShip.size} ships, ${samples.length} samples, maxFrameStep ${maxStep.toFixed(1)}px, ${nan} NaN`,
    verdict: nan === 0 && maxStep <= budget ? "PASS" : "FAIL",
  });
}

function referenceTable(): void {
  console.log("\nPer-cycle displacement (px), small base, at S = 1 px/mm:");
  console.log("dir\\speed        1      2      3      4      5");
  for (const dir of DIRECTIONS) {
    const cells = SPEEDS.map((sp) =>
      measureManeuver(dir, sp, "small").displacementPx.toFixed(0).padStart(6),
    ).join(" ");
    console.log(dir.padEnd(14), cells);
  }
  console.log(
    `\nCycle duration: ${CYCLE_DURATION_MS} ms  →  speed N straight ≈ ${80} * N mm/s (tabletop scale)`,
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const samplesIdx = argv.indexOf("--samples");
  const rows: Row[] = [];
  checkStraight(rows);
  checkFacing(rows);
  checkTurnChord(rows);
  checkBankChord(rows);
  checkBaseScale(rows);
  if (samplesIdx >= 0 && argv[samplesIdx + 1])
    checkLiveSamples(rows, argv[samplesIdx + 1]);

  console.log(
    "X-Wing 2.0 telemetry fidelity — docs/specs/telemetry-xwing-reference.md\n",
  );
  for (const r of rows) {
    const mark = r.verdict === "PASS" ? "✓" : r.verdict === "WARN" ? "⚠" : "✗";
    console.log(
      `${mark} ${r.verdict.padEnd(4)} ${r.gate.padEnd(30)} ${r.detail}`,
    );
  }
  referenceTable();

  const failed = rows.filter((r) => r.verdict === "FAIL").length;
  const warned = rows.filter((r) => r.verdict === "WARN").length;
  console.log(
    `\n${failed} FAIL, ${warned} WARN, ${rows.length - failed - warned} PASS`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main();

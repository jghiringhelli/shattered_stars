/**
 * flight-telemetry-live.spec.ts — real keyboard play in every piloted battle
 * mode, sampled every frame, then checked against the X-Wing template oracle.
 *
 * What the live telemetry must show, for the player AND every bot:
 *  - each 500 ms cycle ends where the template of the maneuver it flew puts it
 *    (position and facing), except for the displacement of a boost / barrel
 *    roll performed inside that cycle, which must be exactly its distance;
 *  - mid-cycle poses follow the template arc (no teleports between frames);
 *  - actions respect their recharge (boost, barrel roll, Snap Turn);
 *  - speed cap per maneuver: a cycle is flown at control.cycleSpeed (the set
 *    speed capped by the ship's dial), never above the dial's cap for that
 *    maneuver, back at the set speed on a straight, and classified by a real
 *    dial entry.
 *
 * The headless KeyComboTelemetry battery proves the maneuvers; this spec proves
 * the real input -> scene -> motion chain flies them.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  ACE_DUEL,
  BOSS_RAID,
  CAMPAIGN,
  DOGFIGHT,
  SKIRMISH,
  SURVIVAL,
  type BattleEntry,
} from "./helpers/battleEntry";
import {
  headingDelta,
  predictArcPose,
  predictManeuver,
  templateLength,
  torusDisplacement,
  type Pose,
} from "../../src/simulation/flight/XWingFlightOracle";
import { BOOST_DISTANCE_PX } from "../../src/arcade/ArcadeInputGestures";
import {
  getMovementProfile,
  getShipDial,
} from "../../src/data/ShipDefinitions";
import { capGroupOf } from "../../src/core/speedCap";
import type { ManeuverDirection } from "../../src/core/types";

const WORLD_SIZE = 6000;
const CYCLE_MS = 500;
/** Cycle-end position tolerance for a cycle with no action in it (px). */
const END_POSITION_TOLERANCE_PX = 2;
/** Cycle-end facing tolerance (deg). */
const END_HEADING_TOLERANCE_DEG = 1;
/** Mid-cycle tolerance: the path is a 20-segment polyline (px / deg). */
const ARC_POSITION_TOLERANCE_PX = 5;
const ARC_HEADING_TOLERANCE_DEG = 4;
/** Boost / roll displacement tolerance (px). */
const ACTION_DISTANCE_TOLERANCE_PX = 4;
/** Scheduling slack on recharge timing (ms). */
const RECHARGE_SLACK_MS = 150;
const GESTURES = 34;

interface Sample {
  readonly id: string;
  readonly t: number;
  readonly pose: Pose;
  readonly man: string | null;
  /** The speed this cycle is flown at (control.cycleSpeed). */
  readonly speed: number;
  /** The throttle the pilot set (control.speed). */
  readonly set: number;
  readonly cap: number | null;
  readonly def: string | null;
  readonly prog: number;
  readonly base: number;
  readonly start: Pose | null;
  readonly cd: { readonly k: number; readonly b: number; readonly r: number };
  readonly max: { readonly k: number; readonly b: number; readonly r: number };
  readonly player: boolean;
}

async function installSampler(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate((key) => {
    const w = window as any;
    const scene = w.game.scene.getScene(key);
    const playerId = scene.secondaryWeapons.playerShipId();
    const samples: any[] = [];
    scene.events.on("postupdate", () => {
      const t = performance.now();
      scene.ships.forEach((s: any, id: string) => {
        const m = s.flight ? s.flight.motion : null;
        const control = m ? m.control : s.control;
        if (!control || control.maneuverPath.length === 0) return;
        const pose = m ? m : s;
        const p0 = control.maneuverPath[0];
        samples.push({
          id,
          t,
          pose: { x: pose.x, y: pose.y, angle: pose.angle },
          man: control.currentManeuver,
          speed: control.cycleSpeed,
          set: control.speed,
          cap: control.speedCap,
          def: s.definitionId ?? null,
          prog: control.maneuverProgress,
          base: control.baseSize,
          start: p0 ? { x: p0.x, y: p0.y, angle: p0.angle } : null,
          cd: {
            k: control.kturnCooldown,
            b: control.boostCooldown,
            r: control.barrelRollCooldown,
          },
          max: {
            k: control.kturnCooldownMax,
            b: control.boostCooldownMax,
            r: control.barrelRollCooldownMax,
          },
          player: id === playerId,
        });
      });
    });
    w.__flightSamples = samples;
  }, sceneKey);
}

const readSamples = (page: Page): Promise<Sample[]> =>
  page.evaluate(() => (window as any).__flightSamples);

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function tap(page: Page, key: string, holdMs = 50): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function doubleTap(page: Page, key: string): Promise<void> {
  await tap(page, key);
  await page.waitForTimeout(40);
  await tap(page, key);
}

async function hook(page: Page, arrow: string): Promise<void> {
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await page.keyboard.down(arrow);
  await page.waitForTimeout(120);
  await page.keyboard.up(arrow);
  await page.keyboard.up("z");
}

async function knife(page: Page, arrow: string): Promise<void> {
  await tap(page, "z");
  await page.waitForTimeout(40);
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await page.keyboard.down(arrow);
  await page.waitForTimeout(120);
  await page.keyboard.up(arrow);
  await page.keyboard.up("z");
}

const GESTURE_BOOK: ReadonlyArray<(page: Page) => Promise<void>> = [
  (p) => tap(p, "ArrowLeft", 200),
  (p) => tap(p, "ArrowRight", 200),
  (p) => tap(p, "ArrowLeft", 600),
  (p) => tap(p, "ArrowRight", 600),
  (p) => tap(p, "q"),
  (p) => tap(p, "e"),
  (p) => tap(p, "ArrowUp", 120),
  (p) => tap(p, "ArrowDown", 120),
  (p) => doubleTap(p, "ArrowLeft"),
  (p) => doubleTap(p, "ArrowRight"),
  (p) => doubleTap(p, "ArrowUp"),
  (p) => tap(p, "z"),
  (p) => hook(p, "ArrowLeft"),
  (p) => hook(p, "ArrowRight"),
  (p) => knife(p, "ArrowLeft"),
  (p) => knife(p, "ArrowRight"),
];

/** Seeded random button-mashing: every gesture of the control scheme. */
async function playScript(page: Page, seed: number): Promise<void> {
  const random = mulberry32(seed);
  await page.waitForTimeout(1_500);
  for (let i = 0; i < GESTURES; i++) {
    const gesture = GESTURE_BOOK[Math.floor(random() * GESTURE_BOOK.length)]!;
    await gesture(page);
    await page.waitForTimeout(150 + Math.floor(random() * 700));
  }
  await page.waitForTimeout(1_200);
}

interface Cycle {
  readonly samples: Sample[];
  /** Index of the cycle's first sample in the ship's sample list. */
  readonly from: number;
  /** Throttle set at the end of the previous cycle. */
  readonly previousSet: number;
}

/** Splits one ship's samples into cycles where the progress wraps. */
function toCycles(samples: Sample[]): Cycle[] {
  const cycles: Cycle[] = [];
  let current: Sample[] = [];
  let from = 0;
  let previousSet = samples[0]?.set ?? 0;
  samples.forEach((sample, index) => {
    const previous = current[current.length - 1];
    if (previous && sample.prog < previous.prog - 0.5) {
      cycles.push({ samples: current, from, previousSet });
      previousSet = previous.set;
      current = [];
      from = index;
    }
    current.push(sample);
  });
  return cycles;
}

type ActionKind = "boost" | "roll" | "snap";
interface Performed {
  readonly kind: ActionKind;
  readonly t: number;
  readonly index: number;
}

const COOLDOWN_JUMP_MS = 100;

/** Cooldown rises mark the frames where an action was performed. */
function findActions(samples: Sample[]): Performed[] {
  const found: Performed[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const t = b.t;
    if (b.cd.b > a.cd.b + COOLDOWN_JUMP_MS)
      found.push({ kind: "boost", t, index: i });
    if (b.cd.r > a.cd.r + COOLDOWN_JUMP_MS)
      found.push({ kind: "roll", t, index: i });
    if (b.cd.k > a.cd.k + COOLDOWN_JUMP_MS)
      found.push({ kind: "snap", t, index: i });
  }
  return found;
}

const distance = (dx: number, dy: number): number => Math.hypot(dx, dy);

interface Report {
  cycles: number;
  checkedEnds: number;
  checkedArcs: number;
  actionCycles: number;
  boosts: number;
  rolls: number;
  snaps: number;
  /** Cycles flown below the set throttle because of a dial cap. */
  cappedCycles: number;
  /** Straight cycles checked for returning to the set speed. */
  straightsAtSet: number;
  maxEndErrorPx: number;
  maxEndErrorDeg: number;
  maxArcErrorPx: number;
  maxArcErrorDeg: number;
  maxFrameJumpRatio: number;
  playerManeuvers: Record<string, number>;
  failures: string[];
}

function emptyReport(): Report {
  return {
    cycles: 0,
    checkedEnds: 0,
    checkedArcs: 0,
    actionCycles: 0,
    boosts: 0,
    rolls: 0,
    snaps: 0,
    cappedCycles: 0,
    straightsAtSet: 0,
    maxEndErrorPx: 0,
    maxEndErrorDeg: 0,
    maxArcErrorPx: 0,
    maxArcErrorDeg: 0,
    maxFrameJumpRatio: 0,
    playerManeuvers: {},
    failures: [],
  };
}

/** Checks one finished cycle against the oracle; actions explain the residual. */
function checkCycle(
  cycle: Cycle,
  next: Cycle,
  actions: ReadonlyArray<Performed>,
  who: string,
  report: Report,
): void {
  const first = cycle.samples[0]!;
  const start = first.start;
  const end = next.samples[0]!.start;
  if (!start || !end || !first.man) return;
  // The path is built with the FLOWN speed (control.cycleSpeed, fixed at the
  // cycle boundary): the set throttle and the dial cap decide it, not the
  // throttle at the end of the cycle.
  const step = { direction: first.man as never, speed: first.speed };
  const predicted = predictManeuver(start, step, first.base);
  const d = torusDisplacement(predicted, end, WORLD_SIZE);
  const angleError = Math.abs(headingDelta(predicted.angle, end.angle));
  // An action seen on a cycle's first sample happened before it: the previous
  // cycle's end (this cycle's start) carries its displacement.
  const inCycle = actions.filter(
    (a) =>
      a.index > cycle.from &&
      a.index <= cycle.from + cycle.samples.length &&
      a.kind !== "snap",
  );
  report.cycles++;
  const label = `${who} ${first.man}@${step.speed} cycle`;
  if (inCycle.length === 0) {
    report.checkedEnds++;
    const err = distance(d.dx, d.dy);
    report.maxEndErrorPx = Math.max(report.maxEndErrorPx, err);
    report.maxEndErrorDeg = Math.max(report.maxEndErrorDeg, angleError);
    if (
      err > END_POSITION_TOLERANCE_PX ||
      angleError > END_HEADING_TOLERANCE_DEG
    )
      report.failures.push(
        `${label}: end off by ${err.toFixed(1)} px / ${angleError.toFixed(1)}°`,
      );
    checkArc(cycle, step, start, who, report);
    return;
  }
  report.actionCycles++;
  if (inCycle.length === 1)
    checkActionDisplacement(
      inCycle[0]!,
      cycle,
      d,
      angleError,
      label,
      first.base,
      report,
    );
}

/** A boost or roll inside the cycle shifts its end by exactly its distance. */
function checkActionDisplacement(
  action: Performed,
  cycle: Cycle,
  residual: { dx: number; dy: number },
  angleError: number,
  label: string,
  baseSize: number,
  report: Report,
): void {
  const moved = distance(residual.dx, residual.dy);
  const expected =
    action.kind === "boost" ? BOOST_DISTANCE_PX : templateLength(1, baseSize);
  if (Math.abs(moved - expected) > ACTION_DISTANCE_TOLERANCE_PX)
    report.failures.push(
      `${label}: ${action.kind} moved ${moved.toFixed(1)} px, expected ${expected.toFixed(1)}`,
    );
  if (angleError > END_HEADING_TOLERANCE_DEG)
    report.failures.push(
      `${label}: ${action.kind} changed the facing by ${angleError.toFixed(1)}°`,
    );
  if (action.kind === "roll") {
    const at = cycle.samples.find((s) => s.t >= action.t) ?? cycle.samples[0]!;
    const side = Math.sign(
      residual.dx * Math.cos((at.pose.angle * Math.PI) / 180) +
        residual.dy * Math.sin((at.pose.angle * Math.PI) / 180),
    );
    if (side === 0)
      report.failures.push(`${label}: roll had no sideways slide`);
  }
}

/** Mid-cycle poses must sit on the template arc (action-free cycles only). */
function checkArc(
  cycle: Cycle,
  step: { direction: never; speed: number },
  start: Pose,
  who: string,
  report: Report,
): void {
  for (const sample of cycle.samples) {
    const expected = predictArcPose(start, step, sample.base, sample.prog);
    const d = torusDisplacement(expected, sample.pose, WORLD_SIZE);
    const err = distance(d.dx, d.dy);
    const angleError = Math.abs(
      headingDelta(expected.angle, sample.pose.angle),
    );
    report.checkedArcs++;
    report.maxArcErrorPx = Math.max(report.maxArcErrorPx, err);
    report.maxArcErrorDeg = Math.max(report.maxArcErrorDeg, angleError);
    if (
      err > ARC_POSITION_TOLERANCE_PX ||
      angleError > ARC_HEADING_TOLERANCE_DEG
    ) {
      report.failures.push(
        `${who} ${sample.man}@${sample.speed} prog ${sample.prog.toFixed(2)}: ${err.toFixed(1)} px / ${angleError.toFixed(1)}° off the arc`,
      );
      return;
    }
  }
}

/** No teleports between frames, except the frame an action displaced the ship. */
function checkFrames(
  samples: Sample[],
  actions: ReadonlyArray<Performed>,
  who: string,
  report: Report,
): void {
  const actionFrames = new Set(actions.map((a) => a.index));
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    const wrapped = b.prog < a.prog - 0.5;
    if (actionFrames.has(i)) continue;
    // Sim time, not wall time: a hitch makes one frame run several ticks.
    const progressStep = wrapped ? 1 - a.prog + b.prog : b.prog - a.prog;
    const d = torusDisplacement(a.pose, b.pose, WORLD_SIZE);
    const allowed = Math.max(
      templateLength(Math.max(a.speed, b.speed), a.base) *
        Math.max(progressStep, 0.005),
      1,
    );
    const dt = Math.round(progressStep * CYCLE_MS);
    const ratio = distance(d.dx, d.dy) / allowed;
    report.maxFrameJumpRatio = Math.max(report.maxFrameJumpRatio, ratio);
    if (ratio > 3)
      report.failures.push(
        `${who} frame ${i}: moved ${distance(d.dx, d.dy).toFixed(0)} px in ${dt.toFixed(0)} ms (allowed ${allowed.toFixed(0)}) man=${b.man} speed=${b.speed} prog=${b.prog.toFixed(2)} cd=${JSON.stringify(b.cd)} prevProg=${a.prog.toFixed(2)}`,
      );
  }
}

/** Dial direction the engine classifies a flown maneuver by (accrueCycleStress). */
function classifiedAs(man: string): ManeuverDirection {
  if (man.includes("turn")) return "turn_left";
  if (man.includes("bank")) return "bank_left";
  return "straight";
}

/**
 * Speed cap per maneuver: a cycle is flown on a dial speed of its maneuver
 * and never above that maneuver's cap; a straight flies the set speed again;
 * bank / turn / drift cycles have a dial entry that gives their stress color.
 */
function checkSpeedCap(cycle: Cycle, who: string, report: Report): void {
  const first = cycle.samples[0]!;
  const { man, def } = first;
  if (!man || !def || getMovementProfile(def) === "capital") return;
  const dial = getShipDial(def);
  const group = capGroupOf(man as ManeuverDirection);
  const printed = dial
    .filter((m) => capGroupOf(m.direction) === group)
    .map((m) => m.speed);
  const flown = first.speed;
  const label = `${who} ${man}@${flown} (set ${first.set})`;
  if (group === "straight") {
    // The throttle moves mid-cycle: the flown speed is the one set at the boundary.
    const sets = [cycle.previousSet, first.set];
    if (printed.includes(first.set) || printed.includes(cycle.previousSet)) {
      report.straightsAtSet++;
      if (!sets.includes(flown) && flown !== 0)
        report.failures.push(
          `${label}: a straight did not return to the set speed`,
        );
    }
    return;
  }
  if (printed.length === 0) return;
  if (flown > Math.max(...printed))
    report.failures.push(
      `${label}: flown above its dial cap ${Math.max(...printed)}`,
    );
  if (flown > 0 && !printed.includes(flown))
    report.failures.push(`${label}: flown at a speed its dial does not print`);
  if (flown < Math.max(first.set, cycle.previousSet)) report.cappedCycles++;
  if (flown > 0 && /bank|turn|drift/.test(man) && man !== "kturn") {
    const dialDirection = classifiedAs(man);
    if (!dial.some((m) => m.direction === dialDirection && m.speed === flown))
      report.failures.push(
        `${label}: no ${dialDirection} dial entry to classify it`,
      );
  }
}

/** Boost, roll and Snap Turn may not be performed before they recharge. */
function checkRecharges(
  actions: ReadonlyArray<Performed>,
  samples: Sample[],
  who: string,
  report: Report,
): void {
  const maxOf = (kind: ActionKind): number => {
    const m = samples[0]!.max;
    return kind === "boost" ? m.b : kind === "roll" ? m.r : m.k;
  };
  for (const kind of ["boost", "roll", "snap"] as const) {
    const mine = actions.filter((a) => a.kind === kind);
    report[kind === "boost" ? "boosts" : kind === "roll" ? "rolls" : "snaps"] +=
      mine.length;
    for (let i = 1; i < mine.length; i++) {
      const gap = mine[i]!.t - mine[i - 1]!.t;
      if (gap + RECHARGE_SLACK_MS < maxOf(kind))
        report.failures.push(
          `${who}: ${kind} performed again after ${gap.toFixed(0)} ms (recharge ${maxOf(kind)})`,
        );
    }
  }
}

function analyse(samples: Sample[]): Report {
  const report = emptyReport();
  const byShip = new Map<string, Sample[]>();
  for (const s of samples) byShip.set(s.id, [...(byShip.get(s.id) ?? []), s]);
  for (const [id, list] of byShip) {
    const who = `${list[0]!.player ? "PLAYER" : "bot"} ${id}`;
    const actions = findActions(list);
    const cycles = toCycles(list);
    // First cycle may start mid-way and the last one is unfinished: skip both.
    for (let i = 1; i < cycles.length - 1; i++) {
      checkCycle(cycles[i]!, cycles[i + 1]!, actions, who, report);
      checkSpeedCap(cycles[i]!, who, report);
      const man = cycles[i]!.samples[0]!.man;
      if (list[0]!.player && man)
        report.playerManeuvers[man] = (report.playerManeuvers[man] ?? 0) + 1;
    }
    checkFrames(list, actions, who, report);
    checkRecharges(actions, list, who, report);
  }
  return report;
}

const BATTLES: ReadonlyArray<readonly [string, BattleEntry]> = [
  ["Dogfight", DOGFIGHT],
  ["Ace Duel", ACE_DUEL],
  ["Boss Raid", BOSS_RAID],
  ["Survival", SURVIVAL],
  ["Campaign", CAMPAIGN],
  ["Skirmish", SKIRMISH],
];

for (const [name, entry] of BATTLES) {
  test(`live telemetry — ${name}: every cycle follows its template`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await entry.enter(page, { peaceful: true });
    await page.waitForFunction(
      (key) =>
        !!(window as any).game.scene
          .getScene(key)
          .secondaryWeapons?.playerShipId(),
      entry.sceneKey,
      { timeout: 15_000 },
    );
    await installSampler(page, entry.sceneKey);
    await playScript(page, 20_261_019);
    const report = analyse(await readSamples(page));
    const { failures, ...summary } = report;
    console.log(`[${name}] ${JSON.stringify(summary)}`);
    if (failures.length > 0) console.log(failures.slice(0, 12).join("\n"));
    expect(report.cycles, "cycles checked").toBeGreaterThan(10);
    expect(report.cappedCycles, "cycles the dial cap slowed").toBeGreaterThan(
      0,
    );
    expect(
      report.straightsAtSet,
      "straights back at the set speed",
    ).toBeGreaterThan(0);
    expect(
      Object.keys(report.playerManeuvers).length,
      "distinct maneuvers the player flew",
    ).toBeGreaterThanOrEqual(5);
    expect(failures, failures.slice(0, 5).join("\n")).toEqual([]);
  });
}

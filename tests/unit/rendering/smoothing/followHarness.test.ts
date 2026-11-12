/**
 * Numeric harness: how far the player's ship sits from the screen centre
 * (the screen-space offset between the ship and the camera) while flying at
 * several speeds, with the OLD render path (last-tick pose, per-frame camera
 * lerp 0.09) versus the NEW one (interpolation + velocity-fed exponential
 * follow), at 60 Hz, 144 Hz and irregular frame times.
 */

import { describe, expect, it } from "vitest";
import { BattleRenderSmoothing } from "../../../../src/rendering/smoothing/BattleRenderSmoothing";
import { planFixedSteps } from "../../../../src/arcade/systems/FixedStepPlan";

const WORLD = 6000;
const TICK_MS = 1000 / 60;
const PX_PER_SPEED_PER_S = 95;
const CYCLE_MS = 500;
const WARMUP_MS = 1500;
const RUN_MS = 12_000;

interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** A ship's flown path: pose after `tickIndex` fixed ticks. */
type Flight = (tickIndex: number, previous: Pose) => Pose;

function wrap(value: number): number {
  return ((value % WORLD) + WORLD) % WORLD;
}

function straight(speed: number): Flight {
  return (_i, p) => {
    const step = (speed * PX_PER_SPEED_PER_S * TICK_MS) / 1000;
    const rad = (p.angle * Math.PI) / 180;
    return { x: wrap(p.x + Math.sin(rad) * step), y: wrap(p.y - Math.cos(rad) * step), angle: p.angle };
  };
}

/** An arc at 70 deg/s whose speed steps 4 -> 3 -> 4 at every cycle boundary. */
const steppedArc: Flight = (i, p) => {
  const cycle = Math.floor((i * TICK_MS) / CYCLE_MS);
  const speed = cycle % 2 === 0 ? 4 : 3;
  const angle = p.angle + (70 * TICK_MS) / 1000;
  const step = (speed * PX_PER_SPEED_PER_S * TICK_MS) / 1000;
  const rad = (angle * Math.PI) / 180;
  return { x: wrap(p.x + Math.sin(rad) * step), y: wrap(p.y - Math.cos(rad) * step), angle };
};

/** Straight at speed 4 with one boost: +220 px along the heading in a single tick. */
function boosting(): Flight {
  const base = straight(4);
  return (i, p) => {
    const next = base(i, p);
    if (i !== Math.round(3000 / TICK_MS)) return next;
    return { ...next, x: wrap(next.x + 220) };
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type FrameTimes = () => number;
const fixedFrames = (hz: number): FrameTimes => () => 1000 / hz;
const jitterFrames = (): FrameTimes => {
  const random = mulberry32(7);
  return () => 7 + random() * 18;
};

interface Metrics {
  /** Standard deviation of the ship's screen offset from the centre (px). */
  readonly std: number;
  /** Largest change of that offset between two frames (px). */
  readonly maxJerk: number;
  /** Mean distance of the ship from the centre (px). */
  readonly meanOffset: number;
}

function summarize(offsets: { x: number; y: number }[]): Metrics {
  const n = offsets.length;
  const mx = offsets.reduce((s, o) => s + o.x, 0) / n;
  const my = offsets.reduce((s, o) => s + o.y, 0) / n;
  const variance =
    offsets.reduce((s, o) => s + (o.x - mx) ** 2 + (o.y - my) ** 2, 0) / n;
  let maxJerk = 0;
  for (let i = 1; i < n; i++) {
    maxJerk = Math.max(maxJerk, Math.hypot(offsets[i]!.x - offsets[i - 1]!.x, offsets[i]!.y - offsets[i - 1]!.y));
  }
  const meanOffset = offsets.reduce((s, o) => s + Math.hypot(o.x, o.y), 0) / n;
  return { std: Math.sqrt(variance), maxJerk, meanOffset };
}

function shortest(a: number, b: number): number {
  let d = (((b - a) % WORLD) + WORLD) % WORLD;
  if (d > WORLD / 2) d -= WORLD;
  return d;
}

const START: Pose = { x: 1000, y: 3000, angle: 90 };

/** The previous implementation, copied: sprite = last tick, camera lerps 0.09 per frame. */
function runOld(flight: Flight, frames: FrameTimes): Metrics {
  let ship = { ...START };
  let tickIndex = 0;
  let accumulator = 0;
  const cam = { x: START.x, y: START.y };
  const offsets: { x: number; y: number }[] = [];
  for (let t = 0; t < RUN_MS; ) {
    const frameMs = frames();
    t += frameMs;
    const plan = planFixedSteps(accumulator, frameMs, 1, TICK_MS);
    accumulator = plan.remainderMs;
    for (let k = 0; k < plan.ticks; k++) ship = flight(++tickIndex, ship);
    cam.x = wrap(cam.x + shortest(cam.x, ship.x) * 0.09);
    cam.y = wrap(cam.y + shortest(cam.y, ship.y) * 0.09);
    if (t > WARMUP_MS)
      offsets.push({ x: shortest(cam.x, ship.x), y: shortest(cam.y, ship.y) });
  }
  return summarize(offsets);
}

function runNew(flight: Flight, frames: FrameTimes): Metrics {
  const camera = { zoom: 1, centerOn: (x: number, y: number) => { centre = { x, y }; }, setZoom: (z: number) => { camera.zoom = z; } };
  let centre = { x: START.x, y: START.y };
  const smoothing = new BattleRenderSmoothing(camera, WORLD);
  let ship = { id: "p", ...START };
  smoothing.capture(ship, TICK_MS);
  let tickIndex = 0;
  let accumulator = 0;
  const offsets: { x: number; y: number }[] = [];
  for (let t = 0; t < RUN_MS; ) {
    const frameMs = frames();
    t += frameMs;
    const plan = planFixedSteps(accumulator, frameMs, 1, TICK_MS);
    accumulator = plan.remainderMs;
    for (let k = 0; k < plan.ticks; k++) {
      ship = { id: "p", ...flight(++tickIndex, ship) };
      smoothing.capture(ship, TICK_MS);
    }
    smoothing.beginFrame(frameMs, accumulator / TICK_MS);
    smoothing.stepCamera(frameMs, ship);
    const pose = smoothing.poseOf(ship);
    if (t > WARMUP_MS)
      offsets.push({ x: shortest(centre.x, pose.x), y: shortest(centre.y, pose.y) });
  }
  return summarize(offsets);
}

const CASES: ReadonlyArray<readonly [string, () => Flight]> = [
  ["straight speed 2", () => straight(2)],
  ["straight speed 3", () => straight(3)],
  ["straight speed 4", () => straight(4)],
  ["arc, speed 4<->3 at cycle bounds", () => steppedArc],
];
const RATES: ReadonlyArray<readonly [string, () => FrameTimes]> = [
  ["60 Hz", () => fixedFrames(60)],
  ["144 Hz", () => fixedFrames(144)],
  ["jitter 7-25 ms", jitterFrames],
];

describe("camera follow harness: ship offset from the screen centre", () => {
  const report: string[] = [];

  for (const [caseName, flight] of CASES) {
    for (const [rateName, frames] of RATES) {
      it(`${caseName} @ ${rateName}`, () => {
        const before = runOld(flight(), frames());
        const after = runNew(flight(), frames());
        const fmt = (m: Metrics): string =>
          `std ${m.std.toFixed(2)} px, max jerk ${m.maxJerk.toFixed(2)} px, mean ${m.meanOffset.toFixed(1)} px`;
        report.push(`${caseName} @ ${rateName}\n    old: ${fmt(before)}\n    new: ${fmt(after)}`);
        if (caseName.startsWith("straight")) {
          expect(after.std).toBeLessThan(1);
          expect(after.meanOffset).toBeLessThan(1.5);
          expect(after.std).toBeLessThan(before.std + 1e-9);
        } else {
          expect(after.std).toBeLessThan(before.std);
          expect(after.maxJerk).toBeLessThan(before.maxJerk);
          expect(after.meanOffset).toBeLessThan(before.meanOffset);
        }
      });
    }
  }

  it("straight-flight offset does not depend on the frame rate", () => {
    const stds = RATES.map(([, frames]) => runNew(straight(4), frames()).std);
    expect(Math.max(...stds) - Math.min(...stds)).toBeLessThan(0.5);
  });

  it("a boost glides instead of jumping the ship across the screen", () => {
    const before = runOld(boosting(), fixedFrames(60));
    const after = runNew(boosting(), fixedFrames(60));
    report.push(
      `boost +220 px @ 60 Hz\n    old: max jerk ${before.maxJerk.toFixed(1)} px\n    new: max jerk ${after.maxJerk.toFixed(1)} px`,
    );
    expect(before.maxJerk).toBeGreaterThan(200);
    expect(after.maxJerk).toBeLessThan(60);
  });

  it("prints the before/after table", () => {
    console.info(`\n${report.join("\n")}\n`);
    expect(report.length).toBeGreaterThan(0);
  });
});

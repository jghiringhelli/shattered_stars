/**
 * Spec: every movement style keeps its creature inside the Survival belt
 * circle (no wrap) or inside the map (wrapping across the seam), is
 * continuous (never teleports between frames) and differs from the others
 * in how it moves.
 */

import { describe, it, expect } from "vitest";
import { CreatureEncounter } from "../../../src/arcade/creatures/CreatureEncounter";
import type { CreatureMovementStyle } from "../../../src/data/creatures/creatureTypes";
import {
  aCreature,
  aTarget,
  frameAt,
  spyEffects,
} from "../../builders/CreatureBuilder";

const STYLES: readonly CreatureMovementStyle[] = [
  "serpentine",
  "drift",
  "hive",
  "blink",
  "orbit_lunge",
];
const TICK_MS = 1000 / 60;
const WORLD = 6000;

function encounterOf(
  style: CreatureMovementStyle,
  arena: { x: number; y: number; radiusPx: number } | null,
  start = { x: 3000, y: 3000, angle: 0 },
): CreatureEncounter {
  return new CreatureEncounter({
    definition: aCreature({
      powers: [],
      movement: {
        style,
        speedPxPerS: 160,
        turnDegPerS: 90,
        standoffPx: 300,
        amplitude: 25,
        periodMs: 2000,
      },
    }),
    seed: 5,
    worldSize: WORLD,
    arena,
    phaseThresholds: [],
    start,
  });
}

describe.each(STYLES)("%s movement", (style) => {
  it("stays_inside_the_belt_circle_and_never_jumps", () => {
    const arena = { x: 3000, y: 3000, radiusPx: 500 };
    const enc = encounterOf(style, arena);
    const { effects } = spyEffects();
    const prey = [aTarget("p", 3000 + 450, 3000)];
    let maxStep = 0;
    for (let now = 0; now < 30_000; now += TICK_MS) {
      const before = { x: enc.x, y: enc.y };
      enc.step(frameAt(now, prey), effects);
      maxStep = Math.max(
        maxStep,
        Math.hypot(enc.x - before.x, enc.y - before.y),
      );
      expect(Math.hypot(enc.x - 3000, enc.y - 3000)).toBeLessThanOrEqual(
        500.001,
      );
    }
    expect(maxStep).toBeLessThan(10);
  });

  it("wraps_across_the_seam_when_there_is_no_belt", () => {
    const enc = encounterOf(style, null, { x: 5990, y: 3000, angle: 90 });
    const { effects } = spyEffects();
    for (let now = 0; now < 20_000; now += TICK_MS) {
      enc.step(frameAt(now, [aTarget("p", 120, 3300)]), effects);
      expect(enc.x).toBeGreaterThanOrEqual(0);
      expect(enc.x).toBeLessThan(WORLD);
      expect(enc.y).toBeGreaterThanOrEqual(0);
      expect(enc.y).toBeLessThan(WORLD);
    }
  });

  it("closes_on_prey_beyond_its_standoff", () => {
    const enc = encounterOf(style, null);
    const { effects } = spyEffects();
    const prey = [aTarget("p", 3000, 1500)];
    const start = Math.hypot(enc.x - 3000, enc.y - 1500);
    for (let now = 0; now < 8000; now += TICK_MS)
      enc.step(frameAt(now, prey), effects);
    expect(Math.hypot(enc.x - 3000, enc.y - 1500)).toBeLessThan(start);
  });
});

describe("movement styles differ", () => {
  it("serpentine_weaves_while_drift_holds_a_steadier_course", () => {
    const heading = (style: CreatureMovementStyle): number => {
      const enc = encounterOf(style, null);
      const { effects } = spyEffects();
      let turned = 0;
      let last = enc.angle;
      for (let now = 0; now < 6000; now += TICK_MS) {
        enc.step(frameAt(now, [aTarget("p", 3000, 1000)]), effects);
        turned += Math.abs(((enc.angle - last + 540) % 360) - 180);
        last = enc.angle;
      }
      return turned;
    };
    expect(heading("serpentine")).toBeGreaterThan(heading("drift"));
  });
});

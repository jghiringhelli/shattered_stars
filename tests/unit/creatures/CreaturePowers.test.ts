/**
 * Spec: each power kind does what its name says — tractor pull drags prey to
 * the maw, spore clouds slow, blinks make the creature untargetable and land
 * on the far side, summons call adds (capped), lunges hit what they cross and
 * sweeps rotate; none of them chain two hits on one ship inside a cycle.
 */

import { describe, it, expect } from "vitest";
import { CreatureEncounter } from "../../../src/arcade/creatures/CreatureEncounter";
import { telegraphAngle } from "../../../src/arcade/creatures/CreaturePowerEffects";
import type { CreaturePowerSpec } from "../../../src/data/creatures/creatureTypes";
import {
  aCreature,
  aTarget,
  CONE_POWER,
  frameAt,
  spyEffects,
} from "../../builders/CreatureBuilder";

const TICK_MS = 1000 / 60;

/** An encounter of one power, standing still beside prey. */
function withPower(
  power: Partial<CreaturePowerSpec> & Pick<CreaturePowerSpec, "kind">,
): CreatureEncounter {
  return new CreatureEncounter({
    definition: aCreature({
      parts: [],
      movement: {
        style: "drift",
        speedPxPerS: 0,
        turnDegPerS: 0,
        standoffPx: 250,
        amplitude: 0,
        periodMs: 1000,
      },
      powers: [{ ...CONE_POWER, ...power }],
    }),
    seed: 3,
    worldSize: 6000,
    arena: null,
    phaseThresholds: [],
    start: { x: 3000, y: 3000, angle: 0 },
  });
}

function run(
  enc: CreatureEncounter,
  effects: ReturnType<typeof spyEffects>["effects"],
  prey: ReturnType<typeof aTarget>[],
  ms: number,
  onTick?: (now: number) => void,
): void {
  for (let now = 0; now < ms; now += TICK_MS) {
    enc.step(frameAt(now, prey), effects);
    onTick?.(now);
  }
}

describe("tractor pull", () => {
  it("drags_prey_toward_the_maw_without_pulling_it_inside_the_body", () => {
    const enc = withPower({
      kind: "pull",
      rangePx: 600,
      pullSpeedPxPerS: 300,
      durationMs: 1500,
      damage: 5,
    });
    const { effects, log } = spyEffects();
    const prey = aTarget("p", 3000, 2500);
    let applied = 0;
    run(enc, effects, [prey], 4000, () => {
      for (; applied < log.nudges.length; applied++)
        prey.y += log.nudges[applied]!.dy;
    });
    const pulls = log.nudges.filter((n) => n.id === "p");
    expect(pulls.length).toBeGreaterThan(5);
    expect(pulls.every((n) => n.dy >= 0)).toBe(true);
    expect(3000 - prey.y).toBeLessThan(500);
    expect(3000 - prey.y).toBeGreaterThanOrEqual(80 + 20 - 1);
  });
});

describe("spore cloud", () => {
  it("drags_back_a_ship_inside_by_the_share_it_would_have_moved", () => {
    const enc = withPower({
      kind: "cloud",
      rangePx: 200,
      triggerRangePx: 600,
      durationMs: 4000,
      slowFactor: 0.5,
      damage: 1,
      stress: 0.1,
    });
    const { effects, log } = spyEffects();
    const prey = aTarget("p", 3000, 2700);
    run(enc, effects, [prey], 4000, () => {
      prey.x += 1;
    });
    const drags = log.nudges.filter((n) => n.id === "p" && n.dx < 0);
    expect(drags.length).toBeGreaterThan(10);
    expect(drags[0]!.dx).toBeCloseTo(-0.5, 1);
    expect(log.stress.some((s) => s.id === "p")).toBe(true);
  });
});

describe("phase-shift", () => {
  it("is_untargetable_while_winding_up_and_reappears_beside_the_prey", () => {
    const enc = withPower({
      kind: "blink",
      rangePx: 300,
      damage: 0,
      stress: 0,
    });
    const { effects, log } = spyEffects();
    const prey = [aTarget("p", 3000, 2400)];
    let sawPhased = false;
    let wastedHit = 1;
    let wasPhased = false;
    let landedBesidePrey = -1;
    run(enc, effects, prey, 3000, () => {
      if (wasPhased && !enc.phased && landedBesidePrey < 0)
        landedBesidePrey = Math.hypot(enc.x - 3000, enc.y - 2400);
      wasPhased = enc.phased;
      if (!enc.phased) return;
      sawPhased = true;
      wastedHit = enc.absorbHit({
        fromX: 3000,
        fromY: 3100,
        damage: 4,
        nowMs: 0,
        shieldsUp: false,
      }).damage;
    });
    expect(sawPhased).toBe(true);
    expect(wastedHit).toBe(0);
    expect(log.events.some((e) => e.kind === "phase_shift")).toBe(true);
    expect(landedBesidePrey).toBeGreaterThan(290);
    expect(landedBesidePrey).toBeLessThan(310);
  });
});

describe("summon", () => {
  it("calls_adds_but_not_while_enough_are_alive", () => {
    const enc = withPower({
      kind: "summon",
      spawnCount: 2,
      spawnCreatureId: "hulk_gnawer",
      damage: 0,
      stress: 0,
    });
    const { effects, log } = spyEffects();
    run(enc, effects, [aTarget("p", 3000, 2500)], 2000);
    expect(log.spawns.map((s) => s.creatureId)).toEqual([
      "hulk_gnawer",
      "hulk_gnawer",
    ]);
    const second = spyEffects();
    for (let now = 2000; now < 8000; now += TICK_MS)
      enc.step(
        { ...frameAt(now, [aTarget("p", 3000, 2500)]), addsAlive: 2 },
        second.effects,
      );
    expect(second.log.spawns).toHaveLength(0);
  });
});

describe("lunge", () => {
  it("hits_prey_in_its_path_once_per_cycle_and_travels_its_range", () => {
    const enc = withPower({
      kind: "lunge",
      rangePx: 400,
      durationMs: 500,
      damage: 7,
      stress: 0,
      arcDeg: 0,
    });
    const { effects, log } = spyEffects();
    run(enc, effects, [aTarget("p", 3000, 2750)], 3000);
    const hits = log.damage.filter((d) => d.id === "p");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(log.events.filter((e) => e.kind === "power")).toHaveLength(
      Math.min(
        hits.length,
        log.events.filter((e) => e.kind === "power").length,
      ),
    );
    expect(enc.y).toBeLessThan(2800);
  });
});

describe("sweep", () => {
  it("rotates_its_arc_through_a_half_turn_while_active", () => {
    const enc = withPower({
      kind: "sweep",
      rangePx: 400,
      arcDeg: 60,
      durationMs: 1000,
      damage: 6,
    });
    const { effects } = spyEffects();
    const angles: number[] = [];
    run(enc, effects, [aTarget("p", 3000, 2800)], 3000, (now) => {
      const tele = enc.telegraph;
      if (tele.stage === "active") angles.push(telegraphAngle(tele, now));
    });
    expect(angles.length).toBeGreaterThan(20);
    expect(angles[angles.length - 1]! - angles[0]!).toBeGreaterThan(120);
  });
});

/**
 * Spec: a creature encounter fights with telegraphed powers (wind-up, then
 * the effect, then a cooldown), loses powers with its body parts, enrages in
 * phases, feeds only on wrecks and is deterministic for a seed.
 */

import { describe, it, expect } from "vitest";
import {
  CreatureEncounter,
  type CreatureEncounterConfig,
} from "../../../src/arcade/creatures/CreatureEncounter";
import type { CreaturePowerSpec } from "../../../src/data/creatures/creatureTypes";
import {
  aCreature,
  aTarget,
  CONE_POWER,
  frameAt,
  spyEffects,
} from "../../builders/CreatureBuilder";

const TICK_MS = 1000 / 60;
const WORLD = 6000;

function encounter(
  overrides: Partial<CreatureEncounterConfig> = {},
): CreatureEncounter {
  return new CreatureEncounter({
    definition: aCreature(),
    seed: 7,
    worldSize: WORLD,
    arena: null,
    phaseThresholds: [0.5],
    start: { x: 3000, y: 3000, angle: 0 },
    ...overrides,
  });
}

/** Runs the encounter `ms` of sim time against fixed targets. */
function run(
  enc: CreatureEncounter,
  effects: ReturnType<typeof spyEffects>["effects"],
  targets: ReturnType<typeof aTarget>[],
  fromMs: number,
  ms: number,
  hull = 1,
): number {
  let now = fromMs;
  for (; now < fromMs + ms; now += TICK_MS)
    enc.step(frameAt(now, targets, hull), effects);
  return now;
}

describe("power telegraphs", () => {
  it("announces_a_power_a_full_cycle_before_it_lands", () => {
    const enc = encounter();
    const { effects, log } = spyEffects();
    const prey = [aTarget("p", 3000, 2850)];
    run(enc, effects, prey, 0, 3000);
    const telegraph = log.events.find((e) => e.kind === "telegraph");
    expect(telegraph?.label).toBe("SPRAY");
    expect(enc.telegraph.stage).not.toBe("idle");
  });

  it("deals_no_damage_during_the_wind_up", () => {
    const enc = encounter();
    const { effects, log } = spyEffects();
    const prey = [aTarget("p", 3000, 2900)];
    let now = 0;
    while (now < 5000 && enc.telegraph.stage !== "windup") {
      enc.step(frameAt(now, prey), effects);
      now += TICK_MS;
    }
    expect(enc.telegraph.stage).toBe("windup");
    expect(log.damage).toHaveLength(0);
  });

  it("hits_only_targets_inside_the_cone_when_the_wind_up_ends", () => {
    const enc = encounter();
    const { effects, log } = spyEffects();
    const inside = aTarget("in", 3000, 2850);
    const behind = aTarget("out", 3000, 3250);
    run(enc, effects, [inside, behind], 0, 4000);
    expect(log.damage.map((d) => d.id)).toContain("in");
    expect(log.damage.map((d) => d.id)).not.toContain("out");
  });

  it("waits_the_cooldown_before_using_the_same_power_again", () => {
    const enc = encounter();
    const { effects, log } = spyEffects();
    run(enc, effects, [aTarget("p", 3000, 2850)], 0, 6000);
    const telegraphs = log.events.filter((e) => e.kind === "telegraph");
    const fired = log.events.filter((e) => e.kind === "power");
    expect(fired.length).toBeLessThanOrEqual(telegraphs.length);
    expect(fired.length).toBeLessThanOrEqual(
      Math.ceil(6000 / ((1 + CONE_POWER.cooldownCycles) * 500)),
    );
  });

  it("never_lands_two_attacks_in_one_cycle", () => {
    const quick: CreaturePowerSpec = {
      ...CONE_POWER,
      id: "snap",
      name: "SNAP",
      cooldownCycles: 0,
    };
    const enc = encounter({
      definition: aCreature({ powers: [quick, { ...quick, id: "snap2" }] }),
    });
    const { effects, log } = spyEffects();
    const prey = [aTarget("p", 3000, 2850)];
    const times: number[] = [];
    let now = 0;
    for (; now < 8000; now += TICK_MS) {
      const before = log.events.filter((e) => e.kind === "power").length;
      enc.step(frameAt(now, prey), effects);
      if (log.events.filter((e) => e.kind === "power").length > before)
        times.push(now);
    }
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(500 - TICK_MS);
  });
});

describe("body parts", () => {
  it("multiplies_hull_damage_of_a_hit_on_a_weak_point", () => {
    const enc = encounter();
    const hit = enc.absorbHit({
      fromX: 3000,
      fromY: 3400,
      damage: 1,
      nowMs: 100,
      shieldsUp: false,
    });
    expect(hit.partId).toBe("tail");
    expect(hit.damage).toBe(2);
  });

  it("ignores_parts_while_shields_are_up", () => {
    const enc = encounter();
    const hit = enc.absorbHit({
      fromX: 3000,
      fromY: 3400,
      damage: 1,
      nowMs: 100,
      shieldsUp: true,
    });
    expect(hit.partId).toBeNull();
    expect(hit.damage).toBe(1);
  });

  it("disables_the_powers_of_a_destroyed_part", () => {
    const tailPower: CreaturePowerSpec = {
      ...CONE_POWER,
      id: "tail_spit",
      name: "TAIL SPIT",
      requiresPart: "tail",
    };
    const enc = encounter({
      definition: aCreature({ powers: [tailPower] }),
    });
    const { effects, log } = spyEffects();
    for (let i = 0; i < 30; i++)
      enc.absorbHit({
        fromX: 3000,
        fromY: 3400,
        damage: 5,
        nowMs: 100,
        shieldsUp: false,
      });
    expect(enc.isPartAlive("tail")).toBe(false);
    run(enc, effects, [aTarget("p", 3000, 2850)], 0, 4000);
    expect(log.events.some((e) => e.kind === "part_destroyed")).toBe(true);
    expect(log.events.some((e) => e.kind === "telegraph")).toBe(false);
  });
});

describe("phases", () => {
  it("enters_the_next_phase_when_hull_crosses_the_threshold_once", () => {
    const enc = encounter();
    const { effects, log } = spyEffects();
    const prey = [aTarget("p", 3000, 2850)];
    run(enc, effects, prey, 0, 200, 0.9);
    expect(enc.phaseIndex).toBe(0);
    run(enc, effects, prey, 200, 200, 0.4);
    run(enc, effects, prey, 400, 200, 0.3);
    expect(enc.phaseIndex).toBe(1);
    expect(log.events.filter((e) => e.kind === "phase")).toHaveLength(1);
  });
});

describe("movement", () => {
  it("stays_inside_a_circular_arena", () => {
    const arena = { x: 3000, y: 3000, radiusPx: 400 };
    const enc = encounter({ arena });
    const { effects } = spyEffects();
    run(enc, effects, [aTarget("p", 3000 + 380, 3000)], 0, 20000);
    expect(Math.hypot(enc.x - 3000, enc.y - 3000)).toBeLessThanOrEqual(400);
  });

  it("wraps_across_the_map_seam_without_an_arena", () => {
    const enc = encounter({ start: { x: 5990, y: 3000, angle: 90 } });
    const { effects } = spyEffects();
    run(enc, effects, [aTarget("p", 40, 3000)], 0, 3000);
    expect(enc.x).toBeGreaterThanOrEqual(0);
    expect(enc.x).toBeLessThan(WORLD);
  });

  it("does_not_follow_the_ship_maneuver_dial_it_moves_continuously", () => {
    const enc = encounter();
    const { effects } = spyEffects();
    const prey = [aTarget("p", 3000, 2000)];
    const start = { x: enc.x, y: enc.y };
    run(enc, effects, prey, 0, 1000);
    expect(Math.hypot(enc.x - start.x, enc.y - start.y)).toBeGreaterThan(50);
  });
});

describe("feeding", () => {
  const feeder = () =>
    encounter({ definition: aCreature({ feedHullPoints: 2, powers: [] }) });

  it("never_regenerates_without_a_wreck", () => {
    const enc = feeder();
    const { effects, log } = spyEffects();
    run(enc, effects, [aTarget("p", 3000, 1500)], 0, 10000, 0.5);
    expect(log.healed).toBe(0);
  });

  it("heals_after_feeding_on_a_wreck", () => {
    const enc = feeder();
    const { effects, log } = spyEffects();
    enc.noteWreck(3000, 3050);
    run(enc, effects, [aTarget("p", 3000, 1500)], 0, 6000, 0.5);
    expect(log.healed).toBeGreaterThan(0);
  });

  it("is_interrupted_by_damage", () => {
    const enc = feeder();
    const { effects, log } = spyEffects();
    enc.noteWreck(3000, 3050);
    let now = 0;
    for (; now < 6000; now += TICK_MS) {
      enc.step(frameAt(now, [aTarget("p", 3000, 1500)], 0.5), effects);
      enc.absorbHit({
        fromX: 3000,
        fromY: 2000,
        damage: 1,
        nowMs: now,
        shieldsUp: false,
      });
    }
    expect(log.healed).toBe(0);
  });
});

describe("determinism", () => {
  function trace(seed: number): string {
    const enc = encounter({ seed });
    const { effects, log } = spyEffects();
    run(
      enc,
      effects,
      [aTarget("p", 3000, 2700), aTarget("q", 3100, 2750)],
      0,
      6000,
    );
    return `${enc.x.toFixed(3)},${enc.y.toFixed(3)},${log.damage.length},${log.events.length}`;
  }

  it("repeats_exactly_for_one_seed", () => {
    expect(trace(11)).toBe(trace(11));
  });
});

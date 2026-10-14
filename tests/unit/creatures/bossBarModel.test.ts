/**
 * Spec: the boss bar model shows phase pips, hull and shield fractions, each
 * part with the power its loss disabled, and the telegraphed power with a
 * text tag and the seconds left — text and shape, never colour alone.
 */

import { describe, it, expect } from "vitest";
import { CreatureEncounter } from "../../../src/arcade/creatures/CreatureEncounter";
import {
  bossBarView,
  POWER_TAGS,
} from "../../../src/arcade/creatures/bossBarModel";
import {
  aCreature,
  aTarget,
  CONE_POWER,
  frameAt,
  spyEffects,
} from "../../builders/CreatureBuilder";

const SHIP = { hull: 120, maxHull: 240, shields: 12, maxShields: 48 };

function fresh(): CreatureEncounter {
  return new CreatureEncounter({
    definition: aCreature({
      powers: [{ ...CONE_POWER, requiresPart: "tail" }],
    }),
    seed: 1,
    worldSize: 6000,
    arena: null,
    phaseThresholds: [0.5, 0.25],
    start: { x: 3000, y: 3000, angle: 0 },
  });
}

describe("bossBarView", () => {
  it("reports_fractions_name_and_one_pip_per_phase", () => {
    const view = bossBarView(fresh(), SHIP, 0);
    expect(view.name).toBe("TEST WYRM");
    expect(view.hullFraction).toBe(0.5);
    expect(view.shieldFraction).toBe(0.25);
    expect(view.phases).toHaveLength(3);
    expect(view.phases.map((p) => p.current)).toEqual([true, false, false]);
  });

  it("marks_a_destroyed_part_with_the_power_it_disabled", () => {
    const enc = fresh();
    for (let i = 0; i < 30; i++)
      enc.absorbHit({
        fromX: 3000,
        fromY: 3400,
        damage: 5,
        nowMs: 0,
        shieldsUp: false,
      });
    const [tail] = bossBarView(enc, SHIP, 0).parts;
    expect(tail).toMatchObject({ id: "tail", alive: false, kind: "weak" });
    expect(tail!.disables).toEqual(["SPRAY"]);
  });

  it("shows_the_telegraphed_power_with_a_text_tag_and_seconds_left", () => {
    const enc = new CreatureEncounter({
      definition: aCreature(),
      seed: 1,
      worldSize: 6000,
      arena: null,
      phaseThresholds: [],
      start: { x: 3000, y: 3000, angle: 0 },
    });
    const { effects } = spyEffects();
    const prey = [aTarget("p", 3000, 2850)];
    let now = 0;
    while (enc.telegraph.stage !== "windup" && now < 5000) {
      enc.step(frameAt(now, prey), effects);
      now += 1000 / 60;
    }
    const view = bossBarView(enc, SHIP, now);
    expect(view.telegraph?.tag).toBe(POWER_TAGS.cone);
    expect(view.telegraph?.label).toBe("SPRAY");
    expect(view.telegraph?.secondsLeft).toBeGreaterThan(0);
    expect(view.telegraph?.secondsLeft).toBeLessThanOrEqual(0.5);
  });

  it("has_no_telegraph_while_idle", () => {
    expect(bossBarView(fresh(), SHIP, 0).telegraph).toBeNull();
  });
});

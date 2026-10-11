/**
 * ShotLevers — specification tests: where a shot is fired from (rear arc,
 * head-on, neutral), what position and the squad mark do to the odds and the
 * damage, and the clamp.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOT_LEVERS,
  HEAD_ON_HALF_ARC_DEG,
  HEAD_ON_HIT_PENALTY,
  LEVER_HIT_CHANCE_CEILING,
  LEVER_HIT_CHANCE_FLOOR,
  leverShot,
  NO_SHOT_LEVERS,
  REAR_ARC_DAMAGE_BONUS,
  REAR_ARC_HIT_BONUS,
  shotPosition,
} from "../../../src/arcade/ShotLevers";
import {
  SQUAD_MARK_DAMAGE_BONUS,
  SQUAD_MARK_HIT_BONUS,
} from "../../../src/arcade/systems/SquadMark";

/** Target at the origin facing up (angle 0); attacker 200 px away at a bearing off its nose. */
const target = { x: 0, y: 0, angle: 0 };
const attackerAt = (bearingOffTargetNoseDeg: number) => {
  const rad = (bearingOffTargetNoseDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * 200,
    y: -Math.cos(rad) * 200,
    angle: (bearingOffTargetNoseDeg + 180) % 360,
  };
};

describe("shotPosition", () => {
  it("is_rear_from_the_targets_tail", () => {
    expect(shotPosition(attackerAt(180), target)).toBe("rear");
    expect(shotPosition(attackerAt(140), target)).toBe("rear");
  });

  it("is_head_on_from_inside_the_targets_front_cone", () => {
    expect(shotPosition(attackerAt(0), target)).toBe("head_on");
    expect(shotPosition(attackerAt(HEAD_ON_HALF_ARC_DEG - 1), target)).toBe(
      "head_on",
    );
  });

  it("is_neutral_from_the_beam", () => {
    expect(shotPosition(attackerAt(90), target)).toBe("neutral");
    expect(shotPosition(attackerAt(-(HEAD_ON_HALF_ARC_DEG + 5)), target)).toBe(
      "neutral",
    );
  });
});

describe("leverShot", () => {
  it("leaves_a_neutral_unmarked_shot_untouched", () => {
    expect(
      leverShot({ hitChance: 0.6, position: "neutral", marked: false }),
    ).toEqual({ hitChance: 0.6, damageBonus: 0 });
  });

  it("rewards_the_rear_arc_with_odds_and_damage", () => {
    const shot = leverShot({ hitChance: 0.6, position: "rear", marked: false });
    expect(shot.hitChance).toBeCloseTo(0.6 + REAR_ARC_HIT_BONUS);
    expect(shot.damageBonus).toBe(REAR_ARC_DAMAGE_BONUS);
  });

  it("penalises_a_head_on_joust", () => {
    expect(
      leverShot({ hitChance: 0.6, position: "head_on", marked: false })
        .hitChance,
    ).toBeCloseTo(0.6 - HEAD_ON_HIT_PENALTY);
  });

  it("rewards_shooting_the_squads_marked_target", () => {
    const shot = leverShot({
      hitChance: 0.5,
      position: "neutral",
      marked: true,
    });
    expect(shot.hitChance).toBeCloseTo(0.5 + SQUAD_MARK_HIT_BONUS);
    expect(shot.damageBonus).toBe(SQUAD_MARK_DAMAGE_BONUS);
  });

  it("stacks_rear_arc_and_mark", () => {
    const shot = leverShot({ hitChance: 0.4, position: "rear", marked: true });
    expect(shot.damageBonus).toBe(
      REAR_ARC_DAMAGE_BONUS + SQUAD_MARK_DAMAGE_BONUS,
    );
  });

  it("clamps_the_levered_odds", () => {
    expect(
      leverShot({ hitChance: 0.9, position: "rear", marked: true }).hitChance,
    ).toBe(LEVER_HIT_CHANCE_CEILING);
    const harsh = { ...NO_SHOT_LEVERS, headOnHitPenalty: 1 };
    expect(
      leverShot({ hitChance: 0.3, position: "head_on", marked: false }, harsh)
        .hitChance,
    ).toBe(LEVER_HIT_CHANCE_FLOOR);
  });

  it("does_nothing_with_every_lever_off", () => {
    expect(
      leverShot(
        { hitChance: 0.6, position: "rear", marked: true },
        NO_SHOT_LEVERS,
      ),
    ).toEqual({ hitChance: 0.6, damageBonus: 0 });
  });

  it("ships_the_named_constants_as_defaults", () => {
    expect(DEFAULT_SHOT_LEVERS).toEqual({
      rearArcHitBonus: REAR_ARC_HIT_BONUS,
      rearArcDamageBonus: REAR_ARC_DAMAGE_BONUS,
      headOnHitPenalty: HEAD_ON_HIT_PENALTY,
      markHitBonus: SQUAD_MARK_HIT_BONUS,
      markDamageBonus: SQUAD_MARK_DAMAGE_BONUS,
    });
  });
});

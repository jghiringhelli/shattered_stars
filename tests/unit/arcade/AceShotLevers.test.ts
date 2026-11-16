/**
 * Strike and evasion levers — specification tests: an ace's strike shot at
 * the squad's marked target is easier to hit and hits harder, a strike at an
 * unmarked target gets nothing (a strike is a squad tactic), a shot at a
 * disengaging ace is harder to land, neither exists in the bare dice model.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOT_LEVERS,
  LEVER_HIT_CHANCE_CEILING,
  leverShot,
  NO_SHOT_LEVERS,
} from "../../../src/arcade/ShotLevers";
import {
  DISENGAGE_EVASION_HIT_PENALTY,
  STRIKE_DAMAGE_BONUS,
  STRIKE_HIT_BONUS,
} from "../../../src/data/aceConfig";
import {
  SQUAD_MARK_DAMAGE_BONUS,
  SQUAD_MARK_HIT_BONUS,
} from "../../../src/arcade/systems/SquadMark";

const NEUTRAL = { hitChance: 0.4, position: "neutral", marked: false } as const;
const MARKED = { ...NEUTRAL, marked: true } as const;

describe("leverShot strike", () => {
  it("adds the strike hit and damage bonus on top of the squad mark", () => {
    const plain = leverShot(MARKED);
    const strike = leverShot({ ...MARKED, strike: true });
    expect(strike.hitChance).toBeCloseTo(plain.hitChance + STRIKE_HIT_BONUS);
    expect(strike.damageBonus).toBe(plain.damageBonus + STRIKE_DAMAGE_BONUS);
  });

  it("gives nothing against a target the squad did not mark", () => {
    expect(leverShot({ ...NEUTRAL, strike: true })).toEqual(
      leverShot(NEUTRAL),
    );
  });

  it("changes nothing without a strike", () => {
    expect(leverShot(NEUTRAL)).toEqual({ hitChance: 0.4, damageBonus: 0 });
  });

  it("never pushes the hit chance past the ceiling", () => {
    const shot = leverShot({ ...MARKED, hitChance: 0.6, strike: true });
    expect(shot.hitChance).toBe(LEVER_HIT_CHANCE_CEILING);
  });

  it("is absent from the bare dice model", () => {
    expect(leverShot({ ...MARKED, strike: true }, NO_SHOT_LEVERS)).toEqual({
      hitChance: 0.4,
      damageBonus: 0,
    });
  });
});

describe("leverShot evasion", () => {
  it("lowers the hit chance of a shot at an evading ace", () => {
    const shot = leverShot({ ...NEUTRAL, evading: true });
    expect(shot.hitChance).toBeCloseTo(0.4 - DISENGAGE_EVASION_HIT_PENALTY);
    expect(shot.damageBonus).toBe(0);
  });

  it("works against any shooter, marked target or not", () => {
    const evaded = leverShot({ ...MARKED, evading: true });
    expect(evaded.hitChance).toBeCloseTo(
      leverShot(MARKED).hitChance - DISENGAGE_EVASION_HIT_PENALTY,
    );
  });

  it("keeps the engine defaults weaker than the squad mark itself", () => {
    expect(DEFAULT_SHOT_LEVERS.strikeHitBonus).toBeLessThan(SQUAD_MARK_HIT_BONUS);
    expect(DEFAULT_SHOT_LEVERS.strikeDamageBonus).toBeLessThan(
      SQUAD_MARK_DAMAGE_BONUS,
    );
    expect(DEFAULT_SHOT_LEVERS.evasionHitPenalty).toBeLessThan(
      SQUAD_MARK_HIT_BONUS,
    );
  });
});

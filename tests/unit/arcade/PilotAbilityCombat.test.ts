/**
 * PilotAbilityCombat — specification tests for the hit, kill and death
 * hooks of pilot abilities.
 */

import { DURABILITY_SCALE } from "../../../src/config";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { describe, it, expect } from "vitest";
import {
  deathBlastTargets,
  hasWingman,
  laserHitBonus,
  rewardKill,
  type AbilityCombatant,
} from "../../../src/arcade/PilotAbilityCombat";
import {
  DEATH_BLAST_RADIUS_PX,
  KILL_FRENZY_MS,
  WINGMAN_RADIUS_PX,
} from "../../../src/arcade/ShotConditions";
import {
  combineEffects,
  type RealtimeEffect,
} from "../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";

function pilot(
  effect: RealtimeEffect,
  overrides: Partial<AbilityCombatant> = {},
): AbilityCombatant {
  return {
    id: "ace",
    x: 1000,
    y: 1000,
    angle: 0,
    hull: 4,
    maxHull: 4,
    shields: 1,
    maxShields: 3,
    stress: INITIAL_STRESS,
    modifiers: combineEffects([effect]),
    frenzyUntilMs: 0,
    ...overrides,
  };
}

/** A target straight ahead of the pilot at `distance`, facing away (so the pilot is behind it). */
const aheadFacingAway = (distance: number) => ({
  x: 1000,
  y: 1000 - distance,
  angle: 0,
});

describe("hasWingman", () => {
  it("counts another ally within range", () => {
    const me = { id: "a", x: 0, y: 0 };
    expect(
      hasWingman(me, [me, { id: "b", x: WINGMAN_RADIUS_PX - 1, y: 0 }]),
    ).toBe(true);
  });

  it("does not count itself or allies beyond range", () => {
    const me = { id: "a", x: 0, y: 0 };
    expect(
      hasWingman(me, [me, { id: "b", x: WINGMAN_RADIUS_PX + 1, y: 0 }]),
    ).toBe(false);
  });
});

describe("laserHitBonus", () => {
  it("a rear-arc ability pays when the bolt lands from behind", () => {
    const attacker = pilot({ rearArcLaserBonus: 1 });
    expect(
      laserHitBonus({
        attacker,
        target: aheadFacingAway(300),
        attackerHasWingman: false,
        nowMs: 0,
      }),
    ).toBe(1);
  });

  it("a rear-arc ability pays nothing head-on", () => {
    const attacker = pilot({ rearArcLaserBonus: 1 });
    const headOn = { x: 1000, y: 700, angle: 180 };
    expect(
      laserHitBonus({
        attacker,
        target: headOn,
        attackerHasWingman: false,
        nowMs: 0,
      }),
    ).toBe(0);
  });

  it("a damaged-pilot ability pays only once the hull is hit", () => {
    const fresh = pilot({ damagedLaserBonus: 1 });
    const hurt = pilot({ damagedLaserBonus: 1 }, { hull: 2 });
    const input = {
      target: aheadFacingAway(300),
      attackerHasWingman: false,
      nowMs: 0,
    };
    expect(laserHitBonus({ ...input, attacker: fresh })).toBe(0);
    expect(laserHitBonus({ ...input, attacker: hurt })).toBe(1);
  });

  it("the frenzy bonus pays only inside its window", () => {
    const attacker = pilot(
      { killFrenzyLaserBonus: 1 },
      { frenzyUntilMs: 5000 },
    );
    const input = {
      attacker,
      target: aheadFacingAway(300),
      attackerHasWingman: false,
    };
    expect(laserHitBonus({ ...input, nowMs: 4999 })).toBe(1);
    expect(laserHitBonus({ ...input, nowMs: 5000 })).toBe(0);
  });
});

describe("rewardKill", () => {
  it("restores shields per kill in real-time HP (never rescaled), capped at max", () => {
    const roomy = { shields: 1, maxShields: 100 };
    expect(rewardKill(pilot({ shieldsPerKill: 6 }, roomy), 0).shields).toBe(
      1 + 6,
    );
    expect(
      rewardKill(pilot({ shieldsPerKill: 1 }, { shields: 3 }), 0).shields,
    ).toBe(3);
  });

  it("keeps Plunder at one shield token (DURABILITY_SCALE HP) per kill", () => {
    expect(PILOT_ABILITY_REALTIME["plunder"]?.shieldsPerKill).toBe(
      DURABILITY_SCALE,
    );
  });

  it("opens a frenzy window for frenzy pilots only", () => {
    expect(
      rewardKill(pilot({ killFrenzyLaserBonus: 1 }), 1000).frenzyUntilMs,
    ).toBe(1000 + KILL_FRENZY_MS);
    expect(rewardKill(pilot({ shieldsPerKill: 1 }), 1000).frenzyUntilMs).toBe(
      0,
    );
  });
});

describe("deathBlastTargets", () => {
  const near = { id: "near", x: 1000 + DEATH_BLAST_RADIUS_PX - 1, y: 1000 };
  const far = { id: "far", x: 1000 + DEATH_BLAST_RADIUS_PX + 1, y: 1000 };

  it("catches enemies within the blast radius", () => {
    expect(
      deathBlastTargets(pilot({ deathBlastDamage: 2 }), [near, far]),
    ).toEqual([near]);
  });

  it("a ship without a death blast catches nobody", () => {
    expect(deathBlastTargets(pilot({ laserDamageBonus: 1 }), [near])).toEqual(
      [],
    );
  });
});

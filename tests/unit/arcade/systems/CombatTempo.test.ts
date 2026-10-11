/**
 * Combat tempo — specification tests for the X-Wing "round" damage model:
 * at most one attack per maneuver cycle, a target struck by an attacker is
 * immune to that attacker until the next cycle, miniature hull/shields are
 * scaled to real-time HP and ordnance hits harder.
 */

import { describe, it, expect } from "vitest";
import {
  ATTACK_INTERVAL_MS,
  attackIntervalMs,
  HitImmunityLedger,
} from "../../../../src/arcade/systems/CombatTempo";
import {
  CYCLE_DURATION_MS,
  DURABILITY_SCALE,
  ORDNANCE_DAMAGE_SCALE,
} from "../../../../src/config";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";
import { applyLoadoutEffects } from "../../../../src/systems/BattleHelpers";
import { buildOrdnanceSlots } from "../../../../src/arcade/ArcadeOrdnance";
import { UPGRADE_DEFINITIONS } from "../../../../src/systems/UpgradeSystem";
import { SHIP_LOADOUTS } from "../../../../src/data/ShipLoadouts";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { deathBlastDamage } from "../../../../src/arcade/PilotAbilityCombat";
import { combineEffects } from "../../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";

describe("attack interval", () => {
  it("is one maneuver cycle", () => {
    expect(ATTACK_INTERVAL_MS).toBe(CYCLE_DURATION_MS);
  });

  it("never lets a weapon fire faster than once per cycle", () => {
    expect(attackIntervalMs(400)).toBe(CYCLE_DURATION_MS);
  });

  it("keeps a slower weapon's own cooldown", () => {
    expect(attackIntervalMs(900)).toBe(900);
  });
});

describe("HitImmunityLedger", () => {
  it("a struck target is immune to the same attacker for the rest of the cycle", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "t", 1000);
    expect(ledger.isImmune("a", "t", 1000 + CYCLE_DURATION_MS - 1)).toBe(true);
  });

  it("the immunity ends one cycle after the hit", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "t", 1000);
    expect(ledger.isImmune("a", "t", 1000 + CYCLE_DURATION_MS)).toBe(false);
  });

  it("another attacker can still hit the target", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "t", 1000);
    expect(ledger.isImmune("b", "t", 1001)).toBe(false);
  });

  it("forgetting a ship clears every immunity it is part of", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "t", 1000);
    ledger.recordHit("t", "b", 1000);
    ledger.forget("t");
    expect(ledger.isImmune("a", "t", 1001)).toBe(false);
    expect(ledger.isImmune("t", "b", 1001)).toBe(false);
  });
});

describe("durability scale", () => {
  it("real-time modes scale miniature hull and shields", () => {
    const real = getModeCombatStats("terran_viper", "continuous");
    const miniature = getModeCombatStats("terran_viper", "continuous", 1);
    expect(real.hull).toBe(miniature.hull * DURABILITY_SCALE);
    expect(real.maxShields).toBe(miniature.maxShields * DURABILITY_SCALE);
  });

  it("attack and weapon cooldown are not scaled", () => {
    const real = getModeCombatStats("terran_viper", "continuous");
    const miniature = getModeCombatStats("terran_viper", "continuous", 1);
    expect(real.attackDice).toBe(miniature.attackDice);
    expect(real.weaponCooldown).toBe(miniature.weaponCooldown);
  });

  it("a +1 hull upgrade adds one miniature hull point, scaled", () => {
    const loadout = Object.values(SHIP_LOADOUTS)
      .flat()
      .find((l) =>
        l.upgrades.some(
          (id) => UPGRADE_DEFINITIONS[id]?.effects?.hullBonus === 1,
        ),
      )!;
    const totalBonus = loadout.upgrades.reduce(
      (sum, id) => sum + (UPGRADE_DEFINITIONS[id]?.effects?.hullBonus ?? 0),
      0,
    );
    const ship = {
      definitionId: loadout.shipId,
      hull: 8,
      maxHull: 8,
      shields: 4,
      maxShields: 4,
    };
    applyLoadoutEffects(ship, loadout.id);
    expect(ship.maxHull).toBe(8 + totalBonus * DURABILITY_SCALE);
  });
});

describe("every real ship can be damaged and destroyed", () => {
  it("no ship spawns with zero hull in any real-time mode", () => {
    const empty = Object.keys(SHIP_DEFINITIONS).flatMap((id) =>
      (["continuous", "survival", "arcade"] as const)
        .filter((mode) => getModeCombatStats(id, mode).hull <= 0)
        .map((mode) => `${id}@${mode}`),
    );
    expect(empty).toEqual([]);
  });
});

describe("ordnance and blasts", () => {
  it("ordnance slots hit for the card's damage times the ordnance scale", () => {
    const [slot] = buildOrdnanceSlots(["concussion_missile"]);
    const card = UPGRADE_DEFINITIONS["concussion_missile"]!;
    expect(slot!.damage).toBe(card.weapon!.damage * ORDNANCE_DAMAGE_SCALE);
  });

  it("a death blast hits like ordnance", () => {
    const victim = {
      id: "v",
      x: 0,
      y: 0,
      angle: 0,
      hull: 0,
      maxHull: 8,
      shields: 0,
      maxShields: 4,
      stress: INITIAL_STRESS,
      modifiers: combineEffects([{ deathBlastDamage: 2 }]),
      frenzyUntilMs: 0,
    };
    expect(deathBlastDamage(victim)).toBe(2 * ORDNANCE_DAMAGE_SCALE);
  });
});

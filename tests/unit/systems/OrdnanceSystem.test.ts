/**
 * Tests for the Ordnance System
 */

import { describe, it, expect } from "vitest";
import {
  ORDNANCE_DEFINITIONS,
  canFireOrdnance,
  fireOrdnance,
  deployBomb,
  checkBombTrigger,
  detonateBomb,
  getEquippableOrdnance,
  spendOrdnanceCharge,
  reloadOrdnance,
  getClusterTargets,
  type OrdnanceSlot,
  type DeployedOrdnance,
} from "../../../src/systems/OrdnanceSystem";
import type { ShipState } from "../../../src/core/types";
import type { RandomGenerator } from "../../../src/utils/random";
import { rngFromNext } from "./rngFromNext";

// ============================================
// Helpers
// ============================================

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: "ship_1",
    definitionId: "terran_viper",
    faction: "terran_hegemony",
    owner: "player",
    x: 100,
    y: 100,
    angle: 0,
    hull: 5,
    maxHull: 5,
    shields: 2,
    maxShields: 2,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: "front",
    charges: 0,
    maxCharges: 0,
    ...overrides,
  };
}

function makeSlot(overrides: Partial<OrdnanceSlot> = {}): OrdnanceSlot {
  return {
    definitionId: "concussion_missile",
    charges: 2,
    isDisabled: false,
    ...overrides,
  };
}

function makeSeededRng(values: number[]): RandomGenerator {
  let i = 0;
  return rngFromNext(() => values[i++ % values.length] ?? 0.5);
}

// ============================================
// Tests
// ============================================

describe("OrdnanceSystem", () => {
  describe("ORDNANCE_DEFINITIONS", () => {
    it("should have multiple ordnance types", () => {
      const defs = Object.values(ORDNANCE_DEFINITIONS);
      expect(defs.length).toBeGreaterThan(5);
    });

    it("should have missiles, torpedoes, bombs and mines", () => {
      const types = new Set(
        Object.values(ORDNANCE_DEFINITIONS).map((d) => d.type),
      );
      expect(types.has("missile")).toBe(true);
      expect(types.has("torpedo")).toBe(true);
      expect(types.has("bomb")).toBe(true);
    });

    it("each definition should have required fields", () => {
      for (const def of Object.values(ORDNANCE_DEFINITIONS)) {
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(def.attackDice).toBeGreaterThanOrEqual(0);
        expect(def.charges).toBeGreaterThan(0);
        expect(def.pointCost).toBeGreaterThan(0);
      }
    });
  });

  describe("canFireOrdnance", () => {
    const attacker = makeShip({ id: "attacker", hasTargetLock: "target" });
    const target = makeShip({ id: "target", faction: "free_confederation" });
    const concussionMissile = ORDNANCE_DEFINITIONS["concussion_missile"]!;
    const validSlot = makeSlot({ charges: 2 });

    it("should return valid for proper setup", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        2,
      );
      expect(result.valid).toBe(true);
    });

    it("should reject when no charges remain", () => {
      const emptySlot = makeSlot({ charges: 0 });
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        emptySlot,
        true,
        false,
        2,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("charges");
    });

    it("should reject when ordnance is disabled", () => {
      const disabledSlot = makeSlot({ isDisabled: true });
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        disabledSlot,
        true,
        false,
        2,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("disabled");
    });

    it("should reject when range is null (out of range)", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        null,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("range");
    });

    it("should reject when target is below min range", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        1,
      );
      expect(result.valid).toBe(false);
    });

    it("should reject when target is above max range", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        4,
      );
      expect(result.valid).toBe(false);
    });

    it("should reject when target lock required but missing", () => {
      const attackerNoLock = makeShip({ id: "attacker", hasTargetLock: null });
      const result = canFireOrdnance(
        attackerNoLock,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        2,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("target lock");
    });

    it("should reject when target lock is on wrong ship", () => {
      const attackerWrongLock = makeShip({
        id: "attacker",
        hasTargetLock: "other_ship",
      });
      const result = canFireOrdnance(
        attackerWrongLock,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        2,
      );
      expect(result.valid).toBe(false);
    });

    it("should reject when front arc required but not in arc", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        false,
        false,
        2,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("front arc");
    });

    it("should reject when bullseye required but not in bullseye", () => {
      // Find ordnance that requires bullseye
      const bullseyeOrdnance = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.requiresBullseye,
      );
      if (bullseyeOrdnance) {
        const attackerWithLock = makeShip({
          id: "attacker",
          hasTargetLock: "target",
        });
        const result = canFireOrdnance(
          attackerWithLock,
          target,
          bullseyeOrdnance,
          validSlot,
          true,
          false,
          2,
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain("bullseye");
      }
    });

    it("should allow homing missiles without front arc", () => {
      const homingMissile = ORDNANCE_DEFINITIONS["homing_missiles"]!;
      const attackerWithLock = makeShip({
        id: "attacker",
        hasTargetLock: "target",
      });
      // Homing missiles don't require front arc
      const result = canFireOrdnance(
        attackerWithLock,
        target,
        homingMissile,
        validSlot,
        false,
        false,
        2,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("fireOrdnance", () => {
    const attacker = makeShip({ id: "attacker" });
    const target = makeShip({ id: "target" });
    const concussionMissile = ORDNANCE_DEFINITIONS["concussion_missile"]!;

    it("should return attack result structure", () => {
      const rng = makeSeededRng([0.5]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.ordnanceId).toBe("concussion_missile");
      expect(result.targetId).toBe("target");
      expect(result.attackDice).toBe(concussionMissile.attackDice);
      expect(typeof result.hits).toBe("number");
      expect(typeof result.crits).toBe("number");
      expect(typeof result.success).toBe("boolean");
    });

    it("should register crits on low rolls (< 0.125)", () => {
      // All dice roll crits
      const rng = makeSeededRng([0.05]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.crits).toBe(concussionMissile.attackDice);
      expect(result.success).toBe(true);
    });

    it("should register hits on rolls 0.125-0.5", () => {
      // All dice roll hits
      const rng = makeSeededRng([0.3]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.hits).toBe(concussionMissile.attackDice);
    });

    it("should miss on rolls >= 0.5", () => {
      // All dice miss
      const rng = makeSeededRng([0.75]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.hits).toBe(0);
      expect(result.crits).toBe(0);
      expect(result.success).toBe(false);
    });

    it("should apply bonus damage when hitting", () => {
      const rng = makeSeededRng([0.3]); // always hit
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.bonusDamage).toBe(concussionMissile.bonusDamage);
    });

    it("should not apply bonus damage when missing", () => {
      const rng = makeSeededRng([0.75]); // always miss
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(result.bonusDamage).toBe(0);
    });

    it("should apply ion tokens when hitting with ion ordnance", () => {
      const ionMissile = ORDNANCE_DEFINITIONS["ion_missiles"]!;
      const rng = makeSeededRng([0.3]); // always hit
      const result = fireOrdnance(attacker, target, ionMissile, rng);

      expect(result.ionTokens).toBe(ionMissile.ionTokens);
    });

    it("should convert hit to crit for proton torpedoes", () => {
      const protonTorpedo = ORDNANCE_DEFINITIONS["proton_torpedoes"]!;
      if (protonTorpedo) {
        const rng = makeSeededRng([0.3]); // always hit
        const result = fireOrdnance(attacker, target, protonTorpedo, rng);

        // Should have at least 1 crit (converted from hit)
        if (result.success) {
          expect(result.crits).toBeGreaterThan(0);
        }
      }
    });

    it("convertHitToCrit converts exactly 1 hit into a crit from all-hit rolls", () => {
      // proton_torpedoes has 4 attackDice; roll 0.3 = hit (0.125 <= x < 0.5, no natural crits)
      // After convertHitToCrit: attackDice-1 hits, 1 crit
      const protonTorpedo = ORDNANCE_DEFINITIONS["proton_torpedoes"]!;
      const rng = makeSeededRng([0.3]);
      const result = fireOrdnance(attacker, target, protonTorpedo, rng);
      expect(result.hits).toBe(protonTorpedo.attackDice - 1); // 3
      expect(result.crits).toBe(1);
    });

    it("should include message in result", () => {
      const rng = makeSeededRng([0.3]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);

      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe("deployBomb", () => {
    it("should deploy bomb behind ship", () => {
      const ship = makeShip({ x: 100, y: 100, angle: 0 });
      const bombDef = ORDNANCE_DEFINITIONS["proton_bombs"]!;

      if (bombDef) {
        const bomb = deployBomb(ship, bombDef);

        // Bomb should be behind the ship (positive Y since angle 0 = up, behind = positive Y)
        expect(bomb.x).toBeCloseTo(100, 0);
        expect(bomb.y).toBeGreaterThan(100); // Behind ship facing up
        expect(bomb.ownerId).toBe("ship_1");
        expect(bomb.ownerFaction).toBe("terran_hegemony");
      }
    });

    it("should set mine turnsRemaining to -1 (permanent)", () => {
      const ship = makeShip();
      const mineDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "mine",
      );

      if (mineDef) {
        const bomb = deployBomb(ship, mineDef);
        expect(bomb.turnsRemaining).toBe(-1);
      }
    });

    it("should set bomb turnsRemaining to 1", () => {
      const ship = makeShip();
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb",
      );

      if (bombDef) {
        const bomb = deployBomb(ship, bombDef);
        expect(bomb.turnsRemaining).toBe(1);
      }
    });

    it("should use areaRadius from ordnance definition", () => {
      const ship = makeShip();
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.areaRadius !== undefined,
      );

      if (bombDef) {
        const bomb = deployBomb(ship, bombDef);
        expect(bomb.radius).toBe(bombDef.areaRadius);
      }
    });

    it("should default radius to 50 when no areaRadius", () => {
      const ship = makeShip();
      const ordnance = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => !d.areaRadius,
      );

      if (ordnance) {
        const bomb = deployBomb(ship, ordnance);
        expect(bomb.radius).toBe(50);
      }
    });
  });

  describe("checkBombTrigger", () => {
    const bomb: DeployedOrdnance = {
      id: "bomb_1",
      definitionId: "proton_bomb",
      ownerId: "ship_1",
      ownerFaction: "terran_hegemony",
      x: 100,
      y: 100,
      radius: 50,
      turnsRemaining: 1,
      isTriggered: false,
    };

    it("should trigger for enemy ship in range", () => {
      const enemy = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 120,
        y: 100,
      });
      expect(checkBombTrigger(bomb, enemy)).toBe(true);
    });

    it("should not trigger for ship outside range", () => {
      const farShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 200,
        y: 200,
      });
      expect(checkBombTrigger(bomb, farShip)).toBe(false);
    });

    it("should not trigger for owner ship", () => {
      const owner = makeShip({
        id: "ship_1",
        faction: "free_confederation",
        x: 105,
        y: 100,
      });
      expect(checkBombTrigger(bomb, owner)).toBe(false);
    });

    it("should not trigger for same faction", () => {
      const ally = makeShip({
        id: "ally",
        faction: "terran_hegemony",
        x: 110,
        y: 100,
      });
      expect(checkBombTrigger(bomb, ally)).toBe(false);
    });

    it("should trigger at exactly the radius boundary", () => {
      const onEdge = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 150, // exactly 50 units from bomb at (100, 100)
        y: 100,
      });
      expect(checkBombTrigger(bomb, onEdge)).toBe(true);
    });
  });

  describe("detonateBomb", () => {
    const damageBomb: DeployedOrdnance = {
      id: "bomb_1",
      definitionId: "proton_bomb",
      ownerId: "ship_owner",
      ownerFaction: "terran_hegemony",
      x: 100,
      y: 100,
      radius: 80,
      turnsRemaining: 1,
      isTriggered: false,
    };

    it("should detect ships in blast radius", () => {
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb" && d.effect === "damage" && d.bonusDamage,
      );
      if (!bombDef) return;

      const nearbyShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 120,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, bombDef, [nearbyShip], [], rng);

      expect(result.bombId).toBe("bomb_1");
      expect(result.affectedShips.length).toBeGreaterThan(0);
    });

    it("should not affect the bomb owner", () => {
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb",
      );
      if (!bombDef) return;

      const ownerShip = makeShip({
        id: "ship_owner",
        faction: "terran_hegemony",
        x: 110,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, bombDef, [ownerShip], [], rng);

      expect(result.affectedShips.length).toBe(0);
    });

    it("should not affect ships outside blast radius", () => {
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb",
      );
      if (!bombDef) return;

      const farShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 300,
        y: 300,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, bombDef, [farShip], [], rng);

      expect(result.affectedShips.length).toBe(0);
    });

    it("should apply ion tokens for ion bombs", () => {
      const ionBomb = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) =>
          (d.type === "bomb" || d.type === "mine") &&
          d.effect === "ion" &&
          d.ionTokens,
      );
      if (!ionBomb) return;

      const nearbyShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 120,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, ionBomb, [nearbyShip], [], rng);

      if (result.affectedShips.length > 0) {
        expect(result.affectedShips[0]!.ionTokens).toBeGreaterThan(0);
      }
    });

    it("seismic charges should destroy obstacles", () => {
      const seismicDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.effect === "seismic",
      );
      if (!seismicDef) return;

      const obstacle = { id: "asteroid_1", x: 110, y: 100, radius: 30 };
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, seismicDef, [], [obstacle], rng);

      expect(result.destroyedObstacles).toContain("asteroid_1");
    });
  });

  describe("getEquippableOrdnance", () => {
    it("should return missiles when hasMissileSlot is true", () => {
      const ordnance = getEquippableOrdnance("small", true, false, false);
      const types = ordnance.map((o) => o.type);
      expect(types.some((t) => t === "missile" || t === "rocket")).toBe(true);
    });

    it("should return torpedoes when hasTorpedoSlot is true", () => {
      const ordnance = getEquippableOrdnance("small", false, true, false);
      const types = ordnance.map((o) => o.type);
      expect(types.some((t) => t === "torpedo")).toBe(true);
    });

    it("should not return bombs for small ships", () => {
      const ordnance = getEquippableOrdnance("small", false, false, true);
      expect(ordnance.length).toBe(0); // Small ships can't use bombs
    });

    it("should return bombs for medium ships", () => {
      const ordnance = getEquippableOrdnance("medium", false, false, true);
      const types = ordnance.map((o) => o.type);
      expect(types.some((t) => t === "bomb" || t === "mine")).toBe(true);
    });

    it("should return empty array with no slots", () => {
      const ordnance = getEquippableOrdnance("medium", false, false, false);
      expect(ordnance.length).toBe(0);
    });

    it("should return all compatible ordnance for large ship with all slots", () => {
      const ordnance = getEquippableOrdnance("large", true, true, true);
      expect(ordnance.length).toBeGreaterThan(5);
    });
  });

  describe("spendOrdnanceCharge", () => {
    it("should decrement charges by 1", () => {
      const slot = makeSlot({ charges: 3 });
      const updated = spendOrdnanceCharge(slot);
      expect(updated.charges).toBe(2);
    });

    it("should not go below 0", () => {
      const slot = makeSlot({ charges: 0 });
      const updated = spendOrdnanceCharge(slot);
      expect(updated.charges).toBe(0);
    });

    it("should not mutate original slot", () => {
      const slot = makeSlot({ charges: 3 });
      spendOrdnanceCharge(slot);
      expect(slot.charges).toBe(3);
    });
  });

  describe("reloadOrdnance", () => {
    it("should reload recoverable ordnance", () => {
      const recoverableOrdnance = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.recoverable,
      )!;
      const slot = makeSlot({
        definitionId: recoverableOrdnance.id,
        charges: 0,
      });
      const updated = reloadOrdnance(slot, recoverableOrdnance);
      expect(updated.charges).toBe(1);
    });

    it("should not reload non-recoverable ordnance", () => {
      const concussionMissile = ORDNANCE_DEFINITIONS["concussion_missile"]!;
      const slot = makeSlot({ charges: 0 });
      const updated = reloadOrdnance(slot, concussionMissile);
      expect(updated.charges).toBe(0);
    });

    it("should not exceed max charges", () => {
      const recoverableOrdnance = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.recoverable,
      )!;
      const slot = makeSlot({
        definitionId: recoverableOrdnance.id,
        charges: recoverableOrdnance.charges,
      });
      const updated = reloadOrdnance(slot, recoverableOrdnance);
      expect(updated.charges).toBe(recoverableOrdnance.charges);
    });
  });

  describe("getClusterTargets", () => {
    const primaryTarget = makeShip({ id: "primary", x: 100, y: 100 });

    it("should find ships within cluster radius", () => {
      const nearbyEnemy = makeShip({ id: "nearby", x: 130, y: 100 });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, nearbyEnemy],
        50,
      );
      expect(targets).toContain(nearbyEnemy);
    });

    it("should not include the primary target", () => {
      const nearbyEnemy = makeShip({ id: "nearby", x: 120, y: 100 });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, nearbyEnemy],
        50,
      );
      expect(targets).not.toContain(primaryTarget);
    });

    it("should exclude ships outside radius", () => {
      const farEnemy = makeShip({ id: "far", x: 300, y: 300 });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, farEnemy],
        50,
      );
      expect(targets).not.toContain(farEnemy);
    });

    it("should exclude destroyed ships (hull <= 0)", () => {
      const destroyedShip = makeShip({
        id: "destroyed",
        x: 110,
        y: 100,
        hull: 0,
      });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, destroyedShip],
        50,
      );
      expect(targets).not.toContain(destroyedShip);
    });

    it("should return empty array when no nearby enemies", () => {
      const targets = getClusterTargets(primaryTarget, [primaryTarget], 50);
      expect(targets).toHaveLength(0);
    });

    it("should include ship at exact cluster radius boundary (<=)", () => {
      // dist === 50, radius === 50 — must be included
      const atBoundary = makeShip({ id: "boundary", x: 150, y: 100 });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, atBoundary],
        50,
      );
      expect(targets).toContain(atBoundary);
    });

    it("should exclude ship one unit outside radius", () => {
      const justOutside = makeShip({ id: "outside", x: 151, y: 100 });
      const targets = getClusterTargets(
        primaryTarget,
        [primaryTarget, justOutside],
        50,
      );
      expect(targets).not.toContain(justOutside);
    });
  });

  // ── Targeted mutation-killing tests ─────────────────────────────────────

  describe("ORDNANCE_DEFINITIONS - key property assertions", () => {
    it("cluster_mines should be type mine with no arc requirements", () => {
      const def = ORDNANCE_DEFINITIONS["cluster_mines"]!;
      expect(def.id).toBe("cluster_mines");
      expect(def.type).toBe("mine");
      expect(def.requiresFrontArc).toBe(false);
      expect(def.requiresTargetLock).toBe(false);
      expect(def.requiresBullseye).toBe(false);
      expect(def.recoverable).toBe(false);
    });

    it("adv_rockets should be recoverable and not require target lock", () => {
      const def = ORDNANCE_DEFINITIONS["adv_rockets"]!;
      expect(def.id).toBe("adv_rockets");
      expect(def.recoverable).toBe(true);
      expect(def.requiresTargetLock).toBe(false);
      expect(def.requiresFrontArc).toBe(true);
      expect(def.requiresBullseye).toBe(false);
    });

    it("ion_bombs should have ion effect and no arc or lock requirements", () => {
      const def = ORDNANCE_DEFINITIONS["ion_bombs"]!;
      expect(def.id).toBe("ion_bombs");
      expect(def.effect).toBe("ion");
      expect(def.requiresFrontArc).toBe(false);
      expect(def.requiresTargetLock).toBe(false);
      expect(def.requiresBullseye).toBe(false);
      expect(def.recoverable).toBe(false);
    });

    it("ion_rockets should have ion effect with front arc required", () => {
      const def = ORDNANCE_DEFINITIONS["ion_rockets"]!;
      expect(def.id).toBe("ion_rockets");
      expect(def.effect).toBe("ion");
      expect(def.requiresFrontArc).toBe(true);
      expect(def.requiresTargetLock).toBe(false);
      expect(def.requiresBullseye).toBe(false);
    });

    it("homing_missiles should NOT require front arc but require target lock", () => {
      const def = ORDNANCE_DEFINITIONS["homing_missiles"]!;
      expect(def.requiresFrontArc).toBe(false);
      expect(def.requiresTargetLock).toBe(true);
    });

    it("proton_torpedoes should have convertHitToCrit: true", () => {
      const def = ORDNANCE_DEFINITIONS["proton_torpedoes"]!;
      expect(def.id).toBe("proton_torpedoes");
      expect(def.convertHitToCrit).toBe(true);
      expect(def.requiresTargetLock).toBe(true);
      expect(def.type).toBe("torpedo");
    });

    it("concussion_missile should NOT have convertHitToCrit", () => {
      const def = ORDNANCE_DEFINITIONS["concussion_missile"]!;
      expect(def.convertHitToCrit).toBeFalsy();
    });
  });

  describe("canFireOrdnance - range boundary", () => {
    const attacker = makeShip({ id: "attacker", hasTargetLock: "target" });
    const target = makeShip({ id: "target", faction: "free_confederation" });
    const concussionMissile = ORDNANCE_DEFINITIONS["concussion_missile"]!; // range 2–3
    const validSlot = makeSlot({ charges: 2 });

    it("should accept target at exactly max range (range.max)", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        concussionMissile.range.max,
      );
      expect(result.valid).toBe(true);
    });

    it("should reject target one step beyond max range", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        concussionMissile.range.max + 1,
      );
      expect(result.valid).toBe(false);
    });

    it("should accept target at exactly min range", () => {
      const result = canFireOrdnance(
        attacker,
        target,
        concussionMissile,
        validSlot,
        true,
        false,
        concussionMissile.range.min,
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("fireOrdnance - result content", () => {
    const attacker = makeShip({ id: "attacker" });
    const target = makeShip({ id: "target" });
    const concussionMissile = ORDNANCE_DEFINITIONS["concussion_missile"]!;
    const ionMissile = ORDNANCE_DEFINITIONS["ion_missiles"]!;
    const protonTorpedo = ORDNANCE_DEFINITIONS["proton_torpedoes"]!;

    it("hit message should contain weapon name", () => {
      const rng = makeSeededRng([0.3]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);
      if (result.success) {
        expect(result.message).toContain("Concussion");
      }
    });

    it('miss message should contain "missed"', () => {
      const rng = makeSeededRng([0.75]);
      const result = fireOrdnance(attacker, target, concussionMissile, rng);
      expect(result.success).toBe(false);
      expect(result.message).toContain("missed");
    });

    it("should not apply ion tokens when ion missile misses", () => {
      const rng = makeSeededRng([0.75]);
      const result = fireOrdnance(attacker, target, ionMissile, rng);
      expect(result.success).toBe(false);
      expect(result.ionTokens).toBe(0);
    });

    it("should not convert crits when proton torpedo misses (0 hits)", () => {
      const rng = makeSeededRng([0.75]);
      const result = fireOrdnance(attacker, target, protonTorpedo, rng);
      expect(result.hits).toBe(0);
      expect(result.crits).toBe(0);
    });
  });

  describe("deployBomb - position verification", () => {
    it("should place bomb directly behind ship at angle 90 (facing right)", () => {
      // angle=90 means facing right; behind = to the left
      // angleRad = (90 + 180) * PI/180 = 270deg = 3PI/2
      // x = ship.x + sin(3PI/2) * 60 = 100 + (-1)*60 = 40
      // y = ship.y - cos(3PI/2) * 60 = 100 - 0*60 = 100
      const ship = makeShip({ x: 100, y: 100, angle: 90 });
      const bombDef = ORDNANCE_DEFINITIONS["proton_bombs"]!;
      if (!bombDef) return;
      const bomb = deployBomb(ship, bombDef);
      expect(bomb.x).toBeCloseTo(40, 0);
      expect(bomb.y).toBeCloseTo(100, 0);
    });

    it("initial isTriggered should be false", () => {
      const ship = makeShip();
      const bombDef = ORDNANCE_DEFINITIONS["proton_bombs"]!;
      if (!bombDef) return;
      const bomb = deployBomb(ship, bombDef);
      expect(bomb.isTriggered).toBe(false);
    });
  });

  describe("detonateBomb - boundary and effect coverage", () => {
    const damageBomb: DeployedOrdnance = {
      id: "bomb_1",
      definitionId: "proton_bomb",
      ownerId: "ship_owner",
      ownerFaction: "terran_hegemony",
      x: 100,
      y: 100,
      radius: 80,
      turnsRemaining: 1,
      isTriggered: false,
    };

    it("should affect ship at exactly the blast radius boundary (<=)", () => {
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb" && d.effect === "damage",
      )!;
      if (!bombDef) return;
      // bomb at (100,100) radius 80; ship at (180,100) = exactly 80 units away
      const boundaryShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 180,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, bombDef, [boundaryShip], [], rng);
      expect(result.affectedShips).toHaveLength(1);
      expect(result.affectedShips[0]!.shipId).toBe("enemy");
    });

    it("should not affect ship one unit outside blast radius", () => {
      const bombDef = Object.values(ORDNANCE_DEFINITIONS).find(
        (d) => d.type === "bomb" && d.effect === "damage",
      )!;
      if (!bombDef) return;
      // bomb at (100,100) radius 80; ship at (181,100) = 81 units away
      const outsideShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 181,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(damageBomb, bombDef, [outsideShip], [], rng);
      expect(result.affectedShips).toHaveLength(0);
    });

    it("cluster_mines effect should deal damage to ships in radius", () => {
      const clusterDef = ORDNANCE_DEFINITIONS["cluster_mines"]!;
      if (!clusterDef) return;
      const nearbyShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 120,
        y: 100,
      });
      // seed 0.3 → hits (< 0.5)
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(
        damageBomb,
        clusterDef,
        [nearbyShip],
        [],
        rng,
      );
      expect(result.affectedShips.length).toBeGreaterThan(0);
      expect(result.affectedShips[0]!.shipId).toBe("enemy");
    });

    it("ion_bombs should apply ion tokens even when damage is 0", () => {
      const ionBombDef = ORDNANCE_DEFINITIONS["ion_bombs"]!;
      if (!ionBombDef) return;
      const nearbyShip = makeShip({
        id: "enemy",
        faction: "free_confederation",
        x: 120,
        y: 100,
      });
      const rng = makeSeededRng([0.3]);
      const result = detonateBomb(
        damageBomb,
        ionBombDef,
        [nearbyShip],
        [],
        rng,
      );
      // ion bombs deal 0 attack dice damage but should add ion tokens
      if (result.affectedShips.length > 0) {
        expect(result.affectedShips[0]!.ionTokens).toBeGreaterThan(0);
        expect(result.affectedShips[0]!.damage).toBe(0);
      }
    });
  });

  describe("getEquippableOrdnance - type granularity", () => {
    it("rockets are included in missile slot results", () => {
      const ordnance = getEquippableOrdnance("medium", true, false, false);
      const types = ordnance.map((o) => o.type);
      expect(types).toContain("rocket");
    });

    it("torpedo slot does not return missiles", () => {
      const ordnance = getEquippableOrdnance("medium", false, true, false);
      const types = ordnance.map((o) => o.type);
      expect(types).not.toContain("missile");
      expect(types).not.toContain("rocket");
    });

    it("missile slot does not return torpedoes", () => {
      const ordnance = getEquippableOrdnance("medium", true, false, false);
      const types = ordnance.map((o) => o.type);
      expect(types).not.toContain("torpedo");
    });

    it("bomb slot returns both bombs and mines for medium ships", () => {
      const ordnance = getEquippableOrdnance("medium", false, false, true);
      const types = ordnance.map((o) => o.type);
      expect(types).toContain("bomb");
      expect(types).toContain("mine");
    });
  });
});

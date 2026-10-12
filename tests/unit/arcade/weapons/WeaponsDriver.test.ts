/**
 * WeaponsDriver — the Phaser-free driver of the secondary-weapons runtime
 * shared by the battle scenes (BattleWeapons) and the headless sims: arms
 * ships from their quick builds, runs the runtime, routes every hit to the
 * owner's damage path, and reports cloak damage factors.
 */
import { describe, it, expect } from "vitest";
import { decideOrdnance } from "../../../../src/arcade/ai/OrdnanceDecision";
import { HitImmunityLedger } from "../../../../src/arcade/systems/CombatTempo";
import { CLOAKED_DAMAGE_FACTOR } from "../../../../src/arcade/weapons/FireControl";
import {
  WeaponsDriver,
  type WeaponHit,
  type WeaponsDriverLink,
} from "../../../../src/arcade/weapons/WeaponsDriver";
import type { WeaponBody } from "../../../../src/arcade/weapons/weaponTypes";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import { CYCLE_DURATION_MS, RANGE_2 } from "../../../../src/config";
import { LOCK_ACQUIRE_MS } from "../../../../src/arcade/weapons/TargetLock";

const WORLD = 6000;
const TICK_MS = 16;

function body(id: string, side: string, y: number): WeaponBody {
  return { id, side, x: 3000, y, angle: 0, hull: 400, agilityDice: 1 };
}

function driverWith(
  bodies: WeaponBody[],
  hits: WeaponHit[],
  wanted: string | null = null,
  ledger = new HitImmunityLedger(),
  human: string | null = null,
): WeaponsDriver {
  const link: WeaponsDriverLink = {
    bodies: () => bodies,
    wantedTargetOf: () => wanted,
    applyHit: (hit) => hits.push(hit),
    isBotControlled: (id) => id !== human,
  };
  return new WeaponsDriver(link, {
    worldSize: WORLD,
    ledger,
    random: () => 0,
    decide: decideOrdnance,
  });
}

describe("WeaponsDriver", () => {
  it("arms_a_ship_from_its_quick_build", () => {
    const driver = driverWith([], []);
    driver.equip("a", {
      definitionId: "terran_gladius",
      loadoutId: "gladius_striker",
      modifiers: NEUTRAL_MODIFIERS,
    });
    const kinds = driver.runtime.arsenalOf("a")?.slots.map((s) => s.spec.kind);
    expect(kinds).toContain("torpedo");
  });

  it("arms_nothing_without_a_quick_build", () => {
    const driver = driverWith([], []);
    driver.equip("a", {
      definitionId: "terran_gladius",
      loadoutId: null,
      modifiers: NEUTRAL_MODIFIERS,
    });
    expect(driver.runtime.arsenalOf("a")?.slots ?? []).toHaveLength(0);
  });

  it("routes_a_bot_torpedo_hit_to_the_owner_damage_path", () => {
    const hits: WeaponHit[] = [];
    const shooter = body("a", "A", 3000);
    const target = body("b", "B", 3000 - RANGE_2);
    const driver = driverWith([shooter, target], hits, "b");
    driver.equip("a", {
      definitionId: "terran_gladius",
      loadoutId: "gladius_striker",
      modifiers: NEUTRAL_MODIFIERS,
    });
    for (let t = 0; t < 3000; t += TICK_MS) driver.update(TICK_MS, t);
    expect(hits.some((h) => h.targetId === "b" && h.damage > 0)).toBe(true);
  });

  describe("a human's FIRE_SECONDARY at a target already attacked this cycle", () => {
    function lockedTorpedo(ledger: HitImmunityLedger): WeaponsDriver {
      const shooter = body("a", "A", 3000);
      const target = body("b", "B", 3000 - RANGE_2);
      const driver = driverWith([shooter, target], [], "b", ledger, "a");
      driver.equip("a", {
        definitionId: "terran_gladius",
        loadoutId: "gladius_striker",
        modifiers: NEUTRAL_MODIFIERS,
      });
      for (let t = 0; t <= LOCK_ACQUIRE_MS; t += TICK_MS)
        driver.update(TICK_MS, t);
      return driver;
    }

    it("is_held_and_launches_as_soon_as_the_cycle_clears", () => {
      const ledger = new HitImmunityLedger();
      const driver = lockedTorpedo(ledger);
      const pressedAt = LOCK_ACQUIRE_MS + TICK_MS;
      ledger.recordHit("a", "b", pressedAt - TICK_MS);
      expect(driver.fire("a", pressedAt)).toBe("attacked");
      for (let t = pressedAt; t <= pressedAt + CYCLE_DURATION_MS; t += TICK_MS)
        driver.update(TICK_MS, t);
      expect(driver.lastOutcomeOf("a")).toBe("launched");
    });

    it("lapses_after_one_cycle", () => {
      const ledger = new HitImmunityLedger();
      const driver = lockedTorpedo(ledger);
      const pressedAt = LOCK_ACQUIRE_MS + TICK_MS;
      ledger.recordHit("a", "b", pressedAt);
      expect(driver.fire("a", pressedAt)).toBe("attacked");
      for (
        let t = pressedAt;
        t <= pressedAt + 2 * CYCLE_DURATION_MS;
        t += TICK_MS
      ) {
        ledger.recordHit("a", "b", t);
        driver.update(TICK_MS, t);
      }
      expect(driver.lastOutcomeOf("a")).toBe("attacked");
      ledger.forget("b");
      driver.update(TICK_MS, pressedAt + 3 * CYCLE_DURATION_MS);
      expect(driver.runtime.shotsInFlight).toHaveLength(0);
    });
  });

  it("reports_the_cloak_damage_factor_until_its_ship_attacks", () => {
    const driver = driverWith([body("o", "A", 3000)], []);
    driver.equip("o", {
      definitionId: "confed_owl",
      loadoutId: "owl_infiltrator",
      modifiers: NEUTRAL_MODIFIERS,
    });
    driver.runtime.toggleCloak("o");
    expect(driver.incomingDamageFactor("o")).toBe(CLOAKED_DAMAGE_FACTOR);
    driver.onAttack("o");
    expect(driver.incomingDamageFactor("o")).toBe(1);
  });
});

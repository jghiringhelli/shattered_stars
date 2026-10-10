import { describe, it, expect } from "vitest";
import {
  loadoutUpgradeIds,
  resolveUpgradeModifiers,
  applyControlModifiers,
  applyOrdnanceModifiers,
  applyTurretModifiers,
  resolveLoadoutModifiers,
} from "../../../src/arcade/ArcadeUpgradeEffects";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { combineEffects } from "../../../src/core/CombatModifiers";
import { resolveUpgradeModifiers as upgradesOnly } from "../../../src/arcade/ArcadeUpgradeEffects";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { buildOrdnanceSlots } from "../../../src/arcade/ArcadeOrdnance";
import { buildTurretSlot } from "../../../src/arcade/ArcadeTurret";
import { createControlState } from "../../../src/core/ArcadeControls";
import { NEUTRAL_MODIFIERS } from "../../../src/core/CombatModifiers";
import { SHIP_LOADOUTS } from "../../../src/data/ShipLoadouts";
import type { ShipState } from "../../../src/core/types";

const SHIP: ShipState = {
  id: "s1",
  definitionId: "terran_viper",
  faction: "terran_hegemony",
  owner: "player",
  x: 0,
  y: 0,
  angle: 0,
  hull: 3,
  maxHull: 3,
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
};

describe("loadoutUpgradeIds", () => {
  it("returns no upgrades for the bare ship", () => {
    expect(loadoutUpgradeIds("terran_viper", null)).toEqual([]);
  });

  it("returns no upgrades for an unknown loadout id", () => {
    expect(loadoutUpgradeIds("terran_viper", "no_such_loadout")).toEqual([]);
  });

  it("returns the loadout's upgrade list", () => {
    const loadout = SHIP_LOADOUTS["terran_viper"]!.find(
      (l) => l.upgrades.length > 0,
    )!;
    expect(loadoutUpgradeIds("terran_viper", loadout.id)).toEqual(
      loadout.upgrades,
    );
  });
});

describe("resolveUpgradeModifiers", () => {
  it("is neutral for a ship with no upgrades", () => {
    expect(resolveUpgradeModifiers([])).toEqual(NEUTRAL_MODIFIERS);
  });

  it("ignores unknown upgrade ids", () => {
    expect(resolveUpgradeModifiers(["not_a_card"])).toEqual(NEUTRAL_MODIFIERS);
  });

  it("folds catalog effects of every equipped card", () => {
    const sheet = resolveUpgradeModifiers(["heavy_laser_cannon", "marksman"]);
    expect(sheet.laserDamageBonus).toBe(1);
    expect(sheet.calmLaserDamageBonus).toBe(1);
  });

  it("marks aura-projecting crew", () => {
    expect(resolveUpgradeModifiers(["tactical_officer"]).projectsAura).toBe(
      true,
    );
  });
});

describe("applyControlModifiers", () => {
  it("shortens the boost recharge with an engine upgrade", () => {
    const base = createControlState(SHIP);
    const upgraded = applyControlModifiers(
      base,
      resolveUpgradeModifiers(["engine_upgrade"]),
    );
    expect(upgraded.boostCooldownMax).toBeCloseTo(base.boostCooldownMax * 0.6);
    expect(upgraded.barrelRollCooldownMax).toBe(base.barrelRollCooldownMax);
  });

  it("leaves a bare ship's recharge times untouched", () => {
    const base = createControlState(SHIP);
    expect(applyControlModifiers(base, NEUTRAL_MODIFIERS)).toEqual(base);
  });
});

describe("applyOrdnanceModifiers", () => {
  it("adds charges from a weapons engineer", () => {
    const slots = buildOrdnanceSlots(["proton_torpedo"]);
    const [slot] = applyOrdnanceModifiers(
      slots,
      resolveUpgradeModifiers(["weapons_engineer"]),
    );
    expect(slot!.charges).toBe(3);
    expect(slot!.maxCharges).toBe(3);
  });

  it("shortens reloads from a fire-control system", () => {
    const slots = buildOrdnanceSlots(["concussion_missile"]);
    const [slot] = applyOrdnanceModifiers(
      slots,
      resolveUpgradeModifiers(["fire_control_system"]),
    );
    expect(slot!.cooldownMax).toBeCloseTo(slots[0]!.cooldownMax * 0.85);
  });

  it("extends homing only on homing ordnance", () => {
    const slots = buildOrdnanceSlots(["concussion_missile", "proton_bomb"]);
    const [missile, bomb] = applyOrdnanceModifiers(
      slots,
      resolveUpgradeModifiers(["targeting_computer"]),
    );
    expect(missile!.homingTurnBudget).toBe(slots[0]!.homingTurnBudget + 120);
    expect(bomb!.homingTurnBudget).toBe(0);
  });
});

describe("applyTurretModifiers", () => {
  it("returns null for a ship without a turret", () => {
    expect(applyTurretModifiers(null, NEUTRAL_MODIFIERS)).toBeNull();
  });

  it("speeds up the turret with a veteran gunner", () => {
    const turret = buildTurretSlot(["twin_laser_turret"]);
    const upgraded = applyTurretModifiers(
      turret,
      resolveUpgradeModifiers(["veteran_gunner"]),
    );
    expect(upgraded!.cooldownMax).toBeCloseTo(turret!.cooldownMax * 0.7);
  });
});

describe("resolveLoadoutModifiers — upgrades plus the pilot's ability", () => {
  const allLoadouts = Object.values(SHIP_LOADOUTS).flat();

  it("equals the upgrades and the pilot's ability folded together", () => {
    const loadout = allLoadouts.find(
      (l) =>
        PILOT_CARDS[l.pilotId]?.abilityId !== undefined &&
        l.upgrades.length > 0,
    )!;
    const abilityId = PILOT_CARDS[loadout.pilotId]!.abilityId!;
    const effects = loadout.upgrades
      .map((id) => UPGRADE_DEFINITIONS[id]?.realtime)
      .filter((effect) => effect !== undefined);
    expect(resolveLoadoutModifiers(loadout.shipId, loadout.id)).toEqual(
      combineEffects([...effects, PILOT_ABILITY_REALTIME[abilityId]!]),
    );
  });

  it("a pilot ability changes the sheet versus upgrades alone", () => {
    const loadout = allLoadouts.find(
      (l) => PILOT_CARDS[l.pilotId]?.abilityId !== undefined,
    )!;
    expect(resolveLoadoutModifiers(loadout.shipId, loadout.id)).not.toEqual(
      upgradesOnly(loadout.upgrades),
    );
  });

  it("a bare ship (no loadout) is neutral", () => {
    expect(resolveLoadoutModifiers("terran_viper", undefined)).toEqual(
      NEUTRAL_MODIFIERS,
    );
  });

  it("a rookie loadout carries only its upgrades", () => {
    const rookie = allLoadouts.find(
      (l) =>
        PILOT_CARDS[l.pilotId]?.abilityId === undefined &&
        l.upgrades.length > 0,
    )!;
    expect(resolveLoadoutModifiers(rookie.shipId, rookie.id)).toEqual(
      upgradesOnly(rookie.upgrades),
    );
  });
});

describe("applyControlModifiers — speed bonus", () => {
  it("raises the top speed by the bonus", () => {
    const base = createControlState(SHIP, 18, "fighter", { min: 1, max: 4 });
    const control = applyControlModifiers(base, {
      ...NEUTRAL_MODIFIERS,
      maxSpeedBonus: 1,
    });
    expect(control.maxSpeed).toBe(5);
  });
});

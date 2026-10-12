/**
 * Arsenal — a ship's secondary weapons as equipped from its quick build:
 * up to three launcher/device slots (charges, reload), an optional turret,
 * the weapon selected for FIRE_SECONDARY, its lock, and a cloak only when
 * the ship's action bar has one.
 */

import { describe, it, expect } from "vitest";
import {
  BASE_CLOAK_MS,
  CLOAK_RECHARGE_MS,
  createArsenal,
  cycleSelection,
  endCloak,
  selectedSlot,
  startCloak,
  tickArsenal,
} from "../../../../src/arcade/weapons/Arsenal";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../../../src/core/CombatModifiers";
import { ATTACK_INTERVAL_MS } from "../../../../src/arcade/systems/CombatTempo";
import { UPGRADE_DEFINITIONS } from "../../../../src/systems/UpgradeSystem";

const MS_PER_S = 1000;

function arsenal(
  upgradeIds: string[],
  modifiers: Partial<CombatModifiers> = {},
  definitionId = "terran_viper",
) {
  return createArsenal({
    definitionId,
    upgradeIds,
    modifiers: { ...NEUTRAL_MODIFIERS, ...modifiers },
  });
}

describe("createArsenal", () => {
  it("fills slots from launcher and device cards, in loadout order", () => {
    const a = arsenal(["proton_torpedo", "heavy_laser_cannon", "cluster_mine"]);
    expect(a.slots.map((s) => s.spec.kind)).toEqual(["torpedo", "mine"]);
    expect(a.slots[0]!.charges).toBe(2);
    expect(a.selected).toBe(0);
  });

  it("applies bonus charges, reload and homing modifiers", () => {
    const a = arsenal(["concussion_missile"], {
      ordnanceBonusCharges: 1,
      ordnanceCooldownMultiplier: 0.5,
      homingTurnBonus: 90,
    });
    const slot = a.slots[0]!;
    expect(slot.charges).toBe(4);
    expect(slot.maxCharges).toBe(4);
    expect(slot.spec.cooldownMs).toBe(2000);
    expect(slot.spec.kind === "missile" && slot.spec.homingTurnBudget).toBe(
      (UPGRADE_DEFINITIONS.concussion_missile?.weapon?.homingTurnBudget ?? 0) +
        90,
    );
  });

  it("never reloads a weapon faster than one attack per cycle", () => {
    const a = arsenal(["light_laser_turret"], {
      turretCooldownMultiplier: 0.1,
    });
    expect(a.turret!.spec.cooldownMs).toBe(ATTACK_INTERVAL_MS);
  });

  it("mounts a turret from a turret card", () => {
    expect(arsenal(["twin_laser_turret"]).turret?.spec.name).toBe(
      "Twin Laser Turret",
    );
    expect(arsenal([]).turret).toBeNull();
  });

  it("grants a cloak only to ships with the cloak action", () => {
    expect(arsenal([]).cloak).toBeNull();
    const raven = arsenal([], { cloakDurationBonus: 4 }, "confed_raven");
    expect(raven.cloak?.durationMs).toBe(BASE_CLOAK_MS + 4 * MS_PER_S);
  });

  it("has nothing selected without slots", () => {
    expect(arsenal([]).selected).toBe(-1);
    expect(selectedSlot(arsenal([]))).toBeNull();
  });
});

describe("cycleSelection", () => {
  it("cycles through the slots and wraps", () => {
    const a = arsenal(["proton_torpedo", "concussion_missile", "proton_bomb"]);
    expect(cycleSelection(a).selected).toBe(1);
    expect(cycleSelection(cycleSelection(a)).selected).toBe(0);
  });
});

describe("tickArsenal", () => {
  it("counts reloads down", () => {
    const a = arsenal(["proton_torpedo"]);
    a.slots[0]!.cooldownMs = 1000;
    tickArsenal(a, 400);
    expect(a.slots[0]!.cooldownMs).toBe(600);
    tickArsenal(a, 1000);
    expect(a.slots[0]!.cooldownMs).toBe(0);
  });

  it("runs the cloak out, then recharges it", () => {
    const a = arsenal([], {}, "confed_raven");
    expect(startCloak(a)).toBe(true);
    expect(startCloak(a)).toBe(false);
    tickArsenal(a, BASE_CLOAK_MS);
    expect(a.cloak!.activeMs).toBe(0);
    expect(a.cloak!.rechargeMs).toBe(CLOAK_RECHARGE_MS);
    expect(startCloak(a)).toBe(false);
    tickArsenal(a, CLOAK_RECHARGE_MS);
    expect(startCloak(a)).toBe(true);
  });

  it("ends the cloak early (firing breaks it) and starts the recharge", () => {
    const a = arsenal([], {}, "confed_raven");
    startCloak(a);
    endCloak(a);
    expect(a.cloak!.activeMs).toBe(0);
    expect(a.cloak!.rechargeMs).toBe(CLOAK_RECHARGE_MS);
  });
});

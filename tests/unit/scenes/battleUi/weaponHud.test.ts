/**
 * Shared HUD model for secondary weapons and pilot feedback: the weapon-bar
 * slots built from a ship's arsenal (selected slot, charges, reload, lock)
 * and the short labels shown when FIRE_SECONDARY or a maneuver is refused.
 */

import { describe, it, expect } from "vitest";
import {
  cloakRefusalLabel,
  FIRE_SECONDARY_HINT,
  NEXT_WEAPON_HINT,
  fireOutcomeLabel,
  refusalLabel,
  secondaryWeaponSlots,
} from "../../../../src/scenes/battleUi/weaponHud";
import { createArsenal } from "../../../../src/arcade/weapons/Arsenal";
import { LOCK_ACQUIRE_MS } from "../../../../src/arcade/weapons/TargetLock";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";

function arsenal(upgradeIds: string[]) {
  return createArsenal({
    definitionId: "terran_viper",
    upgradeIds,
    modifiers: NEUTRAL_MODIFIERS,
  });
}

describe("secondaryWeaponSlots", () => {
  it("lists slots then the turret, marking the selected one", () => {
    const a = arsenal(["proton_torpedo", "cluster_mine", "light_laser_turret"]);
    const slots = secondaryWeaponSlots(a);
    expect(slots.map((s) => s.kind)).toEqual(["torpedo", "mine", "turret"]);
    expect(slots[0]).toMatchObject({
      selected: true,
      charges: 2,
      maxCharges: 2,
      keyHint: FIRE_SECONDARY_HINT,
    });
    expect(slots[1]).toMatchObject({
      selected: false,
      keyHint: NEXT_WEAPON_HINT,
    });
  });

  it("shows reload as a fraction and lock progress on launchers", () => {
    const a = arsenal(["proton_torpedo"]);
    a.slots[0]!.cooldownMs = a.slots[0]!.spec.cooldownMs / 2;
    a.lock = { targetId: "e", heldMs: LOCK_ACQUIRE_MS };
    const [torpedo] = secondaryWeaponSlots(a);
    expect(torpedo!.cooldown).toBeCloseTo(0.5);
    expect(torpedo!.lock).toBe(1);
  });

  it("is empty without an arsenal", () => {
    expect(secondaryWeaponSlots(null)).toEqual([]);
  });
});

describe("feedback labels", () => {
  it("names every refused fire", () => {
    expect(fireOutcomeLabel("launched")).toBeNull();
    expect(fireOutcomeLabel("dropped")).toBeNull();
    expect(fireOutcomeLabel("locking")).toBe("NO LOCK");
    expect(fireOutcomeLabel("out_of_arc")).toBe("OUT OF ARC");
    expect(fireOutcomeLabel("empty")).toBe("OUT OF AMMO");
    expect(fireOutcomeLabel("attacked")).toBe("LAUNCH QUEUED: NEXT CYCLE");
  });

  it("names refused maneuvers and why", () => {
    expect(refusalLabel({ action: "tallon", reason: "stressed" })).toBe(
      "STRESSED: NO TALLON ROLL",
    );
    expect(refusalLabel({ action: "boost", reason: "no_action" })).toBe(
      "NO BOOST ACTION",
    );
    expect(refusalLabel({ action: "kturn", reason: "not_on_dial" })).toBe(
      "K-TURN NOT ON DIAL",
    );
  });
});

describe("cloakRefusalLabel", () => {
  it("says whether the ship has no cloak or must wait for it", () => {
    expect(cloakRefusalLabel(null)).toBe("NO CLOAKING DEVICE");
    expect(
      cloakRefusalLabel({ durationMs: 8000, activeMs: 0, rechargeMs: 500 }),
    ).toBe("CLOAK RECHARGING");
  });
});

/**
 * OrdnanceDecision — how a bot uses its secondary weapons: launch a
 * missile/torpedo only at a locked target inside the launcher's arc and
 * band, drop a device when an enemy is close astern and no friend would be
 * caught in the blast, cloak when an enemy has it in its sights.
 */

import { describe, it, expect } from "vitest";
import { decideOrdnance } from "../../../../src/arcade/ai/OrdnanceDecision";
import { createArsenal } from "../../../../src/arcade/weapons/Arsenal";
import { LOCK_ACQUIRE_MS } from "../../../../src/arcade/weapons/TargetLock";
import type {
  OrdnanceView,
  WeaponBody,
} from "../../../../src/arcade/weapons/weaponTypes";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";

const WORLD = 6000;
const SELF: WeaponBody = {
  id: "s",
  side: "a",
  x: 3000,
  y: 3000,
  angle: 0,
  hull: 50,
  agilityDice: 1,
};

function enemy(x: number, y: number, angle = 180): WeaponBody {
  return { id: "e", side: "b", x, y, angle, hull: 50, agilityDice: 1 };
}

function view(
  upgradeIds: string[],
  overrides: Partial<OrdnanceView> = {},
  definitionId = "terran_viper",
): OrdnanceView {
  const arsenal = createArsenal({
    definitionId,
    upgradeIds,
    modifiers: NEUTRAL_MODIFIERS,
  });
  return {
    self: SELF,
    arsenal,
    target: null,
    enemies: [],
    allies: [],
    worldSize: WORLD,
    ...overrides,
  };
}

/** @returns The view with its launcher locked on "e". */
function lockedOnE(v: OrdnanceView): OrdnanceView {
  return {
    ...v,
    arsenal: { ...v.arsenal, lock: { targetId: "e", heldMs: LOCK_ACQUIRE_MS } },
  };
}

describe("decideOrdnance — launchers", () => {
  const target = enemy(3000, 2780);

  it("launches at a locked target in arc and range", () => {
    const v = lockedOnE(
      view(["proton_torpedo"], { target, enemies: [target] }),
    );
    expect(decideOrdnance(v)).toEqual({ kind: "fire", slot: 0 });
  });

  it("holds while the lock is still being acquired", () => {
    const v = view(["proton_torpedo"], { target, enemies: [target] });
    expect(decideOrdnance(v)).toBeNull();
  });

  it("never launches without a target", () => {
    const v = lockedOnE(view(["proton_torpedo"]));
    expect(decideOrdnance(v)).toBeNull();
  });
});

describe("decideOrdnance — devices", () => {
  it("drops a mine when an enemy is close astern", () => {
    const behind = enemy(3000, 3150, 0);
    expect(
      decideOrdnance(view(["proximity_mine"], { enemies: [behind] })),
    ).toEqual({
      kind: "fire",
      slot: 0,
    });
  });

  it("never drops a device forward at an enemy ahead", () => {
    const ahead = enemy(3000, 2850);
    expect(
      decideOrdnance(
        view(["proton_bomb"], { target: ahead, enemies: [ahead] }),
      ),
    ).toBeNull();
  });

  it("holds a bomb when a friend would be caught in the blast", () => {
    const behind = enemy(3000, 3120, 0);
    const friend: WeaponBody = { ...SELF, id: "f", y: 3070 };
    expect(
      decideOrdnance(
        view(["proton_bomb"], { enemies: [behind], allies: [friend] }),
      ),
    ).toBeNull();
  });
});

describe("decideOrdnance — cloak", () => {
  it("cloaks a cloak ship that an enemy has in its sights", () => {
    const hunter = enemy(3000, 2850);
    const v = view([], { enemies: [hunter] }, "confed_raven");
    expect(decideOrdnance(v)).toEqual({ kind: "cloak" });
  });

  it("never asks a ship without a cloak to cloak", () => {
    const hunter = enemy(3000, 2850);
    expect(decideOrdnance(view([], { enemies: [hunter] }))).toBeNull();
  });
});

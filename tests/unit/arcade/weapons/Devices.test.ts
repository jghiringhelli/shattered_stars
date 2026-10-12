/**
 * Devices — bombs and mines as real objects on the field: dropped astern,
 * a bomb blasts on its fuse, a mine arms after a cycle and blasts when an
 * enemy touches it; a blast hits every ship in its radius (friendly fire),
 * untouched mines fizzle.
 */

import { describe, it, expect } from "vitest";
import { dropDevice, stepDevice } from "../../../../src/arcade/weapons/Devices";
import {
  BOMB_FUSE_MS,
  DEVICE_DROP_DISTANCE_PX,
  MINE_ARM_MS,
  MINE_LIFETIME_MS,
  secondarySpecOf,
  type DeviceSpec,
} from "../../../../src/arcade/weapons/weaponSpecs";
import type { WeaponBody } from "../../../../src/arcade/weapons/weaponTypes";

const WORLD = 6000;
const BOMB = secondarySpecOf("proton_bomb") as DeviceSpec;
const MINE = secondarySpecOf("proximity_mine") as DeviceSpec;
const DROPPER = { id: "d", side: "a", x: 3000, y: 3000, angle: 0 };

function ship(id: string, side: string, x: number, y: number): WeaponBody {
  return { id, side, x, y, angle: 0, hull: 10, agilityDice: 1 };
}

describe("dropDevice", () => {
  it("drops the device astern of the ship", () => {
    const bomb = dropDevice(DROPPER, BOMB, WORLD);
    expect(bomb.x).toBeCloseTo(3000);
    expect(bomb.y).toBeCloseTo(3000 + DEVICE_DROP_DISTANCE_PX);
  });
});

describe("stepDevice — bombs", () => {
  const bomb = dropDevice(DROPPER, BOMB, WORLD);
  const near = (side: string) => ship("n" + side, side, bomb.x + 50, bomb.y);
  const far = ship("far", "b", bomb.x + 500, bomb.y);

  it("waits for its fuse", () => {
    const step = stepDevice(bomb, [near("b")], BOMB_FUSE_MS - 1, WORLD);
    expect(step.blast).toBeNull();
    expect(step.device).not.toBeNull();
  });

  it("blasts every ship in range on the fuse, friend or foe", () => {
    const step = stepDevice(
      bomb,
      [near("a"), near("b"), far],
      BOMB_FUSE_MS,
      WORLD,
    );
    expect(step.device).toBeNull();
    expect([...(step.blast?.victims ?? [])].sort()).toEqual(["na", "nb"]);
    expect(step.blast?.damage).toBe(BOMB.damage);
  });
});

describe("stepDevice — mines", () => {
  const mine = dropDevice(DROPPER, MINE, WORLD);
  const touching = (side: string) =>
    ship("t" + side, side, mine.x + 10, mine.y);

  it("cannot be set off before it arms", () => {
    const step = stepDevice(mine, [touching("b")], MINE_ARM_MS - 1, WORLD);
    expect(step.blast).toBeNull();
  });

  it("is set off by an enemy once armed", () => {
    const armed = stepDevice(mine, [], MINE_ARM_MS, WORLD).device!;
    const step = stepDevice(armed, [touching("b"), touching("a")], 16, WORLD);
    expect([...(step.blast?.victims ?? [])].sort()).toEqual(["ta", "tb"]);
  });

  it("ignores friends flying over it (IFF trigger)", () => {
    const armed = stepDevice(mine, [], MINE_ARM_MS, WORLD).device!;
    const step = stepDevice(armed, [touching("a")], 16, WORLD);
    expect(step.blast).toBeNull();
  });

  it("triggers across the map seam", () => {
    const edgeMine = dropDevice(
      { ...DROPPER, y: WORLD - 20, angle: 180 },
      MINE,
      WORLD,
    );
    const armed = stepDevice(edgeMine, [], MINE_ARM_MS, WORLD).device!;
    const across = ship("x", "b", edgeMine.x, (edgeMine.y + 20) % WORLD);
    expect(stepDevice(armed, [across], 16, WORLD).blast).not.toBeNull();
  });

  it("fizzles when nobody touches it", () => {
    const step = stepDevice(mine, [], MINE_LIFETIME_MS, WORLD);
    expect(step.device).toBeNull();
    expect(step.blast).toBeNull();
  });
});

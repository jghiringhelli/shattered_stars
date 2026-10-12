/**
 * weaponSpecs — every secondary weapon read straight from its upgrade card:
 * launchers (missiles, torpedoes) need a lock and fire from the front arc
 * at their X-Wing range band; devices (bombs, mines) drop astern; turrets
 * track all round; damage at the shared scales.
 */

import { describe, it, expect } from "vitest";
import {
  BOMB_BLAST_RADIUS_PX,
  LAUNCH_ARC_DEG,
  MINE_TRIGGER_RADIUS_PX,
  rangeBandPx,
  secondarySpecOf,
  turretSpecOf,
} from "../../../../src/arcade/weapons/weaponSpecs";
import {
  ORDNANCE_DAMAGE_SCALE,
  RANGE_1,
  RANGE_2,
  RANGE_3,
} from "../../../../src/config";

describe("rangeBandPx", () => {
  it("maps X-Wing bands onto the config ranges", () => {
    expect(rangeBandPx([2, 3])).toEqual({
      minRangePx: RANGE_1,
      maxRangePx: RANGE_3,
    });
    expect(rangeBandPx([1, 2])).toEqual({ minRangePx: 0, maxRangePx: RANGE_2 });
  });
});

describe("secondarySpecOf — launchers", () => {
  it("builds a torpedo: lock, front arc, range 2-3, x10 damage, homing", () => {
    const torpedo = secondarySpecOf("proton_torpedo");
    expect(torpedo?.kind).toBe("torpedo");
    if (torpedo?.kind !== "torpedo") return;
    expect(torpedo.damage).toBe(5 * ORDNANCE_DAMAGE_SCALE);
    expect(torpedo.envelope).toEqual({
      minRangePx: RANGE_1,
      maxRangePx: RANGE_3,
      arcDeg: LAUNCH_ARC_DEG,
    });
    expect(torpedo.homingTurnRate).toBeGreaterThan(0);
    expect(torpedo.charges).toBe(2);
  });

  it("reads a card's own range band", () => {
    const seeker = secondarySpecOf("seeker_missile");
    expect(seeker?.kind).toBe("missile");
    if (seeker?.kind !== "missile") return;
    expect(seeker.envelope.maxRangePx).toBe(RANGE_2);
  });
});

describe("secondarySpecOf — devices", () => {
  it("builds a timed bomb with an area blast", () => {
    const bomb = secondarySpecOf("proton_bomb");
    expect(bomb?.kind).toBe("bomb");
    if (bomb?.kind !== "bomb") return;
    expect(bomb.blastRadiusPx).toBe(BOMB_BLAST_RADIUS_PX);
    expect(bomb.fuseMs).toBeGreaterThan(0);
    expect(bomb.damage).toBe(5 * ORDNANCE_DAMAGE_SCALE);
  });

  it("builds a proximity mine that arms, then waits for a trigger", () => {
    const mine = secondarySpecOf("cluster_mine");
    expect(mine?.kind).toBe("mine");
    if (mine?.kind !== "mine") return;
    expect(mine.armMs).toBeGreaterThan(0);
    expect(mine.triggerRadiusPx).toBe(MINE_TRIGGER_RADIUS_PX);
    expect(mine.charges).toBe(3);
  });

  it("is null for a card that is not a secondary weapon", () => {
    expect(secondarySpecOf("heavy_laser_cannon")).toBeNull();
    expect(secondarySpecOf("light_laser_turret")).toBeNull();
    expect(secondarySpecOf("no_such_card")).toBeNull();
  });
});

describe("turretSpecOf", () => {
  it("takes the first turret card, all-round at its band", () => {
    const turret = turretSpecOf(["concussion_missile", "twin_laser_turret"]);
    expect(turret?.name).toBe("Twin Laser Turret");
    expect(turret?.envelope.arcDeg).toBe(360);
    expect(turret?.envelope.maxRangePx).toBe(RANGE_3);
    expect(turret?.damage).toBe(2);
  });

  it("is null without a turret card", () => {
    expect(turretSpecOf(["proton_torpedo"])).toBeNull();
  });
});

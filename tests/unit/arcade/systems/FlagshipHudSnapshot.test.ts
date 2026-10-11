/**
 * FlagshipHudSnapshot — specification: the squad scenes' BattleHud snapshot
 * treats the flagship as the player, wing mates as allies and AI ships as
 * enemies, marks the flagship's target, and reports the primary's cooldown.
 */

import { describe, it, expect } from "vitest";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import {
  maneuverLabel,
  primaryWeaponSlot,
  squadHudSnapshot,
  type HudShipSource,
} from "../../../../src/arcade/systems/FlagshipHudSnapshot";

const CAMERA = { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 720 };

function ship(
  id: string,
  owner: "player" | "ai",
  extra: Partial<HudShipSource> = {},
): HudShipSource {
  const pose = { x: 100, y: 200, angle: 0 };
  return {
    id,
    owner,
    definitionId: "terran_viper",
    ...pose,
    hull: 8,
    maxHull: 8,
    shields: 4,
    maxShields: 4,
    flight: createCycleFlight("terran_viper", pose),
    ...extra,
  };
}

describe("maneuverLabel", () => {
  it("abbreviates directions and appends the speed", () => {
    expect(maneuverLabel("bank_left", 3)).toBe("BANK L 3");
  });

  it("names the K-turn", () => {
    expect(maneuverLabel("kturn", 4)).toBe("K-TURN 4");
  });

  it("is null without a maneuver", () => {
    expect(maneuverLabel(null, 2)).toBeNull();
  });
});

describe("primaryWeaponSlot", () => {
  it("reports the remaining cooldown as a fraction of the interval", () => {
    expect(primaryWeaponSlot(250, 500).cooldown).toBeCloseTo(0.5);
  });

  it("clamps the fraction to 0..1", () => {
    expect(primaryWeaponSlot(900, 500).cooldown).toBe(1);
    expect(primaryWeaponSlot(-5, 500).cooldown).toBe(0);
  });
});

describe("squadHudSnapshot", () => {
  const flagship = ship("player_0", "player");
  const wingmate = ship("player_1", "player");
  const enemy = ship("enemy_1", "ai");
  const dead = ship("enemy_2", "ai", { hull: 0 });
  const input = {
    flagship,
    ships: [flagship, wingmate, enemy, dead],
    targetId: "enemy_1",
    cooldownRemainingMs: 0,
    attackIntervalMs: 500,
    camera: CAMERA,
  };

  it("the flagship is the player, with its hull and shields", () => {
    const { player } = squadHudSnapshot(input);
    expect(player).toMatchObject({ hull: 8, maxHull: 8, shields: 4 });
  });

  it("wing mates are allies and AI ships enemies; the flagship is not a contact", () => {
    const sides = Object.fromEntries(
      squadHudSnapshot(input).contacts.map((c) => [c.id, c.side]),
    );
    expect(sides).toEqual({ player_1: "ally", enemy_1: "enemy" });
  });

  it("marks only the flagship's target", () => {
    const targets = squadHudSnapshot(input)
      .contacts.filter((c) => c.isTarget)
      .map((c) => c.id);
    expect(targets).toEqual(["enemy_1"]);
  });

  it("boss hulls read as large blips", () => {
    const boss = ship("boss_1", "ai", { capitalSystems: {} });
    const [contact] = squadHudSnapshot({
      ...input,
      ships: [flagship, boss],
    }).contacts;
    expect(contact?.sizeClass).toBe("large");
  });

  it("hides player widgets and weapons once the squad is gone", () => {
    const snapshot = squadHudSnapshot({ ...input, flagship: null });
    expect(snapshot.player).toBeNull();
    expect(snapshot.weapons).toEqual([]);
  });

  it("shows one autofiring primary slot while the flagship flies", () => {
    expect(squadHudSnapshot(input).weapons.map((w) => w.kind)).toEqual([
      "primary",
    ]);
  });
});

/**
 * duelHudSnapshot — specification tests: the duel scenes' BattleHud snapshot
 * shows the living player, every other ship as ally/enemy with the player's
 * target marked, and the primary weapon's cooldown on the round tempo.
 */

import { describe, it, expect } from "vitest";
import {
  buildDuelHudSnapshot,
  duelTargetId,
  maneuverLabel,
  playerTargetId,
  type DuelHudShip,
} from "../../../../src/scenes/duel/duelHudSnapshot";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { ATTACK_INTERVAL_MS } from "../../../../src/arcade/systems/CombatTempo";

const WORLD = 4000;
const CAMERA = { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 720 };

interface TestShip extends DuelHudShip {
  readonly side: 1 | 2;
}

function ship(overrides: Partial<TestShip> & { id: string }): TestShip {
  const x = overrides.x ?? 1000;
  const y = overrides.y ?? 1000;
  return {
    definitionId: "confed_falcon",
    side: 1,
    x,
    y,
    angle: 0,
    hull: 12,
    maxHull: 12,
    shields: 8,
    maxShields: 8,
    flight: createCycleFlight("confed_falcon", { x, y, angle: 0 }),
    weaponCooldown: 0,
    combatStats: { weaponRange: 250, firingArc: 75, weaponCooldown: 400 },
    ...overrides,
  };
}

function snapshot(ships: TestShip[], playerId = "p") {
  return buildDuelHudSnapshot({
    ships,
    playerId,
    isAlly: (s) => s.side === 1,
    camera: CAMERA,
    worldSize: WORLD,
  });
}

describe("buildDuelHudSnapshot", () => {
  it("reports the player's durability and stress", () => {
    const hud = snapshot([ship({ id: "p", hull: 5, shields: 3 })]);
    expect(hud.player).toMatchObject({
      hull: 5,
      maxHull: 12,
      shields: 3,
      maxShields: 8,
      stress: 0,
      isStressed: false,
    });
  });

  it("hides the player once destroyed", () => {
    const hud = snapshot([ship({ id: "p", hull: 0 })]);
    expect(hud.player).toBeNull();
    expect(hud.weapons).toEqual([]);
  });

  it("lists every other ship as an ally or enemy contact", () => {
    const hud = snapshot([
      ship({ id: "p" }),
      ship({ id: "wing", side: 1 }),
      ship({ id: "foe", side: 2, y: 1500 }),
    ]);
    expect(hud.contacts.map((c) => [c.id, c.side])).toEqual([
      ["wing", "ally"],
      ["foe", "enemy"],
    ]);
  });

  it("marks exactly the player's target", () => {
    const hud = snapshot([
      ship({ id: "p" }),
      ship({ id: "near", side: 2, y: 1100 }),
      ship({ id: "far", side: 2, y: 3000 }),
    ]);
    expect(hud.contacts.filter((c) => c.isTarget).map((c) => c.id)).toEqual([
      "near",
    ]);
  });

  it("keeps destroyed contacts flagged dead", () => {
    const hud = snapshot([
      ship({ id: "p" }),
      ship({ id: "foe", side: 2, hull: 0 }),
    ]);
    expect(hud.contacts[0]!.alive).toBe(false);
    expect(hud.contacts[0]!.isTarget).toBe(false);
  });

  it("shows the primary cooldown as a fraction of one attack interval", () => {
    const hud = snapshot([
      ship({ id: "p", weaponCooldown: ATTACK_INTERVAL_MS / 4 }),
    ]);
    expect(hud.weapons).toEqual([
      { id: "primary", kind: "primary", cooldown: 0.25, selected: true },
    ]);
  });

  it("passes the camera view through", () => {
    expect(snapshot([ship({ id: "p" })]).camera).toBe(CAMERA);
  });

  it("flags exactly the contact the player's side marked", () => {
    const hud = buildDuelHudSnapshot({
      ships: [
        ship({ id: "p" }),
        ship({ id: "near", side: 2, y: 1100 }),
        ship({ id: "far", side: 2, y: 3000 }),
      ],
      playerId: "p",
      isAlly: (s) => s.side === 1,
      camera: CAMERA,
      worldSize: WORLD,
      markedId: "far",
    });
    expect(hud.contacts.filter((c) => c.isMarked).map((c) => c.id)).toEqual([
      "far",
    ]);
  });

  it("flags no contact as marked without a mark", () => {
    const hud = snapshot([ship({ id: "p" }), ship({ id: "foe", side: 2 })]);
    expect(hud.contacts.some((c) => c.isMarked)).toBe(false);
  });
});

describe("playerTargetId", () => {
  const input = (ships: TestShip[]) => ({
    ships,
    playerId: "p",
    isAlly: (s: TestShip) => s.side === 1,
    worldSize: WORLD,
  });

  it("is the HUD's locked target (what R marks)", () => {
    const ships = [
      ship({ id: "p" }),
      ship({ id: "near", side: 2, y: 1100 }),
      ship({ id: "far", side: 2, y: 3000 }),
    ];
    const locked = snapshot(ships).contacts.find((c) => c.isTarget)!.id;
    expect(playerTargetId(input(ships))).toBe(locked);
  });

  it("never picks an ally or a destroyed enemy", () => {
    const ships = [
      ship({ id: "p" }),
      ship({ id: "wing", side: 1, y: 1050 }),
      ship({ id: "wreck", side: 2, y: 1100, hull: 0 }),
      ship({ id: "foe", side: 2, y: 2000 }),
    ];
    expect(playerTargetId(input(ships))).toBe("foe");
  });

  it("is null once the player is destroyed", () => {
    const ships = [ship({ id: "p", hull: 0 }), ship({ id: "foe", side: 2 })];
    expect(playerTargetId(input(ships))).toBeNull();
  });
});

describe("duelTargetId", () => {
  const player = ship({ id: "p", x: 1000, y: 1000 });

  it("prefers the enemy in the gun's sights over a nearer one off-arc", () => {
    const beside = { id: "beside", x: 1080, y: 1000 };
    const ahead = { id: "ahead", x: 1000, y: 800 };
    expect(duelTargetId(player, [beside, ahead], WORLD)).toBe("ahead");
  });

  it("falls back to the nearest enemy across the torus seam", () => {
    const edge = ship({ id: "p2", x: 10, y: 1000, angle: 180 });
    const acrossSeam = { id: "seam", x: WORLD - 20, y: 1000 };
    const inside = { id: "inside", x: 400, y: 1000 };
    expect(duelTargetId(edge, [inside, acrossSeam], WORLD)).toBe("seam");
  });

  it("is null without enemies", () => {
    expect(duelTargetId(player, [], WORLD)).toBeNull();
  });
});

describe("maneuverLabel", () => {
  it("abbreviates the side of a bank", () => {
    expect(maneuverLabel("bank_left", 3)).toBe("BANK L 3");
  });

  it("reads straight when no maneuver is flying", () => {
    expect(maneuverLabel(null, 2)).toBe("STRAIGHT 2");
  });

  it("spells out the K-turn", () => {
    expect(maneuverLabel("kturn", 4)).toBe("K-TURN 4");
  });

  it("names Segnor's loops and drifts", () => {
    expect(maneuverLabel("segnor_right", 2)).toBe("SEGNOR R 2");
    expect(maneuverLabel("drift_left", 3)).toBe("DRIFT L 3");
  });
});

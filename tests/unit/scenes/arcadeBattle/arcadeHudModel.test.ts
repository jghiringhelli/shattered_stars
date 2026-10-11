/**
 * Skirmish HUD model — specification tests: the player readout, radar
 * contacts, the marked target and the weapon bar built from scene state.
 */

import { describe, it, expect } from "vitest";
import {
  BOMB_HINT,
  buildBattleHudSnapshot,
  cooldownFraction,
  maneuverHudLabel,
  NEXT_WEAPON_HINT,
  nextWeaponSlot,
  selectHudTargetId,
  toContacts,
  toPlayerHudState,
  toWeaponSlots,
  TURRET_HINT,
} from "../../../../src/scenes/arcadeBattle/arcadeHudModel";
import { HudShipBuilder, ordnanceSlot, turretSlot } from "./hudShipBuilder";

const WORLD = 6000;
const CAMERA = {
  centerX: 1000,
  centerY: 1000,
  zoom: 1,
  width: 1280,
  height: 720,
};
const sizeOf = (): "small" => "small";

describe("maneuverHudLabel", () => {
  it("shows the maneuver in progress with the speed", () => {
    const ship = HudShipBuilder.aPlayer()
      .withControl({
        currentManeuver: "bank_right",
        nextManeuver: null,
        speed: 3,
      })
      .build();
    expect(maneuverHudLabel(ship.control)).toBe("BANK R 3");
  });

  it("prefers the queued maneuver, marked as queued", () => {
    const ship = HudShipBuilder.aPlayer()
      .withControl({
        currentManeuver: "straight",
        nextManeuver: "turn_left",
        speed: 2,
      })
      .build();
    expect(maneuverHudLabel(ship.control)).toBe("▸ TURN L 2");
  });

  it("names K-turns without a direction", () => {
    const ship = HudShipBuilder.aPlayer()
      .withControl({ currentManeuver: "kturn", nextManeuver: null, speed: 4 })
      .build();
    expect(maneuverHudLabel(ship.control)).toBe("K-TURN 4");
  });
});

describe("toPlayerHudState", () => {
  it("carries durability, stress and speed through", () => {
    const ship = HudShipBuilder.aPlayer()
      .withHull(10, 24)
      .withShields(3, 12)
      .stressed(0.8)
      .build();
    const state = toPlayerHudState(ship);
    expect(state).toMatchObject({
      hull: 10,
      maxHull: 24,
      shields: 3,
      maxShields: 12,
      stress: 0.8,
      isStressed: true,
      speed: ship.control.speed,
      maxSpeed: ship.control.maxSpeed,
    });
  });

  it("never reports negative hull", () => {
    const ship = HudShipBuilder.aPlayer().withHull(-3).build();
    expect(toPlayerHudState(ship).hull).toBe(0);
  });
});

describe("toContacts", () => {
  const view = (targetId: string | null = null) => ({
    playerId: "player_0",
    playerFaction: "free_confederation",
    targetId,
    sizeOf,
  });

  it("excludes the player's own ship", () => {
    const contacts = toContacts([HudShipBuilder.aPlayer().build()], view());
    expect(contacts).toEqual([]);
  });

  it("labels allies and enemies by faction", () => {
    const ally = HudShipBuilder.aPlayer("ally_0").build();
    const enemy = HudShipBuilder.anEnemy().build();
    const sides = toContacts([ally, enemy], view()).map((c) => c.side);
    expect(sides).toEqual(["ally", "enemy"]);
  });

  it("drops destroyed ships", () => {
    const wreck = HudShipBuilder.anEnemy().withHull(0).build();
    expect(toContacts([wreck], view())).toEqual([]);
  });

  it("hides cloaked enemies but keeps cloaked allies", () => {
    const ally = HudShipBuilder.aPlayer("ally_0").cloaked().build();
    const enemy = HudShipBuilder.anEnemy().cloaked().build();
    expect(toContacts([ally, enemy], view()).map((c) => c.id)).toEqual([
      "ally_0",
    ]);
  });

  it("marks only the target", () => {
    const a = HudShipBuilder.anEnemy("enemy_0").build();
    const b = HudShipBuilder.anEnemy("enemy_1").build();
    const marks = toContacts([a, b], view("enemy_1")).map((c) => c.isTarget);
    expect(marks).toEqual([false, true]);
  });

  it("flags the squad's marked enemy as marked", () => {
    const a = HudShipBuilder.anEnemy("enemy_0").build();
    const b = HudShipBuilder.anEnemy("enemy_1").build();
    const contacts = toContacts([a, b], { ...view(), markedId: "enemy_0" });
    expect(contacts.map((c) => c.isMarked)).toEqual([true, false]);
  });

  it("marks nothing when the side has no mark", () => {
    const enemy = HudShipBuilder.anEnemy().build();
    expect(toContacts([enemy], view())[0]!.isMarked).toBe(false);
  });

  it("never flags an ally as marked", () => {
    const ally = HudShipBuilder.aPlayer("ally_0").build();
    const contacts = toContacts([ally], { ...view(), markedId: "ally_0" });
    expect(contacts[0]!.isMarked).toBe(false);
  });
});

describe("selectHudTargetId", () => {
  it("picks the nearest enemy inside the forward arc", () => {
    const player = HudShipBuilder.aPlayer().at(1000, 1000, 0).build();
    const far = HudShipBuilder.anEnemy("far").at(1000, 400).build();
    const near = HudShipBuilder.anEnemy("near").at(1050, 800).build();
    expect(selectHudTargetId(player, [player, far, near], WORLD)).toBe("near");
  });

  it("ignores a closer enemy behind the player", () => {
    const player = HudShipBuilder.aPlayer().at(1000, 1000, 0).build();
    const behind = HudShipBuilder.anEnemy("behind").at(1000, 1100).build();
    const ahead = HudShipBuilder.anEnemy("ahead").at(1000, 500).build();
    expect(selectHudTargetId(player, [behind, ahead], WORLD)).toBe("ahead");
  });

  it("ignores cloaked enemies and allies", () => {
    const player = HudShipBuilder.aPlayer().at(1000, 1000, 0).build();
    const ally = HudShipBuilder.aPlayer("ally_0").at(1000, 900).build();
    const ghost = HudShipBuilder.anEnemy().at(1000, 800).cloaked().build();
    expect(selectHudTargetId(player, [ally, ghost], WORLD)).toBeNull();
  });
});

describe("toWeaponSlots", () => {
  it("lists the primary laser alone for a bare ship", () => {
    const slots = toWeaponSlots(HudShipBuilder.aPlayer().build(), -1);
    expect(slots.map((s) => [s.id, s.kind, s.selected])).toEqual([
      ["primary", "primary", true],
    ]);
  });

  it("shows the laser as cooling for the rest of the cycle once fired", () => {
    const ship = HudShipBuilder.aPlayer()
      .withControl({ firedLaserThisCycle: true, maneuverProgress: 0.25 })
      .build();
    expect(toWeaponSlots(ship, -1)[0]!.cooldown).toBeCloseTo(0.75);
  });

  it("lists ordnance with charges, cooldown and selection, then the turret", () => {
    const ship = HudShipBuilder.aPlayer()
      .withOrdnance(
        ordnanceSlot({
          charges: 1,
          maxCharges: 2,
          cooldownRemaining: 1000,
          cooldownMax: 4000,
        }),
        ordnanceSlot({ slotIndex: 1, ordnanceClass: "bomb", isHoming: false }),
      )
      .withTurret(turretSlot())
      .build();
    const slots = toWeaponSlots(ship, 0);
    expect(slots.map((s) => s.kind)).toEqual([
      "primary",
      "missile",
      "bomb",
      "turret",
    ]);
    expect(slots[1]).toMatchObject({
      charges: 1,
      maxCharges: 2,
      cooldown: 0.25,
      selected: true,
    });
    expect(slots[0]!.selected).toBe(false);
  });

  it("hints Tab on the slot that weapon cycling selects next", () => {
    const ship = HudShipBuilder.aPlayer()
      .withOrdnance(
        ordnanceSlot(),
        ordnanceSlot({ slotIndex: 1, ordnanceClass: "torpedo" }),
      )
      .build();
    expect(toWeaponSlots(ship, -1).map((s) => s.keyHint)).toEqual([
      undefined,
      NEXT_WEAPON_HINT,
      undefined,
    ]);
    expect(toWeaponSlots(ship, 1)[0]!.keyHint).toBe(NEXT_WEAPON_HINT);
  });

  it("hints Shift+Space on bombs and G on the turret", () => {
    const ship = HudShipBuilder.aPlayer()
      .withOrdnance(ordnanceSlot({ ordnanceClass: "bomb", isHoming: false }))
      .withTurret(turretSlot())
      .build();
    const hints = toWeaponSlots(ship, -1).map((s) => s.keyHint);
    expect(hints).toEqual([undefined, BOMB_HINT, TURRET_HINT]);
  });
});

describe("nextWeaponSlot", () => {
  it("cycles laser → each ordnance slot → laser", () => {
    expect(nextWeaponSlot(-1, 2)).toBe(0);
    expect(nextWeaponSlot(0, 2)).toBe(1);
    expect(nextWeaponSlot(1, 2)).toBe(-1);
  });

  it("has nowhere to go without ordnance", () => {
    expect(nextWeaponSlot(-1, 0)).toBeNull();
  });
});

describe("cooldownFraction", () => {
  it("is the remaining share, clamped to [0, 1]", () => {
    expect(cooldownFraction(500, 2000)).toBe(0.25);
    expect(cooldownFraction(-5, 2000)).toBe(0);
    expect(cooldownFraction(5000, 2000)).toBe(1);
  });

  it("is 0 for an instant weapon", () => {
    expect(cooldownFraction(100, 0)).toBe(0);
  });
});

describe("buildBattleHudSnapshot", () => {
  const input = (player: ReturnType<HudShipBuilder["build"]> | null) => ({
    player,
    ships: player
      ? [player, HudShipBuilder.anEnemy().at(1000, 700).build()]
      : [],
    playerFaction: "free_confederation",
    selectedWeaponSlot: -1,
    camera: CAMERA,
    worldSize: WORLD,
    sizeOf,
  });

  it("marks the enemy ahead as the target", () => {
    const player = HudShipBuilder.aPlayer().at(1000, 1000, 0).build();
    const { snapshot, targetId } = buildBattleHudSnapshot(input(player));
    expect(targetId).toBe("enemy_0");
    expect(snapshot.contacts[0]!.isTarget).toBe(true);
    expect(snapshot.weapons).toHaveLength(1);
  });

  it("hides player-centric widgets once the player is destroyed", () => {
    const wreck = HudShipBuilder.aPlayer().withHull(0).build();
    const { snapshot, targetId } = buildBattleHudSnapshot(input(wreck));
    expect(snapshot.player).toBeNull();
    expect(snapshot.weapons).toEqual([]);
    expect(targetId).toBeNull();
    expect(snapshot.contacts.map((c) => c.id)).toEqual(["enemy_0"]);
  });

  it("shows the side's marked target on its contact", () => {
    const player = HudShipBuilder.aPlayer().at(1000, 1000, 0).build();
    const { snapshot } = buildBattleHudSnapshot({
      ...input(player),
      markedId: "enemy_0",
    });
    expect(snapshot.contacts[0]!.isMarked).toBe(true);
  });
});

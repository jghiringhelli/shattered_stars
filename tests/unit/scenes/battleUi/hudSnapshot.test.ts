/**
 * hudSnapshot — specification tests for turning battle ships into the
 * holographic HUD's snapshot data.
 */

import { describe, it, expect } from "vitest";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import {
  contactHudState,
  maneuverLabel,
  markContacts,
  matchClockColor,
  MATCH_CLOCK_DANGER_MS,
  MATCH_CLOCK_WARNING_MS,
  ownerContacts,
  playerHudState,
  primaryWeaponSlot,
  shipSizeClass,
  type HudShipSource,
  type OwnedShipSource,
} from "../../../../src/scenes/battleUi/hudSnapshot";
import { HOLO_PALETTE } from "../../../../src/ui/theme/HoloTheme";

function ship(overrides: Partial<HudShipSource> = {}): HudShipSource {
  return {
    id: "s1",
    definitionId: "terran_viper",
    x: 100,
    y: 200,
    angle: 45,
    hull: 8,
    maxHull: 12,
    shields: 4,
    maxShields: 8,
    flight: createCycleFlight("terran_viper", { x: 100, y: 200, angle: 45 }),
    ...overrides,
  };
}

function owned(id: string, owner: "player" | "ai", hull = 4): OwnedShipSource {
  return {
    id,
    owner,
    definitionId: "terran_viper",
    x: 0,
    y: 0,
    angle: 0,
    hull,
  };
}

describe("maneuverLabel", () => {
  it("abbreviates the direction and appends the speed", () => {
    expect(maneuverLabel("bank_right", 3)).toBe("BANK R 3");
    expect(maneuverLabel("kturn", 4)).toBe("SNAP 4");
  });

  it("is null without a maneuver", () => {
    expect(maneuverLabel(null, 2)).toBeNull();
  });
});

describe("playerHudState", () => {
  it("carries pose, hull, shields and the flight's stress", () => {
    const state = playerHudState(ship());
    expect(state.pose).toEqual({ x: 100, y: 200, angle: 45 });
    expect([
      state.hull,
      state.maxHull,
      state.shields,
      state.maxShields,
    ]).toEqual([8, 12, 4, 8]);
    expect(state.stress).toBe(0);
    expect(state.isStressed).toBe(false);
  });

  it("shows the maneuver in flight at the engine speed", () => {
    const source = ship();
    const { control } = source.flight.motion;
    const state = playerHudState(source);
    expect(state.speed).toBe(control.speed);
    expect(state.maxSpeed).toBe(control.maxSpeed);
    expect(state.maneuver).toBe(
      maneuverLabel(control.currentManeuver, control.speed),
    );
  });

  it("shows a standing order instead when one is given", () => {
    const state = playerHudState(ship(), { direction: "turn_left", speed: 2 });
    expect(state.maneuver).toBe("TURN L 2");
    expect(state.speed).toBe(2);
  });
});

describe("contacts", () => {
  it("marks a dead ship as not alive", () => {
    expect(
      contactHudState(owned("a", "ai", 0), "enemy", "small", false).alive,
    ).toBe(false);
  });

  it("lists every living ship but the focus: player ships as allies, AI as enemies", () => {
    const contacts = ownerContacts(
      "me",
      [
        owned("me", "player"),
        owned("wing", "player"),
        owned("foe", "ai"),
        owned("dead", "ai", 0),
      ],
      "foe",
    );
    expect(contacts.map((c) => [c.id, c.side, c.isTarget])).toEqual([
      ["wing", "ally", false],
      ["foe", "enemy", true],
    ]);
  });

  it("sizes blips by the ship definition, falling back to small", () => {
    expect(shipSizeClass("not_a_ship")).toBe("small");
    expect(
      contactHudState(
        owned("a", "ai"),
        "enemy",
        shipSizeClass("terran_viper"),
        false,
      ).sizeClass,
    ).toBe(shipSizeClass("terran_viper"));
  });
});

describe("primaryWeaponSlot", () => {
  it("reports the cooldown as a fraction of the attack interval", () => {
    expect(primaryWeaponSlot(250, 500).cooldown).toBe(0.5);
  });

  it("clamps to 0..1 and treats a disabled (infinite) cooldown as ready", () => {
    expect(primaryWeaponSlot(900, 500).cooldown).toBe(1);
    expect(primaryWeaponSlot(-5, 500).cooldown).toBe(0);
    expect(primaryWeaponSlot(Number.POSITIVE_INFINITY, 500).cooldown).toBe(0);
  });

  it("is the selected primary weapon", () => {
    const slot = primaryWeaponSlot(0, 500);
    expect([slot.kind, slot.selected]).toEqual(["primary", true]);
  });
});

describe("matchClockColor", () => {
  it("is plain text with time to spare, warning under a minute, danger under 30 s", () => {
    expect(matchClockColor(MATCH_CLOCK_WARNING_MS + 1)).toBe(
      HOLO_PALETTE.textPrimary,
    );
    expect(matchClockColor(MATCH_CLOCK_WARNING_MS)).toBe(HOLO_PALETTE.warning);
    expect(matchClockColor(MATCH_CLOCK_DANGER_MS)).toBe(HOLO_PALETTE.danger);
  });
});

describe("markContacts", () => {
  const contacts = ownerContacts(
    null,
    [owned("a1", "ai"), owned("a2", "ai")],
    null,
  );

  it("flags the marked contact only", () => {
    const marked = markContacts(contacts, "a2");
    expect(marked.find((c) => c.id === "a2")?.isMarked).toBe(true);
    expect(marked.find((c) => c.id === "a1")?.isMarked).toBeUndefined();
  });

  it("flags nothing without a mark", () => {
    expect(markContacts(contacts, null).some((c) => c.isMarked)).toBe(false);
  });
});

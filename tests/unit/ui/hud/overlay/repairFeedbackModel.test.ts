import { describe, it, expect } from "vitest";
import { SHIP_SIZES } from "../../../../../src/config";
import { NEUTRAL_MODIFIERS } from "../../../../../src/core/CombatModifiers";
import {
  ORBIT_RADIUS_FACTOR,
  droneOrbitRadius,
  selfRepairKey,
  selfRepairSourcesOf,
  type RepairFeedbackShip,
} from "../../../../../src/ui/hud/overlay/repairFeedbackModel";
import { OVERLAY_GEOMETRY } from "../../../../../src/ui/hud/overlay/overlayLayout";
import {
  fractionOf,
  overlayGeometryFor,
} from "../../../../../src/ui/hud/overlay/overlayState";

/**
 * A ship fixture.
 * @param over - Field overrides.
 * @returns The ship.
 */
function ship(over: Partial<RepairFeedbackShip> = {}): RepairFeedbackShip {
  return {
    id: "a",
    x: 0,
    y: 0,
    definitionId: "confed_falcon",
    hull: 10,
    shields: 10,
    maxHull: 20,
    maxShields: 20,
    modifiers: NEUTRAL_MODIFIERS,
    ...over,
  };
}

describe("selfRepairSourcesOf", () => {
  it("credits the fitted cards from an explicit upgrade list", () => {
    const sources = selfRepairSourcesOf(
      ship({ upgradeIds: ["mechanic", "repair_astromech"] }),
    );
    expect(sources.hull).toEqual({ kind: "mechanic_crew", sourceShipId: null });
    expect(sources.shield).toEqual({ kind: "astromech", sourceShipId: null });
  });

  it("reads the cards from the ship's quick build", () => {
    const sources = selfRepairSourcesOf(ship({ loadoutId: "falcon_patcher" }));
    expect(sources.hull.kind).toBe("astromech");
  });

  it("keys the cache by upgrade list, then loadout id", () => {
    const upgrades = ["mechanic"];
    expect(selfRepairKey(ship({ upgradeIds: upgrades }))).toBe(upgrades);
    expect(selfRepairKey(ship({ loadoutId: "x" }))).toBe("x");
    expect(selfRepairKey(ship())).toBe("");
  });
});

describe("droneOrbitRadius", () => {
  it("orbits just outside the ship's sprite size", () => {
    expect(droneOrbitRadius(undefined)).toBe(
      SHIP_SIZES.small * ORBIT_RADIUS_FACTOR,
    );
  });

  it("orbits bigger ships wider", () => {
    expect(droneOrbitRadius("confed_phoenix")).toBeGreaterThanOrEqual(
      droneOrbitRadius("confed_sparrow"),
    );
  });
});

describe("overlayGeometryFor", () => {
  it("uses the size class geometry by default", () => {
    expect(overlayGeometryFor({ size: "large" })).toEqual(
      OVERLAY_GEOMETRY.large,
    );
  });

  it("applies explicit width and hull height overrides", () => {
    const geometry = overlayGeometryFor({
      size: "small",
      width: 99,
      height: 9,
    });
    expect(geometry.width).toBe(99);
    expect(geometry.hullHeight).toBe(9);
  });

  it("falls back to the small geometry for unknown ships", () => {
    expect(overlayGeometryFor({ definitionId: "no_such_ship" })).toEqual(
      OVERLAY_GEOMETRY.small,
    );
  });
});

describe("fractionOf", () => {
  it("clamps to 0–1 and handles a zero cap", () => {
    expect(fractionOf(5, 10)).toBe(0.5);
    expect(fractionOf(15, 10)).toBe(1);
    expect(fractionOf(-1, 10)).toBe(0);
    expect(fractionOf(3, 0)).toBe(0);
  });
});

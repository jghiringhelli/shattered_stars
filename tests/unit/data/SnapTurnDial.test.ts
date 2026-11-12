/**
 * Snap Turn distance — every dial prints its Snap Turn at the highest speed
 * its ship can fly (4 where the hull flies 4; interceptors print 2 and 4;
 * slow hulls keep what they print) and the speed-cap rule flies it there.
 */

import { describe, it, expect } from "vitest";
import {
  SHIP_DEFINITIONS,
  getShipDial,
} from "../../../src/data/ShipDefinitions";
import { dialSpeedTable, flownSpeed } from "../../../src/core/speedCap";
import { templateLength } from "../../../src/simulation/flight/XWingFlightOracle";

const SNAP_SPEED = 4;
const WHITE_SNAP_HULLS = [
  "terran_harbinger",
  "synth_hunter",
  "synth_stalker",
  "synth_ravager",
  "corsair_torpedo_boat",
  "ascendant_avatar",
];

const snapRows = (id: string) =>
  getShipDial(id).filter((m) => m.direction === "kturn");

describe("Snap Turn dial entries", () => {
  const withSnap = Object.keys(SHIP_DEFINITIONS).filter(
    (id) => snapRows(id).length > 0,
  );

  it("prints a Snap Turn on a fair share of hulls", () => {
    expect(withSnap.length).toBeGreaterThan(60);
  });

  it("sits at speed 4 on every dial whose ship can fly speed 4", () => {
    for (const id of withSnap) {
      const top = SHIP_DEFINITIONS[id]!.baseStats.speed.max;
      if (top < SNAP_SPEED) continue;
      expect(Math.max(...snapRows(id).map((m) => m.speed)), id).toBe(
        SNAP_SPEED,
      );
    }
  });

  it("keeps slow hulls at a speed they can fly", () => {
    for (const id of withSnap) {
      const top = SHIP_DEFINITIONS[id]!.baseStats.speed.max;
      if (top >= SNAP_SPEED) continue;
      for (const row of snapRows(id))
        expect(row.speed, id).toBeLessThanOrEqual(top);
    }
  });

  it("lets the interceptors that print 2 and 4 keep both", () => {
    for (const id of ["terran_viper", "terran_raptor", "ascendant_virtue"])
      expect(
        snapRows(id)
          .map((m) => m.speed)
          .sort(),
        id,
      ).toEqual([2, 4]);
  });

  it("keeps the Snap Turn red, white only on the signature hulls", () => {
    for (const id of withSnap) {
      const colors = new Set(snapRows(id).map((m) => m.difficulty));
      expect(colors.has("white"), id).toBe(WHITE_SNAP_HULLS.includes(id));
    }
  });
});

describe("Snap Turn flown speed", () => {
  const table = dialSpeedTable(getShipDial("terran_gladius"));

  it("flies the printed speed whatever the set speed (nearest printed when below)", () => {
    for (const set of [1, 2, 3, 4])
      expect(flownSpeed(table, "kturn", set), `set ${set}`).toBe(SNAP_SPEED);
  });

  it("covers a speed-4 template: 192 px on a small ship", () => {
    expect(templateLength(SNAP_SPEED, 32)).toBe(192);
  });

  it("flies the interceptor's slow Snap at set speed 2 and its fast one at 4", () => {
    const viper = dialSpeedTable(getShipDial("terran_viper"));
    expect(flownSpeed(viper, "kturn", 2)).toBe(2);
    expect(flownSpeed(viper, "kturn", 3)).toBe(2);
    expect(flownSpeed(viper, "kturn", 4)).toBe(4);
  });

  it("never lifts a hovering ship (speed 0)", () => {
    expect(flownSpeed(table, "kturn", 0)).toBe(0);
  });
});

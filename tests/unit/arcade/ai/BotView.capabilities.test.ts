/**
 * BotView — a bot's own-ship view offers only what its card and stress
 * allow (FlightCapabilities), so bots never plan a maneuver the controls
 * would refuse: the same rules as the human pilot.
 */

import { describe, it, expect } from "vitest";
import { ownShipView } from "../../../../src/arcade/ai/BotView";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";

function view(definitionId: string, stressed = false) {
  const flight = createCycleFlight(definitionId, {
    x: 3000,
    y: 3000,
    angle: 0,
  });
  return ownShipView({
    self: {
      id: "s",
      side: "a",
      definitionId,
      x: 3000,
      y: 3000,
      angle: 0,
      alive: true,
      hull: 10,
      maxHull: 10,
      shields: 0,
      maxShields: 0,
      firingArcDeg: 75,
      weaponRange: 250,
    },
    flight: {
      ...flight,
      stress: stressed ? { level: 0.95, isStressed: true } : INITIAL_STRESS,
    },
    dial: getShipDial(definitionId),
    maneuverable: true,
  });
}

describe("ownShipView — card and stress", () => {
  it("offers only the specials on the ship's dial", () => {
    expect([...view("terran_viper").availableSpecials].sort()).toEqual([
      "kturn",
      "tallon_left",
      "tallon_right",
    ]);
    expect(view("terran_viper").kturnReady).toBe(true);
  });

  it("offers white specials but no red ones while stressed", () => {
    expect(view("terran_viper", true).availableSpecials).toEqual([]);
    expect(view("terran_viper", true).kturnReady).toBe(false);
    expect([...view("synth_hunter", true).availableSpecials].sort()).toEqual([
      "kturn",
      "segnor_left",
      "segnor_right",
    ]);
  });

  it("offers dashes only from the action bar, never while stressed", () => {
    expect(view("terran_viper").boostReady).toBe(true);
    expect(view("terran_gladius").boostReady).toBe(false);
    expect(view("terran_viper", true).boostReady).toBe(false);
    expect(view("terran_viper", true).barrelRollReady).toBe(false);
  });
});

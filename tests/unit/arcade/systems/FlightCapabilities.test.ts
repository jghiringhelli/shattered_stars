/**
 * FlightCapabilities — what a ship may fly beyond its dial's basic moves:
 * the specials on its dial (Snap turn, Hook, Knife) and the dashes on its
 * action bar (boost, barrel roll), and the X-Wing rule that a stressed
 * pilot performs no red maneuver and no action.
 */

import { describe, it, expect } from "vitest";
import {
  UNRESTRICTED_CAPABILITIES,
  dashRefusal,
  flightCapabilitiesOf,
  specialRefusal,
} from "../../../../src/arcade/systems/FlightCapabilities";

describe("flightCapabilitiesOf", () => {
  it("reads boost and barrel roll from the action bar", () => {
    const viper = flightCapabilitiesOf("terran_viper");
    expect(viper.boost).toBe(true);
    expect(viper.barrelRoll).toBe(true);
    const gladius = flightCapabilitiesOf("terran_gladius");
    expect(gladius.boost).toBe(false);
    expect(gladius.barrelRoll).toBe(true);
  });

  it("reads each special and its easiest difficulty from the dial", () => {
    const viper = flightCapabilitiesOf("terran_viper");
    expect(viper.specials.kturn).toBe("red");
    expect(viper.specials.tallon_left).toBeUndefined();
    expect(viper.specials.segnor_left).toBeUndefined();
    expect(flightCapabilitiesOf("corsair_talon").specials.tallon_left).toBe(
      "red",
    );
    const hunter = flightCapabilitiesOf("synth_hunter");
    expect(hunter.specials.segnor_right).toBe("white");
  });

  it("gives a huge ship no specials and no dashes", () => {
    const imperator = flightCapabilitiesOf("terran_imperator");
    expect(imperator.boost).toBe(false);
    expect(imperator.barrelRoll).toBe(false);
    expect(Object.keys(imperator.specials)).toHaveLength(0);
  });

  it("treats an unknown ship as unrestricted", () => {
    expect(flightCapabilitiesOf("no_such_ship")).toEqual(
      UNRESTRICTED_CAPABILITIES,
    );
  });
});

describe("specialRefusal", () => {
  const viper = flightCapabilitiesOf("terran_viper");
  const talon = flightCapabilitiesOf("corsair_talon");
  const hunter = flightCapabilitiesOf("synth_hunter");

  it("allows a special on the dial while calm", () => {
    expect(specialRefusal(viper, "kturn", false)).toBeNull();
  });

  it("refuses a red special while stressed", () => {
    expect(specialRefusal(viper, "kturn", true)).toBe("stressed");
    expect(specialRefusal(talon, "tallon_right", true)).toBe("stressed");
  });

  it("allows a white special while stressed", () => {
    expect(specialRefusal(hunter, "segnor_left", true)).toBeNull();
  });

  it("refuses a special that is not on the dial", () => {
    expect(specialRefusal(viper, "segnor_left", false)).toBe("not_on_dial");
  });
});

describe("dashRefusal", () => {
  const viper = flightCapabilitiesOf("terran_viper");
  const gladius = flightCapabilitiesOf("terran_gladius");

  it("allows an action on the bar while calm", () => {
    expect(dashRefusal(viper, "boost", false)).toBeNull();
    expect(dashRefusal(viper, "barrel_roll", false)).toBeNull();
  });

  it("refuses every action while stressed", () => {
    expect(dashRefusal(viper, "boost", true)).toBe("stressed");
    expect(dashRefusal(viper, "barrel_roll", true)).toBe("stressed");
  });

  it("refuses an action that is not on the bar", () => {
    expect(dashRefusal(gladius, "boost", false)).toBe("no_action");
  });
});

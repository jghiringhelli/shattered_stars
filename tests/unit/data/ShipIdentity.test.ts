/**
 * Spec (docs/specs/flight-controls.md › Ship identity): by default a ship
 * flies AT MOST ONE of {barrel roll, Hook Loop, Knife Roll} — its signature
 * trick. Boost and Snap Turn are never affected. "Full card" lifts the rule.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  SHIP_DEFINITIONS,
  getShipDial,
} from "../../../src/data/ShipDefinitions";
import {
  effectiveActions,
  effectiveDial,
  shipSpecialLabels,
  signatureTrickOf,
} from "../../../src/data/shipSpecials";
import {
  activeTrickRule,
  flightCapabilitiesOf,
  lockTrickRuleToIdentity,
} from "../../../src/arcade/systems/FlightCapabilities";
import type { FlightCapabilities } from "../../../src/core/flightCapabilityTypes";

const FLYERS = Object.values(SHIP_DEFINITIONS).filter(
  (d) => d.baseStats.size !== "huge",
);

/** How many of roll / hook / knife a capability set lets the ship fly. */
function trickCount(caps: FlightCapabilities): number {
  const hook = caps.specials.segnor_left || caps.specials.segnor_right;
  const knife = caps.specials.tallon_left || caps.specials.tallon_right;
  return Number(caps.barrelRoll) + Number(!!hook) + Number(!!knife);
}

afterEach(() => lockTrickRuleToIdentity(false));

describe("ship identity rule — at most one signature trick", () => {
  it.each(FLYERS.map((d) => d.id))("%s flies at most one trick", (id) => {
    expect(trickCount(flightCapabilitiesOf(id, "identity"))).toBeLessThanOrEqual(
      1,
    );
  });

  it.each(FLYERS.map((d) => d.id))(
    "%s keeps boost and Snap Turn exactly as its card prints them",
    (id) => {
      const full = flightCapabilitiesOf(id, "full");
      const identity = flightCapabilitiesOf(id, "identity");
      expect(identity.boost).toBe(full.boost);
      expect(identity.specials.kturn).toBe(full.specials.kturn);
    },
  );

  it("the full-card rule returns everything the card prints", () => {
    const viper = flightCapabilitiesOf("terran_viper", "full");
    expect(viper.barrelRoll).toBe(true);
    expect(viper.specials.tallon_left).toBe("red");
  });

  it("a ship offering roll and Knife flies the roll (interceptor fallback)", () => {
    const viper = flightCapabilitiesOf("terran_viper", "identity");
    expect(viper.barrelRoll).toBe(true);
    expect(viper.specials.tallon_left).toBeUndefined();
    expect(viper.specials.tallon_right).toBeUndefined();
    expect(viper.specials.kturn).toBe("red");
  });

  it("a heavy offering roll and Hook flies the Hook", () => {
    const hunter = flightCapabilitiesOf("synth_hunter", "identity");
    expect(hunter.barrelRoll).toBe(false);
    expect(hunter.specials.segnor_left).toBeDefined();
    expect(hunter.specials.segnor_right).toBeDefined();
  });

  it("a data signatureTrick overrides the role fallback", () => {
    expect(signatureTrickOf("confed_raven")).toBe("knife_roll");
    const raven = flightCapabilitiesOf("confed_raven", "identity");
    expect(raven.barrelRoll).toBe(false);
    expect(raven.specials.tallon_left).toBeDefined();
  });

  it("a support hull keeps no trick beyond Snap Turn unless its data says so", () => {
    expect(signatureTrickOf("terran_harbinger")).toBe("none");
    const harbinger = flightCapabilitiesOf("terran_harbinger", "identity");
    expect(trickCount(harbinger)).toBe(0);
    expect(harbinger.specials.kturn).toBeDefined();
    expect(signatureTrickOf("corsair_specter")).toBe("barrel_roll");
  });

  it("a ship with only one trick printed keeps it", () => {
    expect(flightCapabilitiesOf("terran_gladius", "identity").barrelRoll).toBe(
      true,
    );
    expect(signatureTrickOf("synth_ravager")).toBe("hook_loop");
  });

  it("every signature trick is actually offered by the hull's card (or is none)", () => {
    for (const def of FLYERS) {
      const trick = signatureTrickOf(def.id);
      const full = flightCapabilitiesOf(def.id, "full");
      if (trick === "barrel_roll") expect(full.barrelRoll).toBe(true);
      if (trick === "hook_loop") expect(full.specials.segnor_left).toBeDefined();
      if (trick === "knife_roll") expect(full.specials.tallon_left).toBeDefined();
    }
  });

  it("each of the three tricks is the signature of at least one hull", () => {
    const tricks = new Set(FLYERS.map((d) => signatureTrickOf(d.id)));
    expect(tricks).toContain("barrel_roll");
    expect(tricks).toContain("hook_loop");
    expect(tricks).toContain("knife_roll");
  });

  it("huge ships have no signature and no specials under either rule", () => {
    expect(signatureTrickOf("terran_imperator")).toBe("none");
    for (const rule of ["identity", "full"] as const) {
      const caps = flightCapabilitiesOf("terran_imperator", rule);
      expect(trickCount(caps)).toBe(0);
      expect(caps.canManeuver).toBe(false);
    }
  });
});

describe("trick rule source", () => {
  it("defaults to identity (setting default) when nothing is stored", () => {
    expect(activeTrickRule()).toBe("identity");
  });

  it("the online lock forces identity for an explicit-less call", () => {
    lockTrickRuleToIdentity(true);
    expect(activeTrickRule()).toBe("identity");
    expect(flightCapabilitiesOf("terran_viper")).toEqual(
      flightCapabilitiesOf("terran_viper", "identity"),
    );
  });
});

describe("effective card (HUD / encyclopedia / picker)", () => {
  it("lists the effective set in dial order: dashes then specials", () => {
    expect(shipSpecialLabels("terran_viper", "identity")).toEqual([
      "Boost",
      "Barrel Roll",
      "Snap Turn",
    ]);
    expect(shipSpecialLabels("terran_viper", "full")).toEqual([
      "Boost",
      "Barrel Roll",
      "Snap Turn",
      "Knife Roll",
    ]);
    expect(shipSpecialLabels("synth_hunter", "identity")).toEqual([
      "Snap Turn",
      "Hook Loop",
    ]);
    expect(shipSpecialLabels("terran_imperator", "identity")).toEqual([]);
  });

  it("effectiveActions drops barrel roll only when it is not the signature", () => {
    const hunter = SHIP_DEFINITIONS["synth_hunter"]!;
    expect(hunter.baseStats.actions).toContain("barrel_roll");
    expect(effectiveActions(hunter, "identity")).not.toContain("barrel_roll");
    expect(effectiveActions(hunter, "full")).toContain("barrel_roll");
    const viper = SHIP_DEFINITIONS["terran_viper"]!;
    expect(effectiveActions(viper, "identity")).toContain("barrel_roll");
  });

  it("effectiveDial drops the Hook / Knife cells of a ship that lost them", () => {
    const dirs = (id: string, rule: "identity" | "full") =>
      new Set(effectiveDial(id, rule).map((m) => m.direction));
    expect(dirs("terran_viper", "identity").has("tallon_left")).toBe(false);
    expect(dirs("terran_viper", "full").has("tallon_left")).toBe(true);
    expect(dirs("terran_viper", "identity").has("kturn")).toBe(true);
    expect(effectiveDial("terran_viper", "full")).toEqual(
      getShipDial("terran_viper"),
    );
  });
});

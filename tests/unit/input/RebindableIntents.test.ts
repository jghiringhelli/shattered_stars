/**
 * Spec: binding contexts. Two intents may share an input only when no scene
 * listens to both. "commander" is flight while the player commands a capital
 * ship (crew role commander): the commander orders are live there, and so is
 * every flight intent except the maneuvers a capital ship can never fly.
 */

import { describe, it, expect } from "vitest";
import {
  REBINDABLE_INTENTS,
  contextsOf,
  sharesContext,
} from "../../../src/input/RebindableIntents";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { flightCapabilitiesOf } from "../../../src/arcade/systems/FlightCapabilities";

/** Maneuvers FlightCapabilities refuses a ship with no specials or dashes. */
const CAPITAL_INERT = [
  "BOOST",
  "KTURN",
  "SEGNOR_LEFT",
  "SEGNOR_RIGHT",
  "TALLON_LEFT",
  "TALLON_RIGHT",
  "BARREL_ROLL",
  "BARREL_ROLL_LEFT",
  "BARREL_ROLL_RIGHT",
] as const;

describe("commander context", () => {
  it("is where the commander orders are listened to (and nowhere else)", () => {
    expect(contextsOf("COMMANDER_ORDER_1")).toEqual(["commander"]);
  });

  it("keeps the maneuvers a capital ship cannot fly out of it", () => {
    for (const intent of CAPITAL_INERT)
      expect(contextsOf(intent), intent).toEqual(["flight"]);
  });

  it("keeps every other flight intent live in it", () => {
    const inert = new Set<string>(CAPITAL_INERT);
    const flight = REBINDABLE_INTENTS.map((r) => r.intent).filter(
      (intent) => contextsOf(intent).includes("flight") && !inert.has(intent),
    );
    expect(flight).toEqual(
      expect.arrayContaining(["SHARP_TURN_LEFT", "FIRE_SECONDARY", "CLOAK"]),
    );
    for (const intent of flight)
      expect(sharesContext(intent, "COMMANDER_ORDER_1"), intent).toBe(true);
  });

  it("rests on every capital ship refusing boost, barrel roll and every special", () => {
    const capitals = Object.values(SHIP_DEFINITIONS).filter(
      (def) => def.role === "capital",
    );
    expect(capitals.length).toBeGreaterThan(0);
    for (const def of capitals) {
      const caps = flightCapabilitiesOf(def.id);
      expect(caps.boost, def.id).toBe(false);
      expect(caps.barrelRoll, def.id).toBe(false);
      expect(Object.keys(caps.specials), def.id).toEqual([]);
    }
  });
});

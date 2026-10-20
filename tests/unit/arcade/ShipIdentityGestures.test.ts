/**
 * Gesture traces under the ship identity rule, replayed through the real
 * pilot flight path: a ship flies only its signature trick, the gestures of a
 * trick it lost degrade quietly (arrows) or say why (maneuver key), the
 * documented gestures of the signature still fire, and the maneuver key does
 * nothing at all on a capital ship (it shares LT with commander order 1).
 */

import { describe, it, expect } from "vitest";
import {
  applyPilotFlightInput,
  INITIAL_PILOT_CONTROL,
  type FlightEvent,
  type FlownShip,
} from "../../../src/arcade/systems/PilotFlightControls";
import type { FlightRefusal } from "../../../src/arcade/systems/FlightCapabilities";
import { flightCapabilitiesOf } from "../../../src/arcade/systems/FlightCapabilities";
import { createCycleFlight } from "../../../src/arcade/systems/CycleFlight";
import { INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import { refusalLabel } from "../../../src/scenes/battleUi/weaponHud";
import { BATTLEFIELD_SIZE } from "../../../src/config";
import type { ShipState } from "../../../src/core/types";
import type { TrickRule } from "../../../src/core/flightCapabilityTypes";

const FRAME_MS = 16;

type Key = "left" | "right" | "up" | "down" | "maneuver";
type Move = readonly [atMs: number, key: Key, down: boolean];

const tap = (key: Key, at: number, holdMs = 60): Move[] => [
  [at, key, true],
  [at + holdMs, key, false],
];

interface Outcome {
  readonly events: FlightEvent[];
  readonly refusals: FlightRefusal[];
  readonly queued: Set<string>;
}

function flownShip(definitionId: string, rule: TrickRule): FlownShip {
  const pose = { x: 3000, y: 3000, angle: 0 };
  const flight = createCycleFlight(definitionId, pose, rule);
  return {
    ship: {
      id: "player",
      definitionId,
      faction: "terran_hegemony",
      owner: "player",
      ...pose,
      hull: 5,
      maxHull: 5,
      shields: 2,
      maxShields: 2,
      isStressed: false,
      hasFocus: false,
      hasEvade: false,
      hasTargetLock: null,
      isCloaked: false,
    } as ShipState,
    motion: flight.motion,
    stress: INITIAL_STRESS,
    dial: getShipDial(definitionId),
  };
}

function replay(
  definitionId: string,
  rule: TrickRule,
  moves: readonly Move[],
  durationMs = 800,
): Outcome {
  const held: Record<Key, boolean> = {
    left: false,
    right: false,
    up: false,
    down: false,
    maneuver: false,
  };
  const pending = [...moves].sort((a, b) => a[0] - b[0]);
  let pilot = INITIAL_PILOT_CONTROL;
  let flown = flownShip(definitionId, rule);
  const outcome: Outcome = { events: [], refusals: [], queued: new Set() };
  for (let now = 0; now <= durationMs; now += FRAME_MS) {
    while (pending.length > 0 && pending[0]![0] <= now) {
      const [, key, down] = pending.shift()!;
      held[key] = down;
    }
    const result = applyPilotFlightInput(
      pilot,
      flown,
      { ...held, edges: new Set(), nowMs: now, deltaMs: FRAME_MS },
      BATTLEFIELD_SIZE,
    );
    pilot = result.pilot;
    flown = { ...flown, motion: result.motion, stress: result.stress };
    outcome.events.push(...result.events);
    outcome.refusals.push(...result.refusals);
    const queued = result.motion.control.nextManeuver;
    if (queued) outcome.queued.add(queued);
  }
  return outcome;
}

const DOUBLE_TAP_LEFT = [...tap("left", 0, 50), ...tap("left", 110, 50)];
const KNIFE_LEFT: Move[] = [
  ...tap("maneuver", 0, 50),
  [90, "maneuver", true],
  [110, "left", true],
  [260, "left", false],
  [280, "maneuver", false],
];
const HOOK_LEFT: Move[] = [
  [0, "maneuver", true],
  [20, "left", true],
  [200, "left", false],
  [220, "maneuver", false],
];

describe("identity rule — a Viper (roll, not Knife)", () => {
  it("double-tap ← still barrel-rolls", () => {
    const outcome = replay("terran_viper", "identity", DOUBLE_TAP_LEFT);
    expect(outcome.events).toContain("barrel_roll");
  });

  it("the Knife gesture refuses with NOT ON DIAL and never queues a Knife", () => {
    const outcome = replay("terran_viper", "identity", KNIFE_LEFT);
    expect(outcome.events).not.toContain("tallon");
    expect([...outcome.queued].some((q) => /tallon/.test(q))).toBe(false);
    const labels = outcome.refusals.map(refusalLabel);
    expect(labels).toContain("KNIFE ROLL NOT ON DIAL");
  });

  it("the full-card rule flies the Knife again", () => {
    const outcome = replay("terran_viper", "full", KNIFE_LEFT);
    expect(outcome.events).toContain("tallon");
  });

  it("rapid alternating steering rolls and refuses nothing", () => {
    const moves: Move[] = [];
    for (let i = 0; i < 8; i++)
      moves.push(...tap(i % 2 === 0 ? "left" : "right", i * 80, 50));
    const outcome = replay("terran_viper", "identity", moves);
    expect(outcome.events).toEqual([]);
    expect(outcome.refusals).toEqual([]);
  });

  it("tap on the maneuver key is still a Snap Turn", () => {
    const outcome = replay("terran_viper", "identity", tap("maneuver", 0, 60));
    expect(outcome.events).toContain("kturn");
  });
});

describe("identity rule — a Hunter (Hook, not roll)", () => {
  it("hold maneuver + ← flies the Hook", () => {
    const outcome = replay("synth_hunter", "identity", HOOK_LEFT);
    expect(outcome.events).toContain("segnor");
  });

  it("a double-tapped arrow only steers: no roll, no refusal chatter", () => {
    const outcome = replay("synth_hunter", "identity", DOUBLE_TAP_LEFT);
    expect(outcome.events).toEqual([]);
    expect(outcome.refusals).toEqual([]);
    expect(outcome.queued.has("drift_left")).toBe(true);
  });
});

describe("capital ships — the maneuver key does nothing", () => {
  it("a tap (LT) flashes no NOT ON DIAL and queues nothing", () => {
    const outcome = replay("terran_imperator", "identity", tap("maneuver", 0, 60));
    expect(outcome.refusals).toEqual([]);
    expect(outcome.events).toEqual([]);
  });

  it("a hold with a side (Hook gesture) flashes nothing", () => {
    const outcome = replay("terran_imperator", "identity", HOOK_LEFT);
    expect(outcome.refusals).toEqual([]);
    expect(outcome.events).toEqual([]);
  });

  it("a held maneuver key does not capture the arrows: the ship still steers", () => {
    const outcome = replay("terran_imperator", "identity", [
      [0, "maneuver", true],
      [20, "left", true],
      [300, "left", false],
    ]);
    expect(outcome.queued.size).toBeGreaterThan(0);
  });

  it("a ship that merely lacks specials (not huge) still says why", () => {
    const outcome = replay("terran_harbinger", "identity", tap("maneuver", 0, 60));
    expect(outcome.events).toContain("kturn");
    const sentinel = replay("terran_sentinel", "identity", tap("maneuver", 0, 60));
    expect(sentinel.refusals.map(refusalLabel)).toEqual(["SNAP NOT ON DIAL"]);
    expect(flightCapabilitiesOf("terran_sentinel", "identity").canManeuver).not.toBe(
      false,
    );
  });
});

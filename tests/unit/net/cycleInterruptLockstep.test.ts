/**
 * Instant turns online — the cut is a pure function of the seat's input
 * stream and the sim clock, so lockstep clients agree tick by tick, the new
 * control and pilot fields are hashed, and a resync snapshot restores them.
 */

import { describe, it, expect } from "vitest";
import { hashArcade } from "../../../src/scenes/arcadeBattle/online/arcadeLockstep";
import { spawnArcadeShip } from "../../../src/scenes/arcadeBattle/arcadeShipFactory";
import {
  applyPilotFlightInput,
  onPilotCycleCommitted,
  INITIAL_PILOT_CONTROL,
  type FlightEdge,
  type PilotControlState,
} from "../../../src/arcade/systems/PilotFlightControls";
import { stepMotion } from "../../../src/arcade/systems/ShipMotion";
import { queueInterrupt } from "../../../src/core/cycleInterrupt";
import {
  captureGraph,
  restoreGraph,
} from "../../../src/net/lockstep/StateGraph";
import { BATTLEFIELD_SIZE } from "../../../src/config";

const TICK_MS = 1000 / 60;

const spawn = () =>
  spawnArcadeShip({
    id: "seat0",
    definitionId: "terran_viper",
    loadoutId: null,
    faction: "terran_hegemony",
    team: 0,
    squad: 0,
    pilot: "player",
    x: 3000,
    y: 3000,
    angle: 0,
  });

const view = (ships: ReturnType<typeof spawn>[]) => ({
  tick: 1,
  battleClockMs: 16,
  rngStates: [],
  ships,
  shots: [],
  devices: [],
  scalars: [],
});

/** What a seat holds: the ship and its pilot memory, flown by one input stream. */
function client() {
  return {
    ship: spawn(),
    pilot: INITIAL_PILOT_CONTROL as PilotControlState,
    clockMs: 0,
  };
}

/** One tick of the scene for a seat: input, motion, commit notice. */
function tick(c: ReturnType<typeof client>, left: boolean): void {
  const result = applyPilotFlightInput(
    c.pilot,
    {
      ship: c.ship,
      motion: c.ship,
      stress: c.ship.stress,
      dial: c.ship.shipDial,
    },
    {
      left,
      right: false,
      up: false,
      down: false,
      edges: new Set<FlightEdge>(),
      nowMs: c.clockMs,
      deltaMs: TICK_MS,
    },
    BATTLEFIELD_SIZE,
    { interruptCycles: true },
  );
  c.pilot = result.pilot;
  const step = stepMotion(result.motion, c.ship, TICK_MS, BATTLEFIELD_SIZE);
  Object.assign(c.ship, {
    x: step.state.x,
    y: step.state.y,
    angle: step.state.angle,
    control: step.state.control,
  });
  c.clockMs += TICK_MS;
  if (step.completed)
    c.pilot = onPilotCycleCommitted(
      c.pilot,
      step.state.control.currentManeuver ?? "straight",
    );
}

describe("instant turns online", () => {
  it("two clients fed the same input stream hash identically on every tick", () => {
    const a = client();
    const b = client();
    for (let i = 0; i < 180; i++) {
      const left = i >= 40 && i < 52;
      tick(a, left);
      tick(b, left);
      expect(hashArcade(view([a.ship]))).toBe(hashArcade(view([b.ship])));
    }
    expect(a.ship.control.currentManeuver).toBe(b.ship.control.currentManeuver);
  });

  it("a different press tick gives a different hash (the cut is part of the state)", () => {
    const a = client();
    const b = client();
    for (let i = 0; i < 60; i++) {
      tick(a, i === 40);
      tick(b, i === 41);
    }
    expect(hashArcade(view([a.ship]))).not.toBe(hashArcade(view([b.ship])));
  });

  it("hashes the interrupt request", () => {
    const ship = spawn();
    const before = hashArcade(view([ship]));
    ship.control = queueInterrupt(ship.control, "drift_left");
    const queued = hashArcade(view([ship]));
    expect(queued).not.toBe(before);
    ship.control = { ...ship.control, interruptQueued: false };
    expect(hashArcade(view([ship]))).not.toBe(queued);
  });

  it("restores the request and the pilot's steering memory from a resync snapshot", () => {
    const sender = client();
    for (let i = 0; i < 20; i++) tick(sender, false);
    sender.ship.control = queueInterrupt(sender.ship.control, "bank_right");
    sender.pilot = { ...sender.pilot, steerRequest: "bank_right" };
    const data = captureGraph({
      ship: sender.ship.control,
      pilot: sender.pilot,
    });
    const receiver = client();
    const restored = restoreGraph(
      { ship: receiver.ship.control, pilot: receiver.pilot },
      data,
    ).root as { ship: typeof sender.ship.control; pilot: PilotControlState };
    expect(restored.ship.interruptQueued).toBe(true);
    expect(restored.ship.nextManeuver).toBe("bank_right");
    expect(restored.ship.maneuverProgress).toBe(
      sender.ship.control.maneuverProgress,
    );
    expect(restored.pilot.steerRequest).toBe("bank_right");
  });
});

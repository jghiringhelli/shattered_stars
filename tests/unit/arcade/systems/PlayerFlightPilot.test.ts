/**
 * PlayerFlightPilot — specification tests: edge intents are consumed once,
 * throttle steps once per press, and detaching stops listening.
 */

import { describe, it, expect } from "vitest";
import {
  PlayerFlightPilot,
  type IntentSource,
  type PlayerFlightFrame,
} from "../../../../src/arcade/systems/PlayerFlightPilot";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { BANK_HOLD_MS } from "../../../../src/arcade/SteeringIntent";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import type {
  ActionIntent,
  InputEvent,
} from "../../../../src/input/InputTypes";

const FRAME_MS = 16;

/** Fake intent source: test code holds keys and fires press events. */
class FakeIntents implements IntentSource {
  readonly held = new Set<ActionIntent>();
  private listeners = new Map<number, (event: InputEvent) => void>();
  private nextId = 1;
  isHeld(intent: ActionIntent): boolean {
    return this.held.has(intent);
  }
  onAny(callback: (event: InputEvent) => void): number {
    const id = this.nextId++;
    this.listeners.set(id, callback);
    return id;
  }
  off(id: number): boolean {
    return this.listeners.delete(id);
  }
  press(intent: ActionIntent): void {
    for (const listener of this.listeners.values()) {
      listener({
        intent,
        value: 1,
        source: "keyboard",
        timestamp: 0,
      } as InputEvent);
    }
  }
}

function setup() {
  const intents = new FakeIntents();
  const pilot = new PlayerFlightPilot(intents, false);
  pilot.attach();
  let flight = createCycleFlight("terran_viper", {
    x: 3000,
    y: 3000,
    angle: 0,
  });
  const step = () => {
    const frame: PlayerFlightFrame = {
      flight,
      ship: flight.motion,
      dial: getShipDial("terran_viper"),
      nowMs: 0,
      deltaMs: FRAME_MS,
      worldSize: BATTLEFIELD_SIZE,
    };
    const result = pilot.fly(frame);
    flight = { motion: result.motion, stress: result.stress };
    return result;
  };
  return { intents, pilot, step, flight: () => flight };
}

describe("PlayerFlightPilot", () => {
  it("a Snap turn press queues the Snap turn on the next frame", () => {
    const { intents, step } = setup();
    intents.press("KTURN");
    expect(step().motion.control.nextManeuver).toBe("kturn");
  });

  it("a press is consumed once: the next frame reports no event", () => {
    const { intents, step } = setup();
    intents.press("BOOST");
    expect(step().events).toEqual(["boost"]);
    expect(step().events).toEqual([]);
  });

  it("holding THRUST_UP for several frames steps speed exactly once", () => {
    const { intents, step, flight } = setup();
    const before = flight().motion.control.speed;
    intents.held.add("THRUST_UP");
    step();
    step();
    step();
    expect(flight().motion.control.speed).toBe(before + 1);
  });

  it("ignores intents that are not flight edges", () => {
    const { intents, step } = setup();
    intents.press("FIRE_PRIMARY" as ActionIntent);
    expect(step().events).toEqual([]);
  });

  it("after detach, presses are ignored", () => {
    const { intents, pilot, step } = setup();
    pilot.detach();
    intents.press("KTURN");
    expect(step().motion.control.nextManeuver).toBeNull();
  });

  it("latches a MARK_TARGET press for the scene, once", () => {
    const { intents, pilot, step } = setup();
    expect(pilot.takeMarkRequest()).toBe(false);
    intents.press("MARK_TARGET");
    expect(step().events).toEqual([]);
    expect(pilot.takeMarkRequest()).toBe(true);
    expect(pilot.takeMarkRequest()).toBe(false);
  });

  it("forgets a pending mark press on reset", () => {
    const { intents, pilot } = setup();
    intents.press("MARK_TARGET");
    pilot.reset();
    expect(pilot.takeMarkRequest()).toBe(false);
  });

  it("after a bank cycle commits, a continued hold drifts", () => {
    const { intents, pilot, step } = setup();
    intents.held.add("STEER_LEFT");
    for (let t = 0; t <= BANK_HOLD_MS + FRAME_MS; t += FRAME_MS) step();
    expect(step().motion.control.nextManeuver).toBe("bank_left");
    pilot.onCycleCommitted("bank_left");
    expect(step().motion.control.nextManeuver).toBe("drift_left");
  });
});

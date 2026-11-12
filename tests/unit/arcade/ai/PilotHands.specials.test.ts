/**
 * PilotHands — a special (Snap turn, Hook, Knife) spends its recharge the
 * moment it is queued, so a later steering decision in the same cycle must
 * never replace it: before, an average pilot that re-planned within a cycle
 * lost about half of its Snap turns to a turn key and still paid the recharge.
 */

import { describe, expect, it } from "vitest";
import { PilotHands } from "../../../../src/arcade/ai/PilotHands";
import {
  IDLE_INTENT,
  type PilotIntent,
} from "../../../../src/arcade/ai/BotTypes";
import type { CycleFlightState } from "../../../../src/arcade/systems/CycleFlight";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { contact, flightOf } from "./aiFixtures";

const TICK_MS = 1000 / 60;
const SHIP = "terran_gladius";

function intent(overrides: Partial<PilotIntent>): PilotIntent {
  return { ...IDLE_INTENT, ...overrides };
}

/** A hands-and-ship pair: every frame continues from the last one. */
class Rig {
  readonly hands = new PilotHands();
  private flight: CycleFlightState = flightOf(
    contact("me", "red", SHIP, { x: 3000, y: 3000, angle: 0 }),
  );
  private nowMs = 0;

  /** One frame; returns the maneuver now queued for the next cycle. */
  frame(): string | null {
    const { motion, stress } = this.flight;
    const result = this.hands.fly({
      flown: { ship: motion, motion, stress, dial: getShipDial(SHIP) },
      nowMs: this.nowMs,
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
    });
    this.flight = { motion: result.motion, stress: result.stress };
    this.nowMs += TICK_MS;
    return result.motion.control.nextManeuver;
  }

  /** Several frames; returns the queued maneuver after the last. */
  frames(count: number): string | null {
    let queued: string | null = null;
    for (let i = 0; i < count; i++) queued = this.frame();
    return queued;
  }
}

describe("PilotHands — queued specials", () => {
  it("queues the Snap turn the pilot asked for", () => {
    const rig = new Rig();
    rig.hands.setIntent(intent({ special: "kturn" }));
    expect(rig.frames(2)).toBe("kturn");
  });

  it("keeps a queued Snap turn when the next decision wants a hard turn", () => {
    const rig = new Rig();
    rig.hands.setIntent(intent({ special: "kturn" }));
    rig.frames(2);
    rig.hands.setIntent(intent({ maneuver: "turn_right" }));
    expect(rig.frames(10)).toBe("kturn");
  });

  it("keeps a queued Snap turn when the next decision wants a bank", () => {
    const rig = new Rig();
    rig.hands.setIntent(intent({ special: "kturn" }));
    rig.frames(2);
    rig.hands.setIntent(intent({ maneuver: "bank_left" }));
    expect(rig.frames(10)).toBe("kturn");
  });

  it("does not steer in the frame it presses the special", () => {
    const rig = new Rig();
    rig.hands.setIntent(intent({ special: "kturn", maneuver: "turn_left" }));
    expect(rig.frames(2)).toBe("kturn");
  });
});

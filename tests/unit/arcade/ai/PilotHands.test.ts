/**
 * PilotHands — specification tests for the bot's keyboard: a turn intent
 * queues the turn once per cycle, and an intent judged before a cycle
 * committed is never re-keyed into the next cycle (it was judged from the
 * pose the new maneuver starts from, so re-keying it reverses the turn the
 * ship is flying — the weave that flew pilots straight into the belt).
 */

import { describe, expect, it } from "vitest";
import { PilotHands } from "../../../../src/arcade/ai/PilotHands";
import {
  IDLE_INTENT,
  type PilotIntent,
} from "../../../../src/arcade/ai/BotTypes";
import type { MotionState } from "../../../../src/arcade/systems/ShipMotion";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { contact, flightOf } from "./aiFixtures";

const TICK_MS = 1000 / 60;
const SHIP = "terran_gladius";

function intent(maneuver: PilotIntent["maneuver"]): PilotIntent {
  return { ...IDLE_INTENT, maneuver };
}

function freshFlight() {
  return flightOf(contact("me", "red", SHIP, { x: 3000, y: 3000, angle: 0 }));
}

/** One frame of the hands on a fresh ship; returns its motion after the keys. */
function press(hands: PilotHands, nowMs: number): MotionState {
  const { motion, stress } = freshFlight();
  return hands.fly({
    flown: { ship: motion, motion, stress, dial: getShipDial(SHIP) },
    nowMs,
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
  }).motion;
}

describe("PilotHands — sharp turns", () => {
  it("queues the intended turn", () => {
    const hands = new PilotHands();
    hands.setIntent(intent("turn_left"));
    expect(press(hands, 0).control.nextManeuver).toBe("turn_left");
  });

  it("does not re-key a pre-commit turn into the cycle that just started", () => {
    const hands = new PilotHands();
    hands.setIntent(intent("turn_left"));
    press(hands, 0);
    hands.onCycleCommitted("turn_left");
    expect(press(hands, 500).control.nextManeuver).toBeNull();
  });

  it("keys the fresh decision made after the commit", () => {
    const hands = new PilotHands();
    hands.setIntent(intent("turn_left"));
    press(hands, 0);
    hands.onCycleCommitted("turn_left");
    press(hands, 500);
    hands.setIntent(intent("turn_right"));
    expect(press(hands, 520).control.nextManeuver).toBe("turn_right");
  });
});

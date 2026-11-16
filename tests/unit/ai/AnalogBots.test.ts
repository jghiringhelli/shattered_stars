/**
 * Bots on the analog turn key: their intent (drift / bank / turn / straight)
 * becomes a hold of the one key, the planner predicts the cycle from the same
 * plan, and a pilot with no throttle plan slows for a hard turn.
 */

import { describe, expect, it } from "vitest";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../src/config";
import { startManeuver } from "../../../src/core/ArcadeControls";
import { holdPlanFor, holdPlanPose } from "../../../src/core/analogHold";
import type { DialSpeedTable } from "../../../src/core/speedCap";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import {
  IDLE_INTENT,
  PilotHands,
  TICK_MS,
  type PilotIntent,
} from "../../../src/simulation/skill";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../src/arcade/systems/CycleFlight";
import { ownShipView, type BotContact } from "../../../src/arcade/ai/BotView";
import { plannedPose } from "../../../src/arcade/ai/bots/ManeuverPlanner";
import { headingDelta } from "../../../src/simulation/flight/XWingFlightOracle";

const SHIP = "terran_gladius";
const START = { x: 3000, y: 3000, angle: 0 };
const TABLE: DialSpeedTable = { turn: [1, 2], bank: [1, 2, 3, 4], straight: [1, 2, 3, 4] };

const intentOf = (maneuver: PilotIntent["maneuver"]): PilotIntent => ({
  ...IDLE_INTENT,
  maneuver,
});

/** A gladius flying the analog engine at the given set speed. */
function analogShip(speed: number): CycleFlightState {
  const made = createCycleFlight(SHIP, START, "identity", "analog");
  const control = startManeuver(START, { ...made.motion.control, speed }, "straight");
  return { ...made, motion: { ...made.motion, control } };
}

/** Fly `hands` for `ms`, telling them when a cycle commits. */
function flyHands(
  start: CycleFlightState,
  hands: PilotHands,
  ms: number,
  onFrame?: (flight: CycleFlightState, t: number) => void,
): CycleFlightState {
  const dial = getShipDial(SHIP);
  let flight = start;
  for (let t = 0; t < ms - 1e-6; t += TICK_MS) {
    onFrame?.(flight, t);
    const { motion, stress } = flight;
    const flown = hands.fly({
      flown: { ship: motion, motion, stress, dial },
      nowMs: t,
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
    });
    const tick = tickCycleFlight(
      { motion: flown.motion, stress: flown.stress },
      { deltaMs: TICK_MS, worldSize: BATTLEFIELD_SIZE, dial, cycleMs: CYCLE_DURATION_MS },
    );
    flight = tick.state;
    if (tick.completed)
      hands.onCycleCommitted(flight.motion.control.currentManeuver ?? "straight");
  }
  return flight;
}

describe("holdPlanFor", () => {
  it("holds the key the whole cycle for the dial's own turn", () => {
    expect(holdPlanFor("turn_right", TABLE, 2, false)).toMatchObject({
      side: "right",
      rateDeg: 90,
      holdMs: CYCLE_DURATION_MS,
    });
  });

  it("holds half a cycle for a bank and a third for a drift where the dial turns 90 degrees", () => {
    expect(holdPlanFor("bank_left", TABLE, 2, false).holdMs).toBeCloseTo(CYCLE_DURATION_MS / 2);
    expect(holdPlanFor("drift_left", TABLE, 2, false).holdMs).toBeCloseTo(CYCLE_DURATION_MS / 3);
  });

  it("holds the whole cycle for a bank where the dial only banks", () => {
    expect(holdPlanFor("bank_right", TABLE, 3, false)).toMatchObject({
      rateDeg: 45,
      holdMs: CYCLE_DURATION_MS,
    });
  });

  it("does not hold the key for straight or a special", () => {
    expect(holdPlanFor("straight", TABLE, 2, false).holdMs).toBe(0);
    expect(holdPlanFor("kturn", TABLE, 2, false).holdMs).toBe(0);
  });

  it("predicts an arc then a straight", () => {
    const plan = holdPlanFor("bank_right", TABLE, 2, false);
    const end = holdPlanPose(START, plan, 40);
    expect(headingDelta(end.angle, 0)).toBeCloseTo(45, 3);
  });
});

describe("a bot's hands on the analog key", () => {
  it("turns 90 degrees in a cycle for a turn intent at a turn speed", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("turn_right"));
    const end = flyHands(analogShip(2), hands, CYCLE_DURATION_MS);
    expect(headingDelta(end.motion.angle, 0)).toBeCloseTo(90, 0);
  });

  it("turns 45 degrees then flies straight for a bank intent", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("bank_left"));
    const end = flyHands(analogShip(2), hands, CYCLE_DURATION_MS);
    expect(headingDelta(end.motion.angle, 0)).toBeCloseTo(-45, 0);
  });

  it("flies straight for a straight intent", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("straight"));
    const end = flyHands(analogShip(2), hands, 3 * CYCLE_DURATION_MS);
    expect(end.motion.angle).toBeCloseTo(0, 6);
    expect(end.motion.x).toBeCloseTo(3000, 6);
  });

  it("keeps the key down through the boundary of two full-hold cycles", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("turn_right"));
    const end = flyHands(analogShip(2), hands, 2 * CYCLE_DURATION_MS);
    expect(headingDelta(end.motion.angle, 0)).toBeCloseTo(180, 0);
  });

  it("starts the intent at the next cycle boundary, not mid-cycle", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("straight"));
    const mid = flyHands(analogShip(2), hands, CYCLE_DURATION_MS / 2, () => undefined);
    hands.setIntent(intentOf("turn_right"));
    const at = flyHands(mid, hands, CYCLE_DURATION_MS / 2);
    expect(headingDelta(at.motion.angle, 0)).toBeCloseTo(0, 6);
  });

  it("slows a pilot with no throttle plan to its hard-turn speed for a turn", () => {
    const hands = new PilotHands();
    hands.setIntent(intentOf("turn_left"));
    const end = flyHands(analogShip(3), hands, 2 * CYCLE_DURATION_MS);
    expect(end.motion.control.speed).toBe(2);
    expect(Math.abs(headingDelta(end.motion.angle, 0))).toBeGreaterThan(90);
  });
});

describe("the planner's prediction of an analog cycle", () => {
  const contact: BotContact = {
    id: "a",
    side: "A",
    definitionId: SHIP,
    x: START.x,
    y: START.y,
    angle: 0,
    alive: true,
    hull: 1,
    maxHull: 1,
    shields: 0,
    maxShields: 0,
    firingArcDeg: 90,
    weaponRange: 400,
  };

  it.each(["straight", "drift_right", "bank_right", "bank_left", "turn_right"] as const)(
    "puts the ship where it plans for %s",
    (maneuver) => {
      const hands = new PilotHands();
      hands.setIntent(intentOf("straight"));
      const start = analogShip(2);
      const view = ownShipView({
        self: contact,
        flight: start,
        dial: getShipDial(SHIP),
        maneuverable: true,
        holdLeftMs: hands.analogHoldLeftMs(),
      });
      const planned = plannedPose(view, { maneuver, speed: 2 });
      const first = flyHands(start, hands, TICK_MS);
      hands.setIntent(intentOf(maneuver));
      const end = flyHands(first, hands, 2 * CYCLE_DURATION_MS - TICK_MS);
      expect(
        Math.hypot(end.motion.x - planned.x, end.motion.y - planned.y),
      ).toBeLessThan(2);
      expect(Math.abs(headingDelta(end.motion.angle, planned.angle))).toBeLessThan(1);
    },
  );
});

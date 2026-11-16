/**
 * AnalogTuning: the experimental knobs of the analog engine. The tabletop
 * preset keeps the template's angles; other tunings change the per-cycle
 * angles (bank / hard turn / scale) and the "held key flies the hard turn"
 * variant, all through the ship's capabilities and nothing else.
 */

import { describe, expect, it } from "vitest";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../src/config";
import { startManeuver } from "../../../src/core/ArcadeControls";
import { holdSteer } from "../../../src/core/analogCycle";
import { holdPlanFor, holdPlanPose } from "../../../src/core/analogHold";
import { holdMsFor } from "../../../src/core/analogBoost";
import { steeringCapacity, type AnalogSide } from "../../../src/core/analogSteering";
import {
  ANALOG_PRESETS,
  AnalogTuningError,
  DEFAULT_ANALOG_TUNING,
  TABLETOP_ANALOG_TUNING,
  analogTuningOf,
  formatAnalogTuning,
  heldBoostOf,
  parseAnalogTune,
  validateAnalogTuning,
  type AnalogTuning,
} from "../../../src/core/analogTuning";
import type { DialSpeedTable } from "../../../src/core/speedCap";
import { SHIP_DEFINITIONS, getShipDial } from "../../../src/data/ShipDefinitions";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../src/arcade/systems/CycleFlight";
import { flightCapabilitiesOf } from "../../../src/arcade/systems/FlightCapabilities";
import { setAnalogTuningOverride } from "../../../src/arcade/systems/SteeringMode";
import { headingDelta } from "../../../src/simulation/flight/XWingFlightOracle";
import { withAnalogTuning } from "../../../src/simulation/skill/ArenaSteering";
import { spawnArenaShip } from "../../../src/simulation/skill/ArenaShip";
import { BotPilot } from "../../../src/arcade/ai/BotPilot";

const TICK_MS = 1000 / 60;
const TICKS_PER_CYCLE = Math.round(CYCLE_DURATION_MS / TICK_MS);
const START = { x: 3000, y: 3000, angle: 0 };
const TABLE: DialSpeedTable = { turn: [1, 2], bank: [1, 2, 3, 4], straight: [1, 2, 3, 4, 5] };

/** The tabletop tuning with some knobs changed. */
const tuned = (patch: Partial<AnalogTuning>): AnalogTuning => ({
  ...TABLETOP_ANALOG_TUNING,
  ...patch,
});

/** A fighter and a speed where its dial prints a bank but no hard turn, and a hard turn at a lower speed. */
function bankOnlyShip(): { id: string; speed: number } {
  for (const id of Object.keys(SHIP_DEFINITIONS)) {
    const control = createCycleFlight(id, START, "identity", "analog").motion.control;
    const table = control.capabilities?.dialSpeeds;
    if (control.movementProfile === "capital" || !table?.turn?.length) continue;
    for (let speed = control.minSpeed; speed <= control.maxSpeed; speed++)
      if (!table.turn.includes(speed) && table.bank?.includes(speed)) return { id, speed };
  }
  throw new Error("no fighter prints a bank without a hard turn at some speed");
}

/** Fly `ticks` ticks with the key as `side(tick)` says; returns the flight and the heading turned. */
function fly(
  start: CycleFlightState,
  ticks: number,
  side: (tick: number) => AnalogSide,
  id: string,
): CycleFlightState {
  let flight = start;
  for (let tick = 0; tick < ticks; tick++) {
    const { motion, stress } = flight;
    const control = holdSteer(motion, motion.control, side(tick), stress.isStressed);
    flight = tickCycleFlight(
      { motion: { ...motion, control }, stress },
      { deltaMs: TICK_MS, worldSize: BATTLEFIELD_SIZE, dial: getShipDial(id), cycleMs: CYCLE_DURATION_MS },
    ).state;
  }
  return flight;
}

/** A flight of `id` at the set speed under `tuning`, a fresh straight cycle. */
function flightWith(id: string, speed: number, tuning: AnalogTuning): CycleFlightState {
  const made = withAnalogTuning(createCycleFlight(id, START, "identity", "analog"), tuning);
  const control = startManeuver(START, { ...made.motion.control, speed }, "straight");
  return { ...made, motion: { ...made.motion, control } };
}

describe("the tuning object", () => {
  it("keeps the tabletop angles in the tabletop preset", () => {
    expect(ANALOG_PRESETS.tabletop).toEqual({
      bankDegrees: 45,
      turnDegrees: 90,
      rateScale: 1,
      heldTurnAfterMs: null,
    });
  });

  it("departs from the tabletop bank angle on purpose and keeps its hard turn", () => {
    expect(DEFAULT_ANALOG_TUNING).toEqual({
      bankDegrees: 70,
      turnDegrees: 90,
      rateScale: 1,
      heldTurnAfterMs: null,
    });
    expect(ANALOG_PRESETS.default).toBe(DEFAULT_ANALOG_TUNING);
    expect(DEFAULT_ANALOG_TUNING).not.toEqual(TABLETOP_ANALOG_TUNING);
  });

  it("falls back to the default when a ship names none", () => {
    expect(analogTuningOf(undefined)).toBe(DEFAULT_ANALOG_TUNING);
    expect(analogTuningOf({ analogTuning: tuned({ bankDegrees: 60 }) }).bankDegrees).toBe(60);
  });

  it("accepts the default and rejects out-of-range knobs", () => {
    expect(validateAnalogTuning(DEFAULT_ANALOG_TUNING)).toBe(DEFAULT_ANALOG_TUNING);
    expect(() => validateAnalogTuning(tuned({ bankDegrees: 5 }))).toThrow(AnalogTuningError);
    expect(() => validateAnalogTuning(tuned({ bankDegrees: 100, turnDegrees: 90 }))).toThrow(AnalogTuningError);
    expect(() => validateAnalogTuning(tuned({ heldTurnAfterMs: -1 }))).toThrow(AnalogTuningError);
  });

  it("parses a dev override over the default", () => {
    expect(parseAnalogTune("preset:tabletop,bank:60,hold:250")).toEqual(
      tuned({ bankDegrees: 60, heldTurnAfterMs: 250 }),
    );
    expect(parseAnalogTune("scale:0.75,hold:off").rateScale).toBe(0.75);
  });

  it("refuses an override it cannot read", () => {
    for (const text of ["bank", "bank:", "speed:3", "preset:nope", "bank:abc"])
      expect(() => parseAnalogTune(text), text).toThrow(AnalogTuningError);
  });

  it("labels a tuning by what departs from the tabletop", () => {
    expect(formatAnalogTuning(tuned({ bankDegrees: 60, heldTurnAfterMs: 250 }))).toBe("bank 60 / hold 250");
    expect(formatAnalogTuning(TABLETOP_ANALOG_TUNING)).toBe("bank 45 / hold off");
  });
});

describe("steeringCapacity under a tuning", () => {
  it("turns at the tuned bank angle where the dial prints only a bank", () => {
    expect(steeringCapacity(TABLE, 3, false, tuned({ bankDegrees: 60 }))).toMatchObject({
      speed: 3,
      rateDeg: 60,
      dialMaxDeg: 60,
      kind: "bank",
    });
  });

  it("turns at the tuned hard-turn angle where the dial prints a hard turn", () => {
    expect(steeringCapacity(TABLE, 2, false, tuned({ turnDegrees: 100 })).rateDeg).toBe(100);
  });

  it("scales both rates", () => {
    expect(steeringCapacity(TABLE, 2, false, tuned({ rateScale: 0.5 })).rateDeg).toBe(45);
    expect(steeringCapacity(TABLE, 3, false, tuned({ rateScale: 0.5 })).rateDeg).toBe(22.5);
  });

  it("limits a stressed pilot to the tuned bank angle", () => {
    const stressed = steeringCapacity(TABLE, 2, true, tuned({ bankDegrees: 60 }));
    expect(stressed.rateDeg).toBe(60);
    expect(stressed.dialMaxDeg).toBe(90);
  });

  it("earns the held-turn boost only at a bank-only speed of a ship with a hard turn", () => {
    const hold = tuned({ heldTurnAfterMs: 250 });
    expect(steeringCapacity(TABLE, 3, false, hold).boost).toEqual({ afterMs: 250, rateDeg: 90 });
    expect(steeringCapacity(TABLE, 2, false, hold).boost).toBeNull();
    expect(steeringCapacity(TABLE, 3, true, hold).boost).toBeNull();
    expect(steeringCapacity({ bank: [1, 2, 3] }, 3, false, hold).boost).toBeNull();
    expect(steeringCapacity(TABLE, 3, false, tuned({})).boost).toBeNull();
    expect(heldBoostOf(hold, true, false)).not.toBeNull();
  });
});

describe("the held-turn boost in flight", () => {
  const { id, speed } = bankOnlyShip();
  const hold = tuned({ heldTurnAfterMs: 250 });
  const turned = (flight: CycleFlightState): number =>
    Math.abs(headingDelta(flight.motion.angle, 0));

  it("turns at the bank rate until the key has been held long enough, then at the hard-turn rate", () => {
    const end = fly(flightWith(id, speed, hold), TICKS_PER_CYCLE, () => "right", id);
    expect(turned(end)).toBeCloseTo(45 * 0.5 + 90 * 0.5, 0);
  });

  it("keeps the hold time across the cycle boundary", () => {
    const end = fly(flightWith(id, speed, hold), 2 * TICKS_PER_CYCLE, () => "right", id);
    expect(turned(end)).toBeCloseTo(45 * 0.5 + 90 * 0.5 + 90, 0);
  });

  it("starts the hold afresh after a release", () => {
    const pulses = (tick: number): AnalogSide => (tick % 30 < 12 ? "right" : "none");
    const end = fly(flightWith(id, speed, hold), TICKS_PER_CYCLE, pulses, id);
    const plain = fly(flightWith(id, speed, tuned({})), TICKS_PER_CYCLE, pulses, id);
    expect(turned(end)).toBeCloseTo(turned(plain), 3);
  });

  it("does nothing when the variant is off", () => {
    const end = fly(flightWith(id, speed, tuned({})), TICKS_PER_CYCLE, () => "right", id);
    expect(turned(end)).toBeCloseTo(45, 0);
  });

  it("does not depend on the tick length", () => {
    const run = (ticks: number): number => {
      let flight = flightWith(id, speed, hold);
      for (let t = 0; t < ticks; t++) {
        const { motion, stress } = flight;
        const control = holdSteer(motion, motion.control, "right", stress.isStressed);
        flight = tickCycleFlight(
          { motion: { ...motion, control }, stress },
          { deltaMs: CYCLE_DURATION_MS / ticks, worldSize: BATTLEFIELD_SIZE, dial: getShipDial(id), cycleMs: CYCLE_DURATION_MS },
        ).state;
      }
      return turned(flight);
    };
    expect(run(30)).toBeCloseTo(run(120), 1);
  });
});

describe("hold plans under a tuning", () => {
  it("holds the whole cycle for a 60-degree bank at a bank-only speed", () => {
    const plan = holdPlanFor("bank_left", TABLE, 3, false, { tuning: tuned({ bankDegrees: 60 }) });
    expect(plan).toMatchObject({ rateDeg: 60, holdMs: CYCLE_DURATION_MS });
  });

  it("holds less of the cycle for the same bank when the dial turns faster", () => {
    const plan = holdPlanFor("bank_left", TABLE, 2, false, { tuning: tuned({ bankDegrees: 60 }) });
    expect(plan.holdMs).toBeCloseTo((60 / 90) * CYCLE_DURATION_MS);
  });

  it("shortens a bank hold by the boost it will earn", () => {
    expect(holdMsFor(45, 45, { afterMs: 250, rateDeg: 90 }, 0)).toBeCloseTo(375);
    expect(holdMsFor(45, 45, { afterMs: 250, rateDeg: 90 }, 250)).toBeCloseTo(250);
    expect(holdMsFor(10, 45, { afterMs: 250, rateDeg: 90 }, 0)).toBeCloseTo((10 / 45) * 500);
  });

  it("predicts where the boosted hold ends", () => {
    const { id, speed } = bankOnlyShip();
    const hold = tuned({ heldTurnAfterMs: 250 });
    const table = flightWith(id, speed, hold).motion.control.capabilities?.dialSpeeds;
    const plan = holdPlanFor("turn_right", table, speed, false, { tuning: hold });
    const flown = fly(flightWith(id, speed, hold), TICKS_PER_CYCLE, () => "right", id);
    const end = holdPlanPose(START, plan, flown.motion.control.baseSize);
    expect(headingDelta(end.angle, flown.motion.angle)).toBeCloseTo(0, 0);
    expect(Math.hypot(end.x - flown.motion.x, end.y - flown.motion.y)).toBeLessThan(2);
  });
});

describe("plumbing", () => {
  it("puts the tuning on the capabilities of analog ships only", () => {
    const tuning = tuned({ bankDegrees: 60 });
    expect(flightCapabilitiesOf("terran_viper", "identity", "analog", tuning).analogTuning).toEqual(tuning);
    expect(flightCapabilitiesOf("terran_viper", "identity", "template", tuning).analogTuning).toBeUndefined();
    expect(flightCapabilitiesOf("terran_viper", "identity", "analog", undefined).analogTuning).toBeUndefined();
  });

  it("applies the dev override to ships built without a tuning", () => {
    const tuning = tuned({ bankDegrees: 70 });
    setAnalogTuningOverride(tuning);
    try {
      expect(flightCapabilitiesOf("terran_viper", "identity", "analog").analogTuning).toEqual(tuning);
    } finally {
      setAnalogTuningOverride(null);
    }
    expect(flightCapabilitiesOf("terran_viper", "identity", "analog").analogTuning).toBeUndefined();
  });

  it("flies the arena spec's tuning on its ships", () => {
    const tuning = tuned({ bankDegrees: 55 });
    const ship = spawnArenaShip({
      id: "A0",
      side: "A",
      definitionId: "terran_viper",
      pose: START,
      pilot: new BotPilot("average", { seed: 1 }),
      steering: "analog",
      analogTuning: tuning,
    });
    expect(ship.flight.motion.control.capabilities?.analogTuning).toEqual(tuning);
  });
});

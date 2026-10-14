/**
 * PilotFlightControls — specification tests for the player's flight inputs
 * shared by every cycle-engine battle scene.
 */

import { describe, it, expect } from "vitest";
import {
  applyPilotFlightInput,
  onPilotCycleCommitted,
  INITIAL_PILOT_CONTROL,
  type FlightEdge,
  type FlightInput,
  type FlownShip,
  type PilotControlState,
} from "../../../../src/arcade/systems/PilotFlightControls";
import { BANK_HOLD_MS } from "../../../../src/arcade/SteeringIntent";
import { BOOST_DISTANCE_PX } from "../../../../src/arcade/ArcadeInputGestures";
import {
  INITIAL_STRESS,
  type StressState,
} from "../../../../src/arcade/ArcadeStress";
import { createControlState } from "../../../../src/core/ArcadeControls";
import { createShipControl } from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import type { ShipState } from "../../../../src/core/types";

const FRAME_MS = 16;
const SHIP = {
  id: "player",
  definitionId: "terran_viper",
  faction: "terran_hegemony",
  owner: "player",
  x: 3000,
  y: 3000,
  angle: 0,
  hull: 5,
  maxHull: 5,
  shields: 2,
  maxShields: 2,
  isStressed: false,
  hasFocus: false,
  hasEvade: false,
  hasTargetLock: null,
  isCloaked: false,
} as ShipState;

/** A Viper at rest in the middle of the field, speed 3, nothing queued. */
function flown(overrides: Partial<FlownShip> = {}): FlownShip {
  return {
    ship: SHIP,
    motion: {
      x: SHIP.x,
      y: SHIP.y,
      angle: 0,
      control: createControlState(SHIP, 18),
    },
    stress: INITIAL_STRESS,
    dial: getShipDial("terran_viper"),
    ...overrides,
  };
}

/** One input frame; nothing held, no edges, unless overridden. */
function frame(overrides: Partial<FlightInput> = {}): FlightInput {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    edges: new Set<FlightEdge>(),
    nowMs: 1000,
    deltaMs: FRAME_MS,
    allowChordBarrelRoll: false,
    ...overrides,
  };
}

const edges = (...list: FlightEdge[]): ReadonlySet<FlightEdge> => new Set(list);

/** Holds `side` for `ms`, frame by frame, returning the final pilot + result. */
function hold(side: "left" | "right", ms: number, ship = flown()) {
  let pilot: PilotControlState = INITIAL_PILOT_CONTROL;
  let result = applyPilotFlightInput(pilot, ship, frame(), BATTLEFIELD_SIZE);
  for (let t = 0; t < ms; t += FRAME_MS) {
    result = applyPilotFlightInput(
      pilot,
      { ...ship, motion: result.motion },
      frame({ [side]: true, nowMs: 1000 + t }),
      BATTLEFIELD_SIZE,
    );
    pilot = result.pilot;
  }
  return result;
}

describe("PilotFlightControls — throttle", () => {
  it("THRUST_UP raises speed one step", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("THRUST_UP") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.speed).toBe(4);
  });

  it("THRUST_DOWN lowers speed one step", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("THRUST_DOWN") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.speed).toBe(2);
  });
});

describe("PilotFlightControls — steering", () => {
  it("holding a side past BANK_HOLD_MS queues a 45° bank", () => {
    const r = hold("left", BANK_HOLD_MS + FRAME_MS * 2);
    expect(r.motion.control.nextManeuver).toBe("bank_left");
  });

  it("a short hold queues a drift, not a bank", () => {
    const r = hold("right", FRAME_MS * 2);
    expect(r.motion.control.nextManeuver).toBe("drift_right");
  });

  it("a tap released before the cycle still owes one drift", () => {
    const tapped = hold("left", FRAME_MS * 2);
    const released = applyPilotFlightInput(
      tapped.pilot,
      flown({ motion: tapped.motion }),
      frame(),
      BATTLEFIELD_SIZE,
    );
    expect(released.motion.control.nextManeuver).toBe("drift_left");
  });

  it("after a bank was flown, continuing to hold drifts instead of banking again", () => {
    const banked = hold("left", BANK_HOLD_MS + FRAME_MS * 2);
    const pilot = onPilotCycleCommitted(banked.pilot, "bank_left");
    const r = applyPilotFlightInput(
      pilot,
      flown({ motion: banked.motion }),
      frame({ left: true }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBe("drift_left");
  });

  it("no steering clears a stale bank so the next cycle flies straight", () => {
    const base = flown();
    const motion = {
      ...base.motion,
      control: { ...base.motion.control, nextManeuver: "bank_left" as const },
    };
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown({ motion }),
      frame(),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBeNull();
  });

  it("no steering keeps a queued Snap turn", () => {
    const base = flown();
    const motion = {
      ...base.motion,
      control: { ...base.motion.control, nextManeuver: "kturn" as const },
    };
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown({ motion }),
      frame(),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBe("kturn");
  });

  it("SHARP_TURN_LEFT queues a 90° turn and reports a hard turn", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("SHARP_TURN_LEFT") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBe("turn_left");
    expect(r.events).toContain("hard_turn");
  });
});

describe("PilotFlightControls — specials", () => {
  it("KTURN queues the Snap turn, spikes stress and reports it", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("KTURN") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBe("kturn");
    expect(r.stress.level).toBeGreaterThan(0);
    expect(r.events).toEqual(["kturn"]);
  });

  it("KTURN is refused while stressed", () => {
    const stressed: StressState = { level: 0.9, isStressed: true };
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown({ stress: stressed }),
      frame({ edges: edges("KTURN") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.control.nextManeuver).toBeNull();
    expect(r.events).toEqual([]);
  });

  it("a second special on cooldown adds no stress", () => {
    const first = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("TALLON_LEFT") }),
      BATTLEFIELD_SIZE,
    );
    const second = applyPilotFlightInput(
      first.pilot,
      flown({ motion: first.motion, stress: first.stress }),
      frame({ edges: edges("SEGNOR_RIGHT") }),
      BATTLEFIELD_SIZE,
    );
    expect(second.motion.control.nextManeuver).toBe("tallon_left");
    expect(second.stress).toEqual(first.stress);
    expect(second.events).toEqual([]);
  });
});

describe("PilotFlightControls — dashes", () => {
  it("BOOST dashes forward BOOST_DISTANCE_PX, adds stress and reports it", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("BOOST") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.motion.x).toBeCloseTo(SHIP.x, 6);
    expect(r.motion.y).toBeCloseTo(SHIP.y - BOOST_DISTANCE_PX, 6);
    expect(r.stress.level).toBeGreaterThan(0);
    expect(r.events).toEqual(["boost"]);
  });

  it("BOOST on cooldown does nothing", () => {
    const first = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("BOOST") }),
      BATTLEFIELD_SIZE,
    );
    const second = applyPilotFlightInput(
      first.pilot,
      flown({ motion: first.motion, stress: first.stress }),
      frame({ edges: edges("BOOST") }),
      BATTLEFIELD_SIZE,
    );
    expect(second.motion.y).toBe(first.motion.y);
    expect(second.events).toEqual([]);
  });

  it("BARREL_ROLL_LEFT / RIGHT (gamepad button) roll once, like the left+right chord", () => {
    const left = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("BARREL_ROLL_LEFT") }),
      BATTLEFIELD_SIZE,
    );
    expect(left.events).toEqual(["barrel_roll"]);
    expect(left.motion.x).toBeLessThan(SHIP.x);
    const right = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("BARREL_ROLL_RIGHT") }),
      BATTLEFIELD_SIZE,
    );
    expect(right.events).toEqual(["barrel_roll"]);
    expect(right.motion.x).toBeGreaterThan(SHIP.x);
  });

  it("a roll button does not latch steering: the held stick keeps banking", () => {
    const r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ left: true, edges: edges("BARREL_ROLL_RIGHT") }),
      BATTLEFIELD_SIZE,
    );
    expect(r.events).toEqual(["barrel_roll"]);
    expect(r.pilot.rollLatched).toBe(false);
  });
});

describe("PilotFlightControls — committed maneuvers stay queued until the cycle flies them", () => {
  /** Applies `count` frames of the same input, threading pilot and flight. */
  function frames(
    first: ReturnType<typeof applyPilotFlightInput>,
    input: Partial<FlightInput>,
    count: number,
  ) {
    let r = first;
    for (let i = 0; i < count; i++) {
      r = applyPilotFlightInput(
        r.pilot,
        flown({ motion: r.motion, stress: r.stress }),
        frame({ nowMs: 2000 + i * FRAME_MS, ...input }),
        BATTLEFIELD_SIZE,
      );
    }
    return r;
  }

  it("a hard turn (Q) stays queued on the following frames with no steering", () => {
    const q = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("SHARP_TURN_LEFT") }),
      BATTLEFIELD_SIZE,
    );
    expect(frames(q, {}, 5).motion.control.nextManeuver).toBe("turn_left");
  });

  it("steering held after a hard turn does not overwrite it", () => {
    const q = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("SHARP_TURN_RIGHT") }),
      BATTLEFIELD_SIZE,
    );
    expect(frames(q, { left: true }, 20).motion.control.nextManeuver).toBe(
      "turn_right",
    );
  });

  it("steering after a Snap turn does not overwrite it", () => {
    const k = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("KTURN") }),
      BATTLEFIELD_SIZE,
    );
    expect(frames(k, { left: true }, 20).motion.control.nextManeuver).toBe(
      "kturn",
    );
  });

  it("holding a side never queues a 90° turn — hold is a bank", () => {
    let r = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame(),
      BATTLEFIELD_SIZE,
    );
    const queued = new Set<string | null>();
    for (let t = 0; t < 600; t += FRAME_MS) {
      r = frames(r, { left: true }, 1);
      queued.add(r.motion.control.nextManeuver);
    }
    expect(queued.has("turn_left")).toBe(false);
    expect(queued.has("bank_left")).toBe(true);
  });

  it("once the turn commits, steering queues again", () => {
    const q = applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      flown(),
      frame({ edges: edges("SHARP_TURN_LEFT") }),
      BATTLEFIELD_SIZE,
    );
    const committed = {
      ...q,
      pilot: onPilotCycleCommitted(q.pilot, "turn_left"),
      motion: {
        ...q.motion,
        control: { ...q.motion.control, nextManeuver: null },
      },
    };
    expect(
      frames(committed, { right: true }, 2).motion.control.nextManeuver,
    ).toBe("drift_right");
  });
});

describe("PilotFlightControls — card and stress limits (X-Wing)", () => {
  /** A ship flying the real control state of `definitionId`. */
  function carded(definitionId: string, stress: StressState = INITIAL_STRESS) {
    return flown({
      motion: {
        x: SHIP.x,
        y: SHIP.y,
        angle: 0,
        control: createShipControl(definitionId, SHIP),
      },
      stress,
      dial: getShipDial(definitionId),
    });
  }
  const STRESSED: StressState = { level: 0.9, isStressed: true };
  const press = (ship: FlownShip, ...list: FlightEdge[]) =>
    applyPilotFlightInput(
      INITIAL_PILOT_CONTROL,
      ship,
      frame({ edges: edges(...list) }),
      BATTLEFIELD_SIZE,
    );

  it("a stressed pilot is refused red Knife and Hook too", () => {
    const r = press(carded("terran_viper", STRESSED), "TALLON_LEFT");
    expect(r.motion.control.nextManeuver).toBeNull();
    expect(r.refusals).toEqual([{ action: "tallon", reason: "stressed" }]);
  });

  it("a stressed pilot may still fly a white special", () => {
    const r = press(carded("synth_hunter", STRESSED), "SEGNOR_LEFT");
    expect(r.motion.control.nextManeuver).toBe("segnor_left");
    expect(r.refusals).toEqual([]);
  });

  it("a stressed pilot is refused boost and barrel roll", () => {
    const boosted = press(carded("terran_viper", STRESSED), "BOOST");
    expect(boosted.motion.y).toBe(SHIP.y);
    expect(boosted.events).toEqual([]);
    expect(boosted.refusals).toEqual([{ action: "boost", reason: "stressed" }]);
    const rolled = press(carded("terran_viper", STRESSED), "BARREL_ROLL_LEFT");
    expect(rolled.events).toEqual([]);
    expect(rolled.refusals).toEqual([
      { action: "barrel_roll", reason: "stressed" },
    ]);
  });

  it("a special not on the dial is refused", () => {
    const r = press(carded("terran_viper"), "SEGNOR_RIGHT");
    expect(r.motion.control.nextManeuver).toBeNull();
    expect(r.refusals).toEqual([{ action: "segnor", reason: "not_on_dial" }]);
  });

  it("a dash not on the action bar is refused", () => {
    const r = press(carded("terran_gladius"), "BOOST");
    expect(r.events).toEqual([]);
    expect(r.refusals).toEqual([{ action: "boost", reason: "no_action" }]);
  });

  it("a huge ship cannot Snap turn, loop, roll or boost", () => {
    const ship = carded("terran_imperator");
    for (const edge of [
      "KTURN",
      "SEGNOR_LEFT",
      "TALLON_RIGHT",
      "BOOST",
    ] as const) {
      const r = press(ship, edge);
      expect(r.events).toEqual([]);
      expect(r.refusals).toHaveLength(1);
    }
  });

  it("a calm pilot with the card flies them and is refused nothing", () => {
    const r = press(carded("terran_viper"), "KTURN");
    expect(r.motion.control.nextManeuver).toBe("kturn");
    expect(r.refusals).toEqual([]);
  });
});

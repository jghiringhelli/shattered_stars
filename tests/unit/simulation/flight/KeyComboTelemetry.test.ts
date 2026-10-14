/**
 * Key-combo telemetry battery — every keyboard combination a pilot can use
 * is played through the real flight path, and the ship must end each cycle
 * exactly where the X-Wing rules put it.
 *
 * Bindings (src/input/DefaultBindings.ts): ←/→ steer (tap = drift, hold =
 * bank then drift), Q/E hard turn, ↑/↓ throttle; the ONE maneuver key Z:
 * tap = Snap turn, hold + ←/→ = Hook, double-tap + hold ←/→ = Knife;
 * gestures: ↑↑ boost, ↓↓ Snap turn, ← ← / → → = barrel roll left / right.
 * The direct SEGNOR/TALLON/KTURN intents stay (bots, optional extra keys).
 */

import { describe, it, expect } from "vitest";
import {
  flyScript,
  tap,
  type FlightTrace,
  type FlownCycle,
  type ScriptEvent,
} from "./keyComboHarness";
import {
  BOOST_DISTANCE_PX,
  DOUBLE_TAP_WINDOW_MS,
} from "../../../../src/arcade/ArcadeInputGestures";
import { ROLL_DOUBLE_TAP_WINDOW_MS } from "../../../../src/arcade/RollDoubleTap";
import { createShipControl } from "../../../../src/arcade/systems/CycleFlight";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import {
  headingDelta,
  predictBarrelRoll,
  predictManeuver,
  translate,
  type Pose,
} from "../../../../src/simulation/flight/XWingFlightOracle";
import type { ManeuverDirection } from "../../../../src/core/types";
import type { ActionIntent } from "../../../../src/input/InputTypes";

const SHIP = "terran_viper";
const START: Pose = { x: 3000, y: 3000, angle: 37 };
const BASE = createShipControl(SHIP, START).baseSize;
const CRUISE = createShipControl(SHIP, START).speed;
/** Inputs land early in the first (straight) cycle; it commits at 500 ms. */
const T0 = 100;

const fly = (events: ScriptEvent[], durationMs = 2600): FlightTrace =>
  flyScript({ shipId: SHIP, start: START, durationMs, events });

const press = (intent: ActionIntent, atMs = T0): ScriptEvent => ({
  atMs,
  press: intent,
});

/** Gap between the two taps of a double tap. */
const DOUBLE_GAP = DOUBLE_TAP_WINDOW_MS / 3;

const doubleTap = (key: "UP" | "DOWN", atMs = T0): ScriptEvent[] => [
  ...tap(key, atMs, 40),
  ...tap(key, atMs + DOUBLE_GAP, 40),
];

function cycleFlying(
  trace: FlightTrace,
  direction: ManeuverDirection,
): FlownCycle {
  const cycle = trace.cycles.find((c) => c.direction === direction);
  if (!cycle) {
    throw new Error(
      `no ${direction} cycle; flew ${trace.cycles.map((c) => c.direction).join(", ")}`,
    );
  }
  return cycle;
}

function expectPose(actual: Pose, expected: Pose): void {
  expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThan(
    0.5,
  );
  expect(Math.abs(headingDelta(actual.angle, expected.angle))).toBeLessThan(
    0.1,
  );
}

function expectAtOracle(cycle: FlownCycle): void {
  expectPose(cycle.end, predictManeuver(cycle.start, cycle, BASE));
}

describe("key combos — no input", () => {
  it("flies straight at cruise speed, cycle after cycle", () => {
    const trace = fly([]);
    expect(trace.cycles.length).toBeGreaterThanOrEqual(4);
    for (const cycle of trace.cycles) {
      expect(cycle).toMatchObject({ direction: "straight", speed: CRUISE });
      expectAtOracle(cycle);
    }
  });
});

describe("key combos — steering arrows", () => {
  it("a tap of ← flies one 30° drift left, then straight", () => {
    const trace = fly(tap("LEFT", T0));
    const drift = cycleFlying(trace, "drift_left");
    expectAtOracle(drift);
    expect(
      trace.cycles.filter((c) => c.direction === "drift_left"),
    ).toHaveLength(1);
  });

  for (const [key, side] of [
    ["LEFT", "left"],
    ["RIGHT", "right"],
  ] as const) {
    it(`holding ${key === "LEFT" ? "←" : "→"} banks 45° once, then drifts — never a 90° turn`, () => {
      const trace = fly([
        { atMs: T0, down: key },
        { atMs: 2200, up: key },
      ]);
      const steering = trace.cycles.filter((c) => c.direction !== "straight");
      expect(steering[0]!.direction).toBe(`bank_${side}`);
      expect(
        steering.slice(1).every((c) => c.direction === `drift_${side}`),
      ).toBe(true);
      expect(trace.cycles.some((c) => c.direction === `turn_${side}`)).toBe(
        false,
      );
      steering.forEach(expectAtOracle);
    });
  }
});

describe("key combos — action keys", () => {
  const dial = getShipDial(SHIP);
  const cases: ReadonlyArray<[string, ScriptEvent[], ManeuverDirection]> = [
    ["Q", [press("SHARP_TURN_LEFT")], "turn_left"],
    ["E", [press("SHARP_TURN_RIGHT")], "turn_right"],
    ["extra key KTURN", [press("KTURN")], "kturn"],
    ["direct SEGNOR_LEFT", [press("SEGNOR_LEFT")], "segnor_left"],
    ["direct SEGNOR_RIGHT", [press("SEGNOR_RIGHT")], "segnor_right"],
    ["direct TALLON_LEFT", [press("TALLON_LEFT")], "tallon_left"],
    ["direct TALLON_RIGHT", [press("TALLON_RIGHT")], "tallon_right"],
  ];
  for (const [keys, events, direction] of cases) {
    it(`${keys} flies ${direction} next cycle, ending where X-Wing puts it`, () => {
      expectAtOracle(cycleFlying(fly(events), direction));
    });
  }

  it("Q/E pick a turn speed the dial actually has", () => {
    const turn = cycleFlying(fly([press("SHARP_TURN_LEFT")]), "turn_left");
    expect(
      dial.some((m) => m.direction === "turn_left" && m.speed === turn.speed),
    ).toBe(true);
  });

  it("specials cost stress", () => {
    expect(fly([press("KTURN")]).peakStress).toBeGreaterThan(0);
  });
});

describe("key combos — gestures", () => {
  it("↓↓ flies a Snap turn", () => {
    expectAtOracle(cycleFlying(fly(doubleTap("DOWN")), "kturn"));
  });

  it("↑↑ with a side held is still only a boost (no arrow Knife)", () => {
    const trace = fly([
      { atMs: T0 - 50, down: "LEFT" },
      ...doubleTap("UP", 600),
      { atMs: 1000, up: "LEFT" },
    ]);
    expect(trace.events.map((e) => e.event)).toContain("boost");
    expect(trace.cycles.some((c) => c.direction.startsWith("tallon"))).toBe(
      false,
    );
  });

  it("Z (tap) flies a Snap turn", () => {
    expectAtOracle(cycleFlying(fly(tap("MANEUVER", T0, 60)), "kturn"));
  });

  for (const [key, side] of [
    ["LEFT", "left"],
    ["RIGHT", "right"],
  ] as const) {
    it(`holding Z and pressing ${key === "LEFT" ? "←" : "→"} flies a Hook Loop ${side}`, () => {
      const trace = fly([
        { atMs: T0 - 50, down: "MANEUVER" },
        { atMs: T0, down: key },
        { atMs: 450, up: key },
        { atMs: 450, up: "MANEUVER" },
      ]);
      expectAtOracle(cycleFlying(trace, `segnor_${side}`));
    });

    it(`double-tapping Z then holding Z + ${key === "LEFT" ? "←" : "→"} flies a Knife Roll ${side} (and no Snap turn)`, () => {
      const trace = fly([
        ...tap("MANEUVER", T0, 50),
        { atMs: T0 + 130, down: "MANEUVER" },
        { atMs: T0 + 190, down: key },
        { atMs: 450, up: key },
        { atMs: 450, up: "MANEUVER" },
      ]);
      expectAtOracle(cycleFlying(trace, `tallon_${side}`));
      expect(trace.cycles.some((c) => c.direction === "kturn")).toBe(false);
    });
  }

  it("holding Z with no side flies nothing", () => {
    const trace = fly([
      { atMs: T0, down: "MANEUVER" },
      { atMs: T0 + 900, up: "MANEUVER" },
    ]);
    expect(trace.cycles.every((c) => c.direction === "straight")).toBe(true);
  });
  it("↑↑ boosts: the straight cycle ends one boost further forward", () => {
    const trace = fly(doubleTap("UP", 600));
    expect(trace.events.map((e) => e.event)).toContain("boost");
    const boosted = trace.cycles[1]!;
    expect(boosted.direction).toBe("straight");
    const unboosted = predictManeuver(boosted.start, boosted, BASE);
    expectPose(boosted.end, translate(unboosted, 0, BOOST_DISTANCE_PX));
  });

  it("↑↑ boost leaves the throttle where it was", () => {
    const trace = fly(doubleTap("UP", 600));
    expect(trace.final.motion.control.speed).toBe(CRUISE);
  });

  it("↓↓ Snap turn leaves the throttle where it was", () => {
    const trace = fly(doubleTap("DOWN"));
    expect(trace.final.motion.control.speed).toBe(CRUISE);
  });

  for (const [key, side] of [
    ["LEFT", "left"],
    ["RIGHT", "right"],
  ] as const) {
    it(`${key === "LEFT" ? "← ←" : "→ →"} (double-tap) barrel-rolls ${side} and flies straight on`, () => {
      const at = 600;
      const trace = fly([
        ...tap(key, at, 50),
        ...tap(key, at + ROLL_DOUBLE_TAP_WINDOW_MS / 2, 50),
      ]);
      expect(trace.events.map((e) => e.event)).toContain("barrel_roll");
      const rolled = trace.cycles[1]!;
      expect(rolled.direction).toBe("straight");
      expectPose(
        rolled.end,
        predictBarrelRoll(
          predictManeuver(rolled.start, rolled, BASE),
          side,
          BASE,
        ),
      );
      expect(
        trace.cycles.slice(2).every((c) => c.direction === "straight"),
      ).toBe(true);
    });

    it(`a ${side} barrel roll whose second tap is held on still flies straight on (no bank)`, () => {
      const at = 600;
      const trace = fly([
        ...tap(key, at, 50),
        { atMs: at + 110, down: key },
        { atMs: at + 1100, up: key },
      ]);
      expect(trace.events.map((e) => e.event)).toContain("barrel_roll");
      expect(
        trace.cycles.slice(1).every((c) => c.direction === "straight"),
      ).toBe(true);
    });
  }

  for (const [first, second] of [
    ["LEFT", "RIGHT"],
    ["RIGHT", "LEFT"],
  ] as const) {
    it(`${first === "LEFT" ? "← then →" : "→ then ←"} in quick succession never rolls (ordinary steering)`, () => {
      const at = 600;
      const trace = fly([
        ...tap(first, at, 50),
        ...tap(second, at + 90, 50),
        ...tap(first, at + 180, 50),
      ]);
      expect(trace.events.map((e) => e.event)).not.toContain("barrel_roll");
    });
  }

  it("a single tap of ← never rolls", () => {
    expect(fly(tap("LEFT", 600, 50)).events.map((e) => e.event)).not.toContain(
      "barrel_roll",
    );
  });
});
describe("key combos — throttle", () => {
  it("one ↑ tap raises the next cycle's speed by one", () => {
    const trace = fly(tap("UP", T0));
    expect(trace.cycles[1]!.speed).toBe(CRUISE + 1);
    expectAtOracle(trace.cycles[1]!);
  });

  it("one ↓ tap lowers the next cycle's speed by one", () => {
    const trace = fly(tap("DOWN", T0));
    expect(trace.cycles[1]!.speed).toBe(CRUISE - 1);
    expectAtOracle(trace.cycles[1]!);
  });
});

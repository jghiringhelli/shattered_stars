/**
 * Gesture false positives and the positive controls — realistic input
 * traces replayed through the real pilot flight path (gesture machines +
 * FlightCapabilities + stress), asserting that ordinary flying never rolls,
 * hooks or knifes by accident and that every special still fires from its
 * documented gesture.
 */

import { describe, it, expect } from "vitest";
import {
  applyPilotFlightInput,
  INITIAL_PILOT_CONTROL,
  type FlightEvent,
  type FlownShip,
  type PilotControlState,
} from "../../../src/arcade/systems/PilotFlightControls";
import { INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";
import { createControlState } from "../../../src/core/ArcadeControls";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import { BATTLEFIELD_SIZE } from "../../../src/config";
import type { ShipState } from "../../../src/core/types";
import type { FlightRefusal } from "../../../src/arcade/systems/FlightCapabilities";

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

type Key = "left" | "right" | "up" | "down" | "maneuver";
/** A key going down or up at a time. */
type Move = readonly [atMs: number, key: Key, down: boolean];

/** A tap of a key: down at `at`, up `holdMs` later. */
const tap = (key: Key, at: number, holdMs = 60): Move[] => [
  [at, key, true],
  [at + holdMs, key, false],
];

interface Outcome {
  readonly events: FlightEvent[];
  readonly refusals: FlightRefusal[];
  /** Every maneuver that was ever queued for the next cycle. */
  readonly queued: Set<string>;
  readonly final: FlownShip;
  readonly pilot: PilotControlState;
}

/** A Viper in open space; `flightOverrides` adjusts its control/stress. */
function viper(overrides: Partial<FlownShip> = {}): FlownShip {
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

/** Replays key moves frame by frame (60 Hz) for `durationMs`. */
function replay(
  moves: readonly Move[],
  durationMs = 1500,
  start: FlownShip = viper(),
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
  let flown = start;
  const outcome: Outcome = {
    events: [],
    refusals: [],
    queued: new Set(),
    final: start,
    pilot,
  };
  for (let now = 0; now <= durationMs; now += FRAME_MS) {
    while (pending.length > 0 && pending[0]![0] <= now) {
      const [, key, down] = pending.shift()!;
      held[key] = down;
    }
    const result = applyPilotFlightInput(
      pilot,
      flown,
      {
        ...held,
        edges: new Set(),
        nowMs: now,
        deltaMs: FRAME_MS,
      },
      BATTLEFIELD_SIZE,
    );
    pilot = result.pilot;
    flown = { ...flown, motion: result.motion, stress: result.stress };
    outcome.events.push(...result.events);
    outcome.refusals.push(...result.refusals);
    const queued = result.motion.control.nextManeuver;
    if (queued) outcome.queued.add(queued);
  }
  return { ...outcome, final: flown, pilot };
}

const UNINTENDED: readonly FlightEvent[] = ["barrel_roll", "segnor", "tallon"];

/** Asserts no roll, hook or knife (and no refusal chatter) happened. */
function expectNoSpecials(outcome: Outcome): void {
  for (const event of UNINTENDED) expect(outcome.events).not.toContain(event);
  expect(outcome.refusals).toEqual([]);
  for (const queued of outcome.queued) expect(queued).not.toMatch(/segnor|tallon/);
}

describe("false positives — ordinary flying never triggers a special", () => {
  it("rapid alternating steering ← → ← → ← → rolls nothing", () => {
    const moves: Move[] = [];
    for (let i = 0; i < 8; i++)
      moves.push(...tap(i % 2 === 0 ? "left" : "right", i * 80, 50));
    const outcome = replay(moves);
    expectNoSpecials(outcome);
    expect(outcome.events).toEqual([]);
  });

  it("alternating at the roll window's edge (← → ← within 220 ms) rolls nothing", () => {
    const outcome = replay([
      ...tap("left", 0, 40),
      ...tap("right", 70, 40),
      ...tap("left", 140, 40),
    ]);
    expectNoSpecials(outcome);
  });

  it("tap-spam of one arrow at a calm rhythm (every 300 ms) rolls nothing", () => {
    const moves: Move[] = [];
    for (let i = 0; i < 5; i++) moves.push(...tap("left", i * 300, 60));
    expectNoSpecials(replay(moves, 1800));
  });

  it("hold ← (a bank) and tap ← again right after is not a double-tap", () => {
    const outcome = replay([...tap("left", 0, 400), ...tap("left", 460, 60)]);
    expectNoSpecials(outcome);
  });

  it("holding both arrows (a chord) rolls nothing with the chord option off", () => {
    expectNoSpecials(
      replay([
        [0, "left", true],
        [20, "right", true],
        [300, "left", false],
        [300, "right", false],
      ]),
    );
  });

  it("holding the maneuver key with no side does nothing, even when long", () => {
    const outcome = replay([...tap("maneuver", 0, 900)]);
    expectNoSpecials(outcome);
    expect(outcome.events).not.toContain("kturn");
  });

  it("tapping the maneuver key while steering ← Snap Turns, never Hooks", () => {
    const outcome = replay([
      [0, "left", true],
      ...tap("maneuver", 400, 80),
      [900, "left", false],
    ]);
    expect(outcome.events).toEqual(["kturn"]);
    expectNoSpecials({ ...outcome, events: [], refusals: outcome.refusals });
  });

  it("boosting (↑↑) during a held turn only boosts", () => {
    const outcome = replay([
      [0, "left", true],
      ...tap("up", 200, 40),
      ...tap("up", 320, 40),
      [900, "left", false],
    ]);
    expect(outcome.events).toEqual(["boost"]);
    expectNoSpecials({ ...outcome, events: [] });
  });

  it("↓↓ with a side held is a Snap Turn, not a Hook", () => {
    const outcome = replay([
      [0, "right", true],
      ...tap("down", 200, 40),
      ...tap("down", 320, 40),
      [900, "right", false],
    ]);
    expect(outcome.events).toEqual(["kturn"]);
    expect(outcome.queued.has("segnor_right")).toBe(false);
  });

  it("throttle taps (↑ then ↓) never read as a gesture", () => {
    const outcome = replay([...tap("up", 0, 40), ...tap("down", 120, 40)]);
    expect(outcome.events).toEqual([]);
  });

  it("a triple tap of → rolls once", () => {
    const outcome = replay([
      ...tap("right", 0, 50),
      ...tap("right", 110, 50),
      ...tap("right", 220, 50),
    ]);
    expect(outcome.events.filter((e) => e === "barrel_roll")).toHaveLength(1);
  });
});

describe("positive controls — every special fires from its documented gesture", () => {
  for (const side of ["left", "right"] as const) {
    it(`double-tap ${side} barrel-rolls ${side} and cancels the drift its first tap queued`, () => {
      const outcome = replay([...tap(side, 0, 50), ...tap(side, 110, 50)], 400);
      expect(outcome.events).toEqual(["barrel_roll"]);
      expect(outcome.final.motion.x < SHIP.x).toBe(side === "left");
      expect(outcome.final.motion.control.nextManeuver).toBeNull();
    });

    it(`maneuver key held + ${side} flies a Hook ${side}`, () => {
      const outcome = replay([
        [0, "maneuver", true],
        [100, side, true],
        [300, side, false],
        [320, "maneuver", false],
      ]);
      expect(outcome.events).toEqual(["segnor"]);
      expect(outcome.final.motion.control.nextManeuver).toBe(`segnor_${side}`);
    });

    it(`double-tap maneuver key, hold + ${side} flies a Knife ${side} (never a Snap Turn)`, () => {
      const outcome = replay([
        ...tap("maneuver", 0, 60),
        [140, "maneuver", true],
        [200, side, true],
        [400, side, false],
        [420, "maneuver", false],
      ]);
      expect(outcome.events.filter((e) => e === "tallon")).toHaveLength(1);
      expect(outcome.final.motion.control.nextManeuver).toBe(`tallon_${side}`);
      expect(outcome.final.stress.level).toBeCloseTo(0.5, 5);
    });
  }

  it("tap on the maneuver key flies a Snap Turn", () => {
    const outcome = replay([...tap("maneuver", 100, 80)]);
    expect(outcome.events).toEqual(["kturn"]);
    expect(outcome.final.motion.control.nextManeuver).toBe("kturn");
  });

  it("↓↓ is still a Snap Turn and ↑↑ a boost", () => {
    expect(replay([...tap("down", 0, 40), ...tap("down", 120, 40)]).events).toEqual([
      "kturn",
    ]);
    expect(replay([...tap("up", 0, 40), ...tap("up", 120, 40)]).events).toEqual([
      "boost",
    ]);
  });

  it("a Knife costs the stress of one special (the first tap's Snap Turn is never queued)", () => {
    const knife = replay([
      ...tap("maneuver", 0, 60),
      [140, "maneuver", true],
      [200, "left", true],
    ]);
    const hook = replay([
      [0, "maneuver", true],
      [100, "left", true],
    ]);
    expect(knife.final.stress.level).toBeCloseTo(hook.final.stress.level, 5);
  });
});

describe("unavailable specials degrade quietly on the arrows", () => {
  const doubleTap = [...tap("left", 0, 50), ...tap("left", 110, 50)];

  it("a barrel roll on its recharge: the double-tap just steers, no refusal", () => {
    const base = viper();
    const recharging = viper({
      motion: {
        ...base.motion,
        control: { ...base.motion.control, barrelRollCooldown: 2000 },
      },
    });
    const outcome = replay(doubleTap, 300, recharging);
    expect(outcome.events).toEqual([]);
    expect(outcome.refusals).toEqual([]);
    expect(outcome.queued.has("drift_left")).toBe(true);
  });

  it("a stressed pilot's double-tap steers silently", () => {
    const outcome = replay(
      doubleTap,
      300,
      viper({ stress: { level: 1, isStressed: true } }),
    );
    expect(outcome.events).toEqual([]);
    expect(outcome.refusals).toEqual([]);
    expect(outcome.queued.has("drift_left")).toBe(true);
  });

  it("a ship without the roll on its action bar steers silently", () => {
    const base = viper();
    const noRoll = viper({
      motion: {
        ...base.motion,
        control: {
          ...base.motion.control,
          capabilities: { boost: true, barrelRoll: false, specials: {} },
        },
      },
    });
    const outcome = replay(doubleTap, 300, noRoll);
    expect(outcome.events).toEqual([]);
    expect(outcome.refusals).toEqual([]);
  });

  it("a deliberate maneuver-key press that is refused still says why", () => {
    const base = viper();
    const noSpecials = viper({
      motion: {
        ...base.motion,
        control: {
          ...base.motion.control,
          capabilities: { boost: true, barrelRoll: true, specials: {} },
        },
      },
    });
    const outcome = replay([...tap("maneuver", 0, 60)], 300, noSpecials);
    expect(outcome.refusals).toEqual([{ action: "kturn", reason: "not_on_dial" }]);
  });
});
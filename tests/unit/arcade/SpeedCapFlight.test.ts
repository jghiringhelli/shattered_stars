/**
 * Speed cap per maneuver in the cycle engine: the set speed stays what the
 * player chose, each cycle is flown at min(set, dial cap), the capped cycle
 * is classified on the dial, and bots plan with the flown speed.
 */

import { describe, it, expect } from "vitest";
import {
  advanceCycle,
  processCommand,
  type ShipControlState,
} from "../../../src/core/ArcadeControls";
import { resolveManeuver } from "../../../src/systems/MovementSystem";
import { BATTLEFIELD_SIZE } from "../../../src/config";
import { getShipDial, getShipsByRole } from "../../../src/data/ShipDefinitions";
import {
  createCycleFlight,
  createShipControl,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../src/arcade/systems/CycleFlight";
import { hardTurnThrottle } from "../../../src/arcade/HardTurnThrottle";
import { ownShipView } from "../../../src/arcade/ai/BotView";
import { plannedPose } from "../../../src/arcade/ai/bots/ManeuverPlanner";
import {
  dialSpeedTable,
  flownSpeed,
  queuedCycleSpeed,
  queuedSpeedCap,
} from "../../../src/core/speedCap";
import { flightCapabilitiesOf } from "../../../src/arcade/systems/FlightCapabilities";

const POSE = { x: 3000, y: 3000, angle: 0 };
const fighter = (): string => getShipsByRole("heavy_fighter")[0]!.id;

/** Control of a ship with the given set speed and queued maneuver. */
function controlOf(
  id: string,
  speed: number,
  next: ShipControlState["nextManeuver"],
): ShipControlState {
  return {
    ...createShipControl(id, POSE, "identity"),
    speed,
    nextManeuver: next,
  };
}

describe("advanceCycle with the speed cap", () => {
  const id = fighter();
  const dial = getShipDial(id);
  const turnCap = Math.max(
    ...dial.filter((m) => m.direction === "turn_left").map((m) => m.speed),
  );

  it("flies the queued maneuver at the dial cap and keeps the set speed", () => {
    const control = advanceCycle(POSE, controlOf(id, 4, "turn_left"));
    expect(control.speed).toBe(4);
    expect(control.cycleSpeed).toBe(turnCap);
    expect(control.speedCap).toBe(turnCap);
    expect(control.currentManeuver).toBe("turn_left");
  });

  it("builds the template path with the flown speed", () => {
    const control = advanceCycle(POSE, controlOf(id, 4, "turn_left"));
    const expected = resolveManeuver(
      POSE.x,
      POSE.y,
      POSE.angle,
      { direction: "turn_left", speed: turnCap, difficulty: "white" },
      control.baseSize,
    );
    expect(control.maneuverTarget).toEqual({
      x: expected.targetX,
      y: expected.targetY,
      angle: expected.targetAngle,
    });
  });

  it("returns to the set speed on the next straight cycle", () => {
    const turned = advanceCycle(POSE, controlOf(id, 4, "turn_left"));
    const straight = advanceCycle(POSE, turned);
    expect(straight.currentManeuver).toBe("straight");
    expect(straight.cycleSpeed).toBe(4);
    expect(straight.speed).toBe(4);
  });

  it("flies a drift on the bank entries", () => {
    const bankCap = Math.max(
      ...dial.filter((m) => m.direction === "bank_left").map((m) => m.speed),
    );
    const control = advanceCycle(POSE, controlOf(id, 4, "drift_left"));
    expect(control.cycleSpeed).toBe(bankCap);
  });

  it("never flies above the set speed for an ordinary maneuver", () => {
    const control = advanceCycle(POSE, controlOf(id, 1, "turn_right"));
    expect(control.cycleSpeed).toBe(1);
  });

  it("starts a ship on a straight at its cruise speed", () => {
    const fresh = createShipControl(id, POSE, "identity");
    expect(fresh.cycleSpeed).toBe(fresh.speed);
    expect(fresh.speedCap).not.toBeNull();
  });

  it("is deterministic and serialisable", () => {
    const run = (): ShipControlState =>
      advanceCycle(POSE, controlOf(id, 4, "bank_right"));
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    const control = run();
    expect(JSON.parse(JSON.stringify(control))).toEqual(control);
  });

  it("previews the queued maneuver's speed for the HUD", () => {
    const control = controlOf(id, 4, "turn_left");
    expect(queuedCycleSpeed(control)).toBe(turnCap);
    expect(queuedSpeedCap(control)).toBe(turnCap);
    expect(queuedCycleSpeed({ ...control, nextManeuver: null })).toBe(4);
  });
});

describe("throttle commands only change the set speed", () => {
  it("thrust steps move control.speed, not the flown cycle", () => {
    const id = fighter();
    const control = createShipControl(id, POSE, "identity");
    const up = processCommand(POSE, control, "thrust_increase");
    expect(up.speed).toBe(control.speed + 1);
    expect(up.cycleSpeed).toBe(control.cycleSpeed);
  });
});

describe("every ship class", () => {
  for (const role of ["interceptor", "bomber", "gunship", "support"]) {
    it(`${role}: a maneuver is never flown above its dial cap`, () => {
      const id = getShipsByRole(role)[0]!.id;
      const dial = getShipDial(id);
      for (const next of ["bank_left", "turn_left", "drift_right"] as const) {
        for (let set = 1; set <= 5; set++) {
          const control = advanceCycle(POSE, controlOf(id, set, next));
          const group = next.startsWith("turn") ? "turn" : "bank";
          const speeds = dial
            .filter((m) => m.direction.startsWith(group))
            .map((m) => m.speed);
          if (speeds.length === 0) {
            expect(control.cycleSpeed).toBe(set);
            continue;
          }
          expect(control.cycleSpeed).toBeLessThanOrEqual(Math.max(...speeds));
          expect(speeds).toContain(control.cycleSpeed);
        }
      }
    });
  }

  it("huge ships keep flying at the set speed", () => {
    const huge = getShipsByRole("capital")[0]!.id;
    const control = advanceCycle(POSE, controlOf(huge, 2, "bank_left"));
    expect(control.cycleSpeed).toBe(control.speed);
    expect(control.speedCap).toBeNull();
  });
});

describe("tickCycleFlight classifies the flown speed", () => {
  function flyOneCycle(
    state: CycleFlightState,
    id: string,
  ): ReturnType<typeof tickCycleFlight> {
    let tick = tickCycleFlight(state, {
      deltaMs: 0,
      worldSize: BATTLEFIELD_SIZE,
      dial: getShipDial(id),
      cycleMs: 500,
    });
    for (let i = 0; i < 600 && !tick.completed; i++)
      tick = tickCycleFlight(tick.state, {
        deltaMs: 1000 / 60,
        worldSize: BATTLEFIELD_SIZE,
        dial: getShipDial(id),
        cycleMs: 500,
      });
    return tick;
  }

  it("reports the flown speed as the completed speed and stresses by the dial", () => {
    const id = fighter();
    const start = createCycleFlight(id, POSE, "identity");
    const queued: CycleFlightState = {
      ...start,
      motion: {
        ...start.motion,
        control: { ...start.motion.control, speed: 4 },
      },
    };
    // The opening straight flew at cruise speed; the set speed is 4 from here.
    const first = flyOneCycle(queued, id);
    const turning: CycleFlightState = {
      ...first.state,
      motion: {
        ...first.state.motion,
        control: { ...first.state.motion.control, nextManeuver: "bank_left" },
      },
    };
    // The bank queued now commits at that boundary; fly it fully.
    const second = flyOneCycle(turning, id);
    const third = flyOneCycle(second.state, id);
    expect(second.completed?.direction).toBe("straight");
    expect(third.completed?.direction).toBe("bank_left");
    const dial = getShipDial(id);
    const bankCap = Math.max(
      ...dial.filter((m) => m.direction === "bank_left").map((m) => m.speed),
    );
    expect(third.completed?.speed).toBe(bankCap);
    const difficulty = dial.find(
      (m) => m.direction === "bank_left" && m.speed === bankCap,
    )!.difficulty;
    if (difficulty === "red")
      expect(third.state.stress.level).toBeGreaterThan(
        second.state.stress.level,
      );
  });
});

describe("bots plan with the flown speed", () => {
  it("exposes the dial speed table on the own-ship view", () => {
    const id = fighter();
    const flight = createCycleFlight(id, POSE, "identity");
    const view = ownShipView({
      self: {
        id: "me",
        side: "a",
        definitionId: id,
        ...POSE,
        alive: true,
        hull: 1,
        maxHull: 1,
        shields: 0,
        maxShields: 0,
        firingArcDeg: 40,
        weaponRange: 300,
      },
      flight,
      dial: getShipDial(id),
      maneuverable: true,
    });
    expect(view.dialSpeeds).toEqual(
      flightCapabilitiesOf(id, "identity").dialSpeeds,
    );
    const predicted = plannedPose(view, { maneuver: "turn_left", speed: 4 });
    const flown = flownSpeed(dialSpeedTable(getShipDial(id)), "turn_left", 4);
    const expected = resolveManeuver(
      view.endPose.x,
      view.endPose.y,
      view.endPose.angle,
      { direction: "turn_left", speed: flown, difficulty: "white" },
      view.baseSize,
    );
    expect(predicted.x).toBeCloseTo(expected.targetX, 6);
    expect(predicted.y).toBeCloseTo(expected.targetY, 6);
    expect(predicted.angle).toBeCloseTo(expected.targetAngle, 6);
  });
});

describe("hard turns keep the throttle", () => {
  const id = fighter();
  const dial = getShipDial(id);
  const dialSpeeds = dialSpeedTable(dial);
  const input = { dial, dialSpeeds, minSpeed: 1, maxSpeed: 4 };

  it("leaves the set speed alone when the pilot is calm", () => {
    expect(hardTurnThrottle({ ...input, speed: 4, isStressed: false })).toBe(4);
  });

  it("retunes a stressed pilot only when the capped turn would be red", () => {
    const red = [
      ...dial.filter((m) => m.direction !== "turn_left"),
      { direction: "turn_left" as const, speed: 4, difficulty: "red" as const },
      {
        direction: "turn_left" as const,
        speed: 2,
        difficulty: "white" as const,
      },
    ];
    const table = dialSpeedTable(red);
    expect(
      hardTurnThrottle({
        ...input,
        dial: red,
        dialSpeeds: table,
        speed: 4,
        isStressed: true,
      }),
    ).toBe(2);
    expect(hardTurnThrottle({ ...input, speed: 4, isStressed: true })).toBe(4);
  });

  it("keeps retuning when the ship has no cap table", () => {
    expect(
      hardTurnThrottle({
        dial,
        minSpeed: 1,
        maxSpeed: 4,
        speed: 4,
        isStressed: false,
      }),
    ).not.toBeNull();
  });

  it("is null for a dial without a turn", () => {
    expect(
      hardTurnThrottle({
        ...input,
        dial: dial.filter((m) => !m.direction.startsWith("turn")),
        speed: 3,
        isStressed: false,
      }),
    ).toBeNull();
  });
});

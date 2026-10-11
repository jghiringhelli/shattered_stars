/**
 * Zone objectives — capture/hold (X-Wing 2.0 control), sabotage, waypoints /
 * extraction and stealth (avoid detection).
 */

import { describe, expect, it } from "vitest";
import {
  createObjectiveState,
  finalizeObjectiveOnVictory,
  objectiveMarkers,
  objectiveReadout,
  stepObjectiveState,
  type ObjectiveState,
} from "../../../../src/arcade/objectives";
import type { ObjectiveDefinition } from "../../../../src/arcade/objectives/objectiveDefinitions";
import type { ObjectiveShip } from "../../../../src/arcade/objectives/objectiveTypes";
import { frame, ship } from "./frameBuilder";

/** Steps an objective `seconds` times, one second per frame. */
function hold(
  def: ObjectiveDefinition,
  ships: readonly ObjectiveShip[],
  seconds: number,
): ObjectiveState {
  let state = createObjectiveState(def);
  for (let s = 1; s <= seconds; s++) {
    state = stepObjectiveState(
      state,
      frame({ elapsedMs: s * 1000, deltaMs: 1000, ships }),
    );
  }
  return state;
}

describe("capture objective (control zone)", () => {
  const ZONE = {
    id: "z",
    type: "capture" as const,
    description: "Hold the relay",
    at: { x: 0, y: 0 },
    radius: 200,
    holdSeconds: 5,
    enemyHoldFails: true,
  };

  it("scores while the player has more ships in range", () => {
    expect(hold(ZONE, [ship("a")], 5).status).toBe("completed");
  });

  it("does not score while contested by equal weight", () => {
    const state = hold(ZONE, [ship("a"), ship("e", { side: "enemy" })], 5);
    expect(state.status).toBe("active");
    expect(objectiveMarkers(state)[0]!.controller).toBe("contested");
  });

  it("counts a medium/large ship double", () => {
    const enemies = [
      ship("e1", { side: "enemy" }),
      ship("e2", { side: "enemy", x: 10 }),
    ];
    const heavy = ship("h", { weight: 2 });
    const state = hold(
      ZONE,
      [heavy, ...enemies, ship("e3", { side: "enemy", x: 999 })],
      1,
    );
    expect(objectiveMarkers(state)[0]!.controller).toBe("contested");
    const winning = hold(ZONE, [heavy, enemies[0]!], 1);
    expect(objectiveMarkers(winning)[0]!.controller).toBe("player");
  });

  it("ignores ships outside the zone", () => {
    const state = hold(ZONE, [ship("a", { x: 500 })], 5);
    expect(state.status).toBe("active");
    expect(objectiveMarkers(state)[0]!.controller).toBe("none");
  });

  it("fails when the enemy holds it first", () => {
    expect(hold(ZONE, [ship("e", { side: "enemy" })], 5).status).toBe("failed");
  });

  it("reads hold progress as seconds held", () => {
    expect(objectiveReadout(hold(ZONE, [ship("a")], 2)).progressText).toBe(
      "2/5s",
    );
  });
});

describe("sabotage objective", () => {
  const SITE = {
    id: "sab",
    type: "sabotage" as const,
    description: "Plant the charges",
    at: { x: 0, y: 0 },
    radius: 150,
    holdSeconds: 3,
    decayPerSecond: 1,
  };

  it("completes after staying in range long enough", () => {
    expect(hold(SITE, [ship("flag")], 3).status).toBe("completed");
  });

  it("loses progress while nobody is in range", () => {
    let state = hold(SITE, [ship("flag")], 2);
    state = stepObjectiveState(
      state,
      frame({ deltaMs: 1000, ships: [ship("flag", { x: 900 })] }),
    );
    expect(objectiveReadout(state).fraction).toBeCloseTo(1 / 3);
  });
});

describe("waypoints objective", () => {
  const ROUTE = {
    id: "w",
    type: "waypoints" as const,
    description: "Reach the jump point",
    points: [
      { x: 500, y: 0 },
      { x: 1000, y: 0 },
    ],
    radius: 100,
    extraction: true,
  };

  it("advances only when the flagship reaches the current point", () => {
    let state = createObjectiveState(ROUTE);
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 1000 })] }),
    );
    expect(objectiveReadout(state).progressText).toBe("0/2");
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 480 })] }),
    );
    expect(objectiveReadout(state).progressText).toBe("1/2");
    expect(objectiveMarkers(state)[0]).toMatchObject({ kind: "exit", x: 1000 });
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 1000 })] }),
    );
    expect(state.status).toBe("completed");
  });

  it("fails a timed race when the clock runs out", () => {
    const race = { ...ROUTE, timeLimit: 10 };
    const state = stepObjectiveState(
      createObjectiveState(race),
      frame({ elapsedMs: 10_000 }),
    );
    expect(state.status).toBe("failed");
  });
});

describe("stealth objective", () => {
  const SENTRIES = {
    id: "st",
    type: "stealth" as const,
    description: "Stay out of sensor range",
    sentries: [{ x: 0, y: 0 }],
    radius: 300,
    graceSeconds: 2,
    optional: true,
  };

  it("fails once a player ship lingers inside a sentry's range", () => {
    expect(hold(SENTRIES, [ship("flag")], 2).status).toBe("failed");
  });

  it("forgives a brief pass and recovers outside", () => {
    let state = hold(SENTRIES, [ship("flag")], 1);
    state = stepObjectiveState(
      state,
      frame({ deltaMs: 1000, ships: [ship("flag", { x: 2000 })] }),
    );
    expect(state.status).toBe("active");
    expect(objectiveMarkers(state)[0]!.progress).toBe(0);
  });

  it("completes when the mission is won undetected", () => {
    const state = finalizeObjectiveOnVictory(createObjectiveState(SENTRIES));
    expect(state.status).toBe("completed");
  });
});

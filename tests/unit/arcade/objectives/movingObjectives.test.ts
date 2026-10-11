/**
 * Moving objective entities — escort convoys and fleeing assassination
 * targets.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_ESCORT_TARGETS,
  createObjectiveState,
  objectiveMarkers,
  objectivePoses,
  objectiveReadout,
  objectiveSpawns,
  stepObjectiveState,
  type ObjectiveState,
} from "../../../../src/arcade/objectives";
import type { EscortDefinition } from "../../../../src/arcade/objectives/objectiveDefinitions";
import type { ObjectiveFrame } from "../../../../src/arcade/objectives/objectiveTypes";
import { destroyed, frame, ship } from "./frameBuilder";

const ESCORT: EscortDefinition = {
  id: "convoy",
  type: "escort",
  description: "Escort the convoy",
  path: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ],
  speed: 100,
  transports: { shipId: "confed_pelican", count: 2 },
  maxLosses: 0,
};

/** Every transport of the escort, alive, at the poses the model imposes. */
function aliveTransports(state: ObjectiveState): ObjectiveFrame["ships"] {
  return objectivePoses(state).map((pose) =>
    ship(pose.id, { x: pose.x, y: pose.y }),
  );
}

describe("escort objective", () => {
  it("spawns its transports as scripted player-side ships on the path", () => {
    const spawns = objectiveSpawns(ESCORT);
    expect(spawns).toHaveLength(2);
    expect(spawns.every((s) => s.scripted && s.side === "player")).toBe(true);
    expect(spawns.every((s) => s.y === 0)).toBe(true);
  });

  it(`never fields more than ${MAX_ESCORT_TARGETS} critical transports`, () => {
    const big = { ...ESCORT, transports: { shipId: "x", count: 7 } };
    expect(objectiveSpawns(big)).toHaveLength(MAX_ESCORT_TARGETS);
  });

  it("moves the transports along the path at its speed", () => {
    let state = createObjectiveState(ESCORT);
    const before = objectivePoses(state)[0]!;
    state = stepObjectiveState(
      state,
      frame({ deltaMs: 1000, ships: aliveTransports(state) }),
    );
    const after = objectivePoses(state)[0]!;
    expect(after.x - before.x).toBeCloseTo(100);
    expect(after.angle).toBeCloseTo(90);
  });

  it("fails as soon as more transports are lost than allowed", () => {
    const state = stepObjectiveState(
      createObjectiveState(ESCORT),
      frame({ events: [destroyed("convoy_t0", "player")] }),
    );
    expect(state.status).toBe("failed");
  });

  it("tolerates losses within maxLosses and completes on arrival", () => {
    let state = createObjectiveState({ ...ESCORT, maxLosses: 1 });
    state = stepObjectiveState(
      state,
      frame({ events: [destroyed("convoy_t1", "player")] }),
    );
    expect(state.status).toBe("active");
    for (let i = 0; i < 12 && state.status === "active"; i++) {
      state = stepObjectiveState(
        state,
        frame({ deltaMs: 1000, ships: aliveTransports(state) }),
      );
    }
    expect(state.status).toBe("completed");
  });

  it("shows each transport's hull (and losses) on the tracker", () => {
    let state = createObjectiveState({ ...ESCORT, maxLosses: 1 });
    state = stepObjectiveState(
      state,
      frame({
        ships: [ship("convoy_t0", { hull: 50, maxHull: 100 })],
        events: [destroyed("convoy_t1", "player")],
      }),
    );
    expect(objectiveReadout(state).progressText).toBe("50% · LOST");
  });

  it("marks the convoy's destination", () => {
    const markers = objectiveMarkers(createObjectiveState(ESCORT));
    expect(markers[0]).toMatchObject({ kind: "exit", x: 1000, y: 0 });
  });
});

describe("assassinate objective", () => {
  const TARGET = {
    id: "hit",
    type: "assassinate" as const,
    description: "Destroy Commander Phoenix",
    targetShipId: "confed_hawk",
    at: { x: 500, y: 0 },
    fleePath: [{ x: 500, y: -400 }],
    fleeSpeed: 200,
    fleeAtHullFraction: 0.5,
  };

  it("spawns its named target as an enemy flown by a pilot", () => {
    const [target] = objectiveSpawns(TARGET);
    expect(target).toMatchObject({
      id: "hit_target",
      side: "enemy",
      scripted: false,
    });
    expect(target!.tags).toContain("assassination_target");
  });

  it("completes when the target is destroyed", () => {
    const state = stepObjectiveState(
      createObjectiveState(TARGET),
      frame({ events: [destroyed("hit_target")] }),
    );
    expect(state.status).toBe("completed");
  });

  it("flees once badly hurt, then fails when it escapes", () => {
    let state = createObjectiveState(TARGET);
    expect(objectivePoses(state)).toHaveLength(0);
    const hurt = ship("hit_target", {
      side: "enemy",
      x: 500,
      y: 0,
      hull: 40,
      maxHull: 100,
    });
    state = stepObjectiveState(state, frame({ ships: [hurt] }));
    expect(objectivePoses(state)).toHaveLength(1);
    expect(objectiveReadout(state).progressText).toBe("FLEEING");
    for (let i = 0; i < 5; i++) {
      const pose = objectivePoses(state)[0]!;
      state = stepObjectiveState(
        state,
        frame({ deltaMs: 1000, ships: [{ ...hurt, x: pose.x, y: pose.y }] }),
      );
    }
    expect(state.status).toBe("failed");
  });
});

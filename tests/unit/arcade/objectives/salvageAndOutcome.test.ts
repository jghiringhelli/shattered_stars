/**
 * Salvage objective (X-Wing 2.0 Salvage Mission) and mission-level outcome
 * of an objective set.
 */

import { describe, expect, it } from "vitest";
import {
  createObjectiveState,
  missionOutcome,
  objectiveMarkers,
  stepObjectiveState,
  type ObjectiveState,
} from "../../../../src/arcade/objectives";
import type { SalvageDefinition } from "../../../../src/arcade/objectives/objectiveDefinitions";
import { destroyed, frame, ship } from "./frameBuilder";

const SALVAGE: SalvageDefinition = {
  id: "loot",
  type: "salvage",
  description: "Recover the cargo",
  crates: [{ x: 0, y: 0 }],
  dropZone: { x: 1000, y: 0 },
  required: 1,
  pickupRadius: 50,
  dropRadius: 120,
};

/** The crate marker of the state. */
function crate(state: ObjectiveState): { x: number; y: number } {
  return objectiveMarkers(state).find((m) => m.kind === "crate")!;
}

describe("salvage objective", () => {
  it("is picked up by an unstressed player ship at range", () => {
    let state = createObjectiveState(SALVAGE);
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 10 })] }),
    );
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 400 })] }),
    );
    expect(crate(state).x).toBe(400);
  });

  it("cannot be picked up by a stressed ship", () => {
    let state = createObjectiveState(SALVAGE);
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 10, stressed: true })] }),
    );
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 400 })] }),
    );
    expect(crate(state).x).toBe(0);
  });

  it("drops where the carrier boosts or barrel rolls", () => {
    let state = createObjectiveState(SALVAGE);
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 10 })] }),
    );
    state = stepObjectiveState(
      state,
      frame({
        ships: [ship("flag", { x: 300 })],
        events: [{ kind: "evasive", shipId: "flag" }],
      }),
    );
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 700, stressed: true })] }),
    );
    expect(crate(state).x).toBe(300);
  });

  it("drops when the carrier is destroyed", () => {
    let state = createObjectiveState(SALVAGE);
    state = stepObjectiveState(state, frame({ ships: [ship("w", { x: 10 })] }));
    state = stepObjectiveState(
      state,
      frame({
        ships: [],
        events: [{ ...destroyed("w", "player"), x: 222, y: 5 } as const],
      }),
    );
    expect(crate(state)).toMatchObject({ x: 222, y: 5 });
  });

  it("completes when enough crates reach the drop zone", () => {
    let state = createObjectiveState(SALVAGE);
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 10 })] }),
    );
    state = stepObjectiveState(
      state,
      frame({ ships: [ship("flag", { x: 950 })] }),
    );
    expect(state.status).toBe("completed");
  });
});

describe("missionOutcome", () => {
  const goal = createObjectiveState({
    id: "k",
    type: "eliminate",
    description: "Kill",
    count: 1,
  });
  const bonus = createObjectiveState({
    id: "b",
    type: "protect",
    description: "No losses",
    tag: "squad",
    optional: true,
  });

  it("is ongoing while a required goal is active", () => {
    expect(missionOutcome([goal, bonus])).toBe("ongoing");
  });

  it("is a victory when every required goal is complete (constraints holding)", () => {
    const done = stepObjectiveState(goal, frame({ events: [destroyed("e")] }));
    const guard = createObjectiveState({
      id: "g",
      type: "protect",
      description: "Keep the VIP alive",
      tag: "vip",
    });
    expect(missionOutcome([done, guard, bonus])).toBe("victory");
  });

  it("is a defeat when any required objective fails, not a bonus", () => {
    const lostBonus = { ...bonus, status: "failed" as const };
    expect(missionOutcome([goal, lostBonus])).toBe("ongoing");
    expect(missionOutcome([{ ...goal, status: "failed" }])).toBe("defeat");
  });

  it("keeps a hidden required goal blocking victory", () => {
    const done = stepObjectiveState(goal, frame({ events: [destroyed("e")] }));
    const hidden = createObjectiveState({
      id: "h",
      type: "eliminate",
      description: "Ambush",
      count: 1,
      hidden: true,
    });
    expect(missionOutcome([done, hidden])).toBe("ongoing");
  });
});

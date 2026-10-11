/**
 * Basic objective models — eliminate, survive, defend, protect, deadlines and
 * hidden objectives.
 */

import { describe, expect, it } from "vitest";
import {
  createObjectiveState,
  finalizeObjectiveOnVictory,
  objectiveReadout,
  objectiveSpawns,
  revealObjectiveState,
  stepObjectiveState,
} from "../../../../src/arcade/objectives";
import { destroyed, frame, ship } from "./frameBuilder";

describe("eliminate objective", () => {
  it("completes once `count` enemies are destroyed (not the target name)", () => {
    let state = createObjectiveState({
      id: "k",
      type: "eliminate",
      description: "Destroy",
      count: 2,
      target: "Transport Alpha",
    });
    state = stepObjectiveState(state, frame({ events: [destroyed("e1")] }));
    expect(state.status).toBe("active");
    expect(objectiveReadout(state).progressText).toBe("1/2");
    state = stepObjectiveState(state, frame({ events: [destroyed("e2")] }));
    expect(state.status).toBe("completed");
  });

  it("only counts enemies carrying its tag", () => {
    let state = createObjectiveState({
      id: "k",
      type: "eliminate",
      description: "Kill the boss",
      count: 1,
      tag: "boss",
    });
    state = stepObjectiveState(state, frame({ events: [destroyed("e1")] }));
    expect(state.status).toBe("active");
    state = stepObjectiveState(
      state,
      frame({ events: [destroyed("b", "enemy", ["boss"])] }),
    );
    expect(state.status).toBe("completed");
  });

  it("ignores player losses", () => {
    let state = createObjectiveState({
      id: "k",
      type: "eliminate",
      description: "Destroy",
      count: 1,
    });
    state = stepObjectiveState(
      state,
      frame({ events: [destroyed("p", "player")] }),
    );
    expect(state.status).toBe("active");
  });
});

describe("survive objective", () => {
  const def = {
    id: "s",
    type: "survive" as const,
    description: "Hold out",
    timeLimit: 10,
  };

  it("completes after its time limit with a player ship alive", () => {
    let state = createObjectiveState(def);
    state = stepObjectiveState(state, frame({ elapsedMs: 9_000 }));
    expect(state.status).toBe("active");
    expect(objectiveReadout(state).progressText).toBe("1s");
    state = stepObjectiveState(state, frame({ elapsedMs: 10_000 }));
    expect(state.status).toBe("completed");
  });

  it("fails when the time runs out with no player ship alive", () => {
    const state = stepObjectiveState(
      createObjectiveState(def),
      frame({ elapsedMs: 10_000, ships: [] }),
    );
    expect(state.status).toBe("failed");
  });
});

describe("defend objective", () => {
  const def = {
    id: "d",
    type: "defend" as const,
    description: "Protect the outpost",
    at: { x: 100, y: 100 },
    stationShipId: "terran_bastion",
    timeLimit: 30,
  };

  it("spawns one scripted, player-side station at its point", () => {
    const [station] = objectiveSpawns(def);
    expect(station).toMatchObject({
      id: "d_station",
      side: "player",
      x: 100,
      y: 100,
      scripted: true,
    });
  });

  it("fails when the station is destroyed", () => {
    const state = stepObjectiveState(
      createObjectiveState(def),
      frame({ events: [destroyed("d_station", "player")] }),
    );
    expect(state.status).toBe("failed");
  });

  it("completes when the station survives the timer", () => {
    const station = ship("d_station", { hull: 40, maxHull: 100 });
    const state = stepObjectiveState(
      createObjectiveState(def),
      frame({ elapsedMs: 30_000, ships: [ship("flag"), station] }),
    );
    expect(state.status).toBe("completed");
  });

  it("reads the station's hull on the tracker", () => {
    const station = ship("d_station", { hull: 40, maxHull: 100 });
    const state = stepObjectiveState(
      createObjectiveState(def),
      frame({ elapsedMs: 5_000, ships: [station] }),
    );
    expect(objectiveReadout(state).progressText).toContain("40%");
  });

  it("without a timer it is a constraint that completes on victory", () => {
    const { timeLimit: _ignored, ...untimed } = def;
    const state = finalizeObjectiveOnVictory(createObjectiveState(untimed));
    expect(state.status).toBe("completed");
  });
});

describe("protect objective", () => {
  const def = {
    id: "p",
    type: "protect" as const,
    description: "Keep your wingman alive",
    tag: "wingman",
    optional: true,
  };

  it("fails when a ship with its tag is destroyed", () => {
    const state = stepObjectiveState(
      createObjectiveState(def),
      frame({ events: [destroyed("w", "player", ["wingman"])] }),
    );
    expect(state.status).toBe("failed");
  });

  it("completes on victory when nobody tagged was lost", () => {
    const state = finalizeObjectiveOnVictory(createObjectiveState(def));
    expect(state.status).toBe("completed");
  });
});

describe("deadlines and hidden objectives", () => {
  it("fails a non-timed kind still active at its deadline", () => {
    const state = stepObjectiveState(
      createObjectiveState({
        id: "k",
        type: "eliminate",
        description: "Fast kill",
        count: 1,
        timeLimit: 5,
      }),
      frame({ elapsedMs: 5_000 }),
    );
    expect(state.status).toBe("failed");
  });

  it("does not step a hidden objective until revealed", () => {
    const hidden = createObjectiveState({
      id: "k",
      type: "eliminate",
      description: "Ambush",
      count: 1,
      hidden: true,
    });
    const stepped = stepObjectiveState(
      hidden,
      frame({ events: [destroyed("e")] }),
    );
    expect(stepped.status).toBe("active");
    const revealed = revealObjectiveState(stepped);
    expect(revealed.hidden).toBe(false);
    expect(
      stepObjectiveState(revealed, frame({ events: [destroyed("e")] })).status,
    ).toBe("completed");
  });
});

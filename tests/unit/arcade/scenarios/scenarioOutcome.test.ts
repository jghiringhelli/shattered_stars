import { describe, expect, it } from "vitest";
import {
  decideOutcome,
  leaderByPoints,
  totalPoints,
  type OutcomeInput,
  type SidePoints,
} from "../../../../src/arcade/scenarios";

const pts = (objective: number, destruction: number): SidePoints => ({
  objective,
  destruction,
});

function input(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    points: { player: pts(0, 0), enemy: pts(0, 0) },
    threshold: 20,
    elapsedMs: 10_000,
    timeLimitMs: 300_000,
    alive: { player: true, enemy: true },
    rounds: 3,
    ...overrides,
  };
}

describe("totalPoints / leaderByPoints", () => {
  it("adds objective and destruction points", () => {
    expect(totalPoints(pts(7, 5))).toBe(12);
  });

  it("the higher total leads", () => {
    expect(leaderByPoints({ player: pts(5, 5), enemy: pts(9, 0) })).toBe(
      "player",
    );
  });

  it("breaks a tied total by destruction points", () => {
    expect(leaderByPoints({ player: pts(8, 2), enemy: pts(4, 6) })).toBe(
      "enemy",
    );
  });

  it("is a draw when total and destruction tie", () => {
    expect(leaderByPoints({ player: pts(4, 3), enemy: pts(4, 3) })).toBe(
      "draw",
    );
  });
});

describe("decideOutcome", () => {
  it("keeps playing below the threshold, with both sides alive, before the bell", () => {
    expect(decideOutcome(input())).toBeNull();
  });

  it("the first side to reach the threshold wins", () => {
    const result = decideOutcome(
      input({ points: { player: pts(15, 5), enemy: pts(12, 0) } }),
    );
    expect(result).toMatchObject({
      winner: "player",
      reason: "threshold",
      rounds: 3,
    });
  });

  it("both reaching the threshold together: the higher total wins", () => {
    const result = decideOutcome(
      input({ points: { player: pts(20, 0), enemy: pts(18, 4) } }),
    );
    expect(result).toMatchObject({ winner: "enemy", reason: "threshold" });
  });

  it("both reaching the same total: destruction points break the tie", () => {
    const result = decideOutcome(
      input({ points: { player: pts(15, 6), enemy: pts(19, 2) } }),
    );
    expect(result).toMatchObject({ winner: "player", reason: "threshold" });
  });

  it("a side with no ships left loses", () => {
    const result = decideOutcome(
      input({
        points: { player: pts(0, 0), enemy: pts(10, 0) },
        alive: { player: true, enemy: false },
      }),
    );
    expect(result).toMatchObject({ winner: "player", reason: "annihilation" });
  });

  it("a mutual wipe-out goes to the points", () => {
    const result = decideOutcome(
      input({
        points: { player: pts(3, 0), enemy: pts(1, 0) },
        alive: { player: false, enemy: false },
      }),
    );
    expect(result).toMatchObject({ winner: "player", reason: "annihilation" });
  });

  it("at the time limit the higher total wins", () => {
    const result = decideOutcome(
      input({
        elapsedMs: 300_000,
        points: { player: pts(4, 0), enemy: pts(6, 0) },
      }),
    );
    expect(result).toMatchObject({ winner: "enemy", reason: "time" });
  });

  it("at the time limit a dead heat is a draw", () => {
    const result = decideOutcome(input({ elapsedMs: 300_000 }));
    expect(result).toMatchObject({ winner: "draw", reason: "time" });
  });
});

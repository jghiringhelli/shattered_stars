import { describe, expect, it } from "vitest";
import {
  decideReinforcedOutcome,
  type SideStanding,
} from "../../../../src/arcade/reinforcements/reinforcementOutcome";

const side = (exhausted: boolean, destroyedPoints: number): SideStanding => ({
  exhausted,
  destroyedPoints,
});

const LIMIT = 180_000;

describe("reinforced match outcome", () => {
  it("goes on while both sides can field ships and time remains", () => {
    expect(
      decideReinforcedOutcome({
        standings: { player: side(false, 300), enemy: side(false, 100) },
        elapsedMs: 60_000,
        timeLimitMs: LIMIT,
      }),
    ).toBeNull();
  });

  it("the side whose pool is exhausted loses", () => {
    const result = decideReinforcedOutcome({
      standings: { player: side(false, 100), enemy: side(true, 900) },
      elapsedMs: 90_000,
      timeLimitMs: LIMIT,
    });
    expect(result).toEqual({
      winner: "player",
      reason: "exhaustion",
      elapsedMs: 90_000,
    });
    expect(
      decideReinforcedOutcome({
        standings: { player: side(true, 900), enemy: side(false, 0) },
        elapsedMs: 1,
        timeLimitMs: LIMIT,
      })?.winner,
    ).toBe("enemy");
  });

  it("both exhausted at once: destroyed points decide", () => {
    const result = decideReinforcedOutcome({
      standings: { player: side(true, 500), enemy: side(true, 400) },
      elapsedMs: 100_000,
      timeLimitMs: LIMIT,
    });
    expect(result?.winner).toBe("player");
    expect(result?.reason).toBe("exhaustion");
  });

  it("at the time limit the side that destroyed more points wins", () => {
    const result = decideReinforcedOutcome({
      standings: { player: side(false, 300), enemy: side(false, 450) },
      elapsedMs: LIMIT,
      timeLimitMs: LIMIT,
    });
    expect(result).toEqual({
      winner: "enemy",
      reason: "time",
      elapsedMs: LIMIT,
    });
  });

  it("equal destroyed points at the limit is a draw", () => {
    expect(
      decideReinforcedOutcome({
        standings: { player: side(false, 300), enemy: side(false, 300) },
        elapsedMs: LIMIT + 5,
        timeLimitMs: LIMIT,
      })?.winner,
    ).toBe("draw");
  });
});

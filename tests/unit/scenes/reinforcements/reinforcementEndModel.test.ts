import { describe, expect, it } from "vitest";
import {
  endDetails,
  outcomeLabel,
  reasonLine,
} from "../../../../src/scenes/arcadeBattle/reinforcements/reinforcementEndModel";
import type { CoalitionStats } from "../../../../src/arcade/reinforcements";

const stats = (overrides: Partial<CoalitionStats> = {}): CoalitionStats => ({
  deployed: 9,
  lost: 6,
  lostPoints: 300,
  destroyedPoints: 450,
  remainingPoints: 120,
  ...overrides,
});

describe("reinforcement end screen", () => {
  const both = {
    player: stats(),
    enemy: stats({
      deployed: 11,
      remainingPoints: 0,
      destroyedPoints: 300,
      lostPoints: 450,
    }),
  };

  it("lists ships deployed and pool left per side", () => {
    expect(endDetails(both)).toEqual([
      "SHIPS DEPLOYED  YOU 9  ·  FOE 11",
      "POOL LEFT  YOU 120  ·  FOE 0",
    ]);
  });

  it("explains why the match ended", () => {
    expect(
      reasonLine({ winner: "player", reason: "exhaustion", elapsedMs: 1 }),
    ).toBe("ENEMY POOL EXHAUSTED");
    expect(
      reasonLine({ winner: "enemy", reason: "exhaustion", elapsedMs: 1 }),
    ).toBe("YOUR POOL EXHAUSTED");
    expect(reasonLine({ winner: "draw", reason: "time", elapsedMs: 1 })).toBe(
      "TIME — DESTROYED POINTS DECIDE",
    );
    expect(reasonLine(null)).toBe("");
  });

  it("a draw is labelled DRAW; wins and losses keep the default headline", () => {
    expect(outcomeLabel({ winner: "draw", reason: "time", elapsedMs: 1 })).toBe(
      "DRAW",
    );
    expect(
      outcomeLabel({ winner: "player", reason: "time", elapsedMs: 1 }),
    ).toBeUndefined();
    expect(outcomeLabel(null)).toBeUndefined();
  });
});

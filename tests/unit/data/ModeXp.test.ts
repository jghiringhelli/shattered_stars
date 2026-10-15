/**
 * ModeXp — what a finished match is worth in every mode (PRG-6).
 */

import { describe, it, expect } from "vitest";
import {
  MAX_REWARDED_KILLS,
  MODE_XP_RULES,
  matchXpReward,
} from "../../../src/data/ModeXp";
import { XP_REWARDS } from "../../../src/data/ProgressionData";

const MATCH_MODES = [
  "skirmish",
  "continuous",
  "dogfight",
  "ace_duel",
  "boss_raid",
  "campaign",
  "survival",
];

describe("matchXpReward", () => {
  it("has an XP rule for every battle mode", () => {
    expect(Object.keys(MODE_XP_RULES).sort()).toEqual([...MATCH_MODES].sort());
  });

  it("pays kills plus the win bonus for a skirmish victory", () => {
    const reward = matchXpReward({
      mode: "skirmish",
      outcome: "victory",
      kills: 3,
    });
    expect(reward).toEqual({
      xp: 3 * XP_REWARDS.perKill + XP_REWARDS.win,
      kills: 3,
      won: true,
    });
  });

  it("pays the loss bonus for a defeat and for a draw", () => {
    for (const outcome of ["defeat", "draw"]) {
      const reward = matchXpReward({ mode: "dogfight", outcome, kills: 0 });
      expect(reward).toEqual({ xp: XP_REWARDS.loss, kills: 0, won: false });
    }
  });

  it("pays a campaign mission victory the mission bonus", () => {
    const reward = matchXpReward({
      mode: "campaign",
      outcome: "victory",
      kills: 0,
    });
    expect(reward?.xp).toBe(XP_REWARDS.missionComplete);
  });

  it("pays a boss raid victory the mission bonus", () => {
    const reward = matchXpReward({
      mode: "boss_raid",
      outcome: "victory",
      kills: 2,
    });
    expect(reward?.xp).toBe(
      2 * XP_REWARDS.perKill + XP_REWARDS.missionComplete,
    );
  });

  it("pays a survival node clear less than a standard win", () => {
    const node = matchXpReward({
      mode: "survival",
      outcome: "victory",
      kills: 0,
    });
    expect(node!.xp).toBeGreaterThan(0);
    expect(node!.xp).toBeLessThan(XP_REWARDS.win);
  });

  it("adds the run bonus only when the survival run is won", () => {
    const clear = matchXpReward({
      mode: "survival",
      outcome: "victory",
      kills: 0,
    });
    const won = matchXpReward({
      mode: "survival",
      outcome: "victory",
      kills: 0,
      runWon: true,
    });
    expect(won!.xp - clear!.xp).toBe(XP_REWARDS.missionComplete);
  });

  it("pays nothing for a quit", () => {
    expect(
      matchXpReward({ mode: "skirmish", outcome: "quit", kills: 9 }),
    ).toBeNull();
  });

  it("pays nothing for a mode without XP", () => {
    expect(
      matchXpReward({ mode: "flight_school", outcome: "victory", kills: 0 }),
    ).toBeNull();
  });

  it("never pays negative or fractional kills", () => {
    expect(
      matchXpReward({ mode: "skirmish", outcome: "victory", kills: -4 })?.kills,
    ).toBe(0);
    expect(
      matchXpReward({ mode: "skirmish", outcome: "victory", kills: 2.9 })
        ?.kills,
    ).toBe(2);
    expect(
      matchXpReward({ mode: "skirmish", outcome: "victory", kills: Number.NaN })
        ?.kills,
    ).toBe(0);
  });

  it("stops paying kills past the per-match cap", () => {
    const reward = matchXpReward({
      mode: "survival",
      outcome: "defeat",
      kills: MAX_REWARDED_KILLS + 500,
    });
    expect(reward?.kills).toBe(MAX_REWARDED_KILLS);
  });
});

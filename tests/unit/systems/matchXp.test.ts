/**
 * matchXp — every finished match pays the active profile once; quits,
 * restarts and rematches never double-award (PRG-6).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { awardMatchXp } from "../../../src/systems/matchXp";
import { PlayerProfileManager } from "../../../src/systems/PlayerProfile";
import { MatchTelemetry } from "../../../src/telemetry/matchTelemetry";
import { XP_REWARDS } from "../../../src/data/ProgressionData";

const store = (() => {
  let data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    clear: () => {
      data = {};
    },
  };
})();
vi.stubGlobal("localStorage", store);

function recorder(): MatchTelemetry {
  return new MatchTelemetry({
    emit: () => undefined,
    now: () => 0,
    onResult: (summary) => awardMatchXp(summary),
  });
}

function xp(): number {
  return PlayerProfileManager.getActive().totalXp;
}

describe("awardMatchXp", () => {
  beforeEach(() => store.clear());

  it("pays the active profile for a finished match in any mode", () => {
    for (const mode of ["dogfight", "ace_duel", "boss_raid", "continuous"]) {
      const before = xp();
      const match = recorder();
      match.start(mode);
      match.finish("victory");
      expect(xp() - before).toBeGreaterThanOrEqual(XP_REWARDS.win);
    }
  });

  it("counts the battle in the profile stats", () => {
    const match = recorder();
    match.start("campaign", { mission: "m1" });
    match.finish("victory");
    expect(PlayerProfileManager.getActive().stats.wins).toBe(1);
  });

  it("pays nothing for a quit", () => {
    const match = recorder();
    match.start("skirmish");
    match.finish("quit");
    expect(xp()).toBe(0);
  });

  it("pays once when a finished match is finished again", () => {
    const match = recorder();
    match.start("skirmish");
    match.finish("victory");
    const paid = xp();
    match.finish("victory");
    expect(xp()).toBe(paid);
  });

  it("pays nothing when a rematch replaces an unfinished match", () => {
    const match = recorder();
    match.start("dogfight");
    match.start("dogfight");
    expect(xp()).toBe(0);
    match.finish("defeat");
    expect(xp()).toBe(XP_REWARDS.loss);
  });

  it("pays each node of a survival run, with a bonus for the won run", () => {
    const match = recorder();
    match.start("survival");
    match.finish("victory");
    const afterNode = xp();
    expect(afterNode).toBeGreaterThan(0);
    match.start("survival");
    match.finish("victory", { runWon: true });
    expect(xp() - afterNode).toBeGreaterThan(afterNode);
  });

  it("pays nothing for a mode without XP", () => {
    expect(
      awardMatchXp({ mode: "flight_school", outcome: "victory", kills: 0 }),
    ).toBe(false);
    expect(xp()).toBe(0);
  });
});

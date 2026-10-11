/**
 * Spec: the Daily panel's cards (launch today's run with its fixed setup
 * and best score, the recent daily results, close) and the run request a
 * daily launches with.
 */

import { describe, it, expect } from "vitest";
import { dailyCards } from "../../../../src/ui/survival/dailyViewModels";
import {
  dailyChallengeFor,
  dailyRunRequest,
  type DailyResult,
} from "../../../../src/systems/survival/DailyChallenge";

const daily = dailyChallengeFor(new Date(2026, 9, 11));

function result(key: string, score: number, endedAt: number): DailyResult {
  return {
    key,
    seedCode: "ABC",
    outcome: "defeat",
    score,
    sectorReached: 2,
    kills: 12,
    endedAt,
  };
}

describe("dailyRunRequest", () => {
  it("launches the day's fixed seed, starter and ascension, uncapped", () => {
    expect(dailyRunRequest(daily)).toEqual({
      faction: daily.faction,
      flagshipId: daily.flagshipId,
      loadoutId: null,
      ascension: daily.ascension,
      seed: daily.seed,
      uncappedAscension: true,
    });
  });
});

describe("dailyCards", () => {
  it("opens with the launch card showing the fixed setup and no score yet", () => {
    const [launch] = dailyCards(daily, []);
    expect(launch!.name).toBe("Launch today's run");
    expect(launch!.description).toContain(`Ascension ${daily.ascension}`);
    expect(launch!.description).toContain(daily.seedCode);
    expect(launch!.note).toBe("No score yet");
    expect(launch!.disabled).toBeUndefined();
  });

  it("shows today's best on the launch card", () => {
    const cards = dailyCards(daily, [
      result(daily.key, 1200, 2),
      result(daily.key, 3400, 1),
    ]);
    expect(cards[0]!.note).toBe("Best 3,400");
  });

  it("lists recent results read-only and ends with Close", () => {
    const cards = dailyCards(daily, [
      result("2026-10-10", 900, 2),
      result("2026-10-09", 4100, 1),
    ]);
    expect(cards.map((c) => c.name)).toEqual([
      "Launch today's run",
      "2026-10-10 · Defeat",
      "2026-10-09 · Defeat",
      "Close",
    ]);
    expect(cards[1]!.disabled).toBe(true);
    expect(cards[2]!.note).toBe("4,100 pts");
  });

  it("lists at most five past results", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      result(`2026-10-0${i + 1}`, i, i),
    );
    expect(dailyCards(daily, many).length).toBe(1 + 5 + 1);
  });
});

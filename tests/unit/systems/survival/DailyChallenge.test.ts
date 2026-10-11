/**
 * Spec: the offline Daily challenge (P1-5, local) — a Survival run whose
 * seed, faction, starter flagship and ascension all derive from the local
 * date (same for everyone that day), scored and kept in a local best /
 * history list derived from finished runs.
 */

import { describe, it, expect } from "vitest";
import {
  DAILY_ASCENSIONS,
  DAILY_HISTORY_LIMIT,
  bestForDay,
  dailyChallengeFor,
  dailyScore,
  loadDailyResults,
  localDateKey,
  matchDaily,
  mergeDailyResults,
  saveDailyResults,
  type DailyResult,
} from "../../../../src/systems/survival/DailyChallenge";
import { MemoryStore } from "../../../../src/systems/survival/KeyValueStore";
import { codeToSeed } from "../../../../src/systems/survival/RunRng";
import { SURVIVAL_STARTER_CHOICES } from "../../../../src/data/survival/starters";
import type { RunSummary } from "../../../../src/systems/survival/RunHistory";

const OCT_11 = new Date(2026, 9, 11, 9, 30);
const OCT_12 = new Date(2026, 9, 12, 0, 5);

function summaryFor(
  date: Date,
  overrides: Partial<RunSummary> = {},
): RunSummary {
  const daily = dailyChallengeFor(date);
  return {
    seedCode: daily.seedCode,
    faction: daily.faction,
    flagshipId: daily.flagshipId,
    outcome: "defeat",
    cause: "Destroyed",
    sectorReached: 2,
    sectorsCleared: 1,
    nodesCleared: 6,
    kills: 23,
    relics: [],
    mutations: [],
    salvageEarned: 120,
    ascension: daily.ascension,
    durationMs: 600_000,
    endedAt: date.getTime(),
    chartsEarned: 9,
    ...overrides,
  };
}

describe("dailyChallengeFor", () => {
  it("keys on the local calendar date", () => {
    expect(localDateKey(OCT_11)).toBe("2026-10-11");
    expect(dailyChallengeFor(OCT_11).key).toBe("2026-10-11");
  });

  it("is the same all day and changes the next day", () => {
    const morning = dailyChallengeFor(new Date(2026, 9, 11, 0, 1));
    const night = dailyChallengeFor(new Date(2026, 9, 11, 23, 59));
    expect(night).toEqual(morning);
    expect(dailyChallengeFor(OCT_12).seedCode).not.toBe(morning.seedCode);
  });

  it("fixes a valid seed, a base starter and a rotation ascension", () => {
    const daily = dailyChallengeFor(OCT_11);
    expect(codeToSeed(daily.seedCode)).toBe(daily.seed);
    expect(SURVIVAL_STARTER_CHOICES[daily.faction]).toContain(daily.flagshipId);
    expect(DAILY_ASCENSIONS).toContain(daily.ascension);
  });

  it("rotates factions across a week", () => {
    const factions = new Set(
      Array.from(
        { length: 14 },
        (_, i) => dailyChallengeFor(new Date(2026, 9, 1 + i)).faction,
      ),
    );
    expect(factions.size).toBeGreaterThan(2);
  });
});

describe("dailyScore", () => {
  it("rewards sectors, nodes and kills, and a victory most", () => {
    const loss = summaryFor(OCT_11);
    const win = summaryFor(OCT_11, { outcome: "victory", sectorsCleared: 3 });
    expect(dailyScore(loss)).toBeGreaterThan(0);
    expect(dailyScore(win)).toBeGreaterThan(dailyScore(loss));
    expect(dailyScore({ ...loss, kills: loss.kills + 1 })).toBeGreaterThan(
      dailyScore(loss),
    );
  });

  it("scores an abandoned run as zero", () => {
    expect(dailyScore(summaryFor(OCT_11, { outcome: "abandoned" }))).toBe(0);
  });
});

describe("matchDaily", () => {
  it("recognises a run of that day's challenge", () => {
    expect(matchDaily(summaryFor(OCT_11))?.key).toBe("2026-10-11");
  });

  it("recognises a run that finished after midnight", () => {
    const run = { ...summaryFor(OCT_11), endedAt: OCT_12.getTime() };
    expect(matchDaily(run)?.key).toBe("2026-10-11");
  });

  it("ignores ordinary runs", () => {
    expect(matchDaily(summaryFor(OCT_11, { seedCode: "ZZZZ1" }))).toBeNull();
    expect(
      matchDaily(summaryFor(OCT_11, { flagshipId: "something_else" })),
    ).toBeNull();
  });
});

describe("daily results", () => {
  it("merges finished daily runs from the run history once", () => {
    const history = [
      summaryFor(OCT_12),
      summaryFor(OCT_11),
      summaryFor(OCT_11, { seedCode: "X1" }),
    ];
    const once = mergeDailyResults([], history);
    expect(once.map((r) => r.key)).toEqual(["2026-10-12", "2026-10-11"]);
    expect(mergeDailyResults(once, history)).toEqual(once);
  });

  it("keeps the best score of a day", () => {
    const results = mergeDailyResults(
      [],
      [
        summaryFor(OCT_11, { kills: 5 }),
        summaryFor(OCT_11, { kills: 40, endedAt: OCT_11.getTime() + 1 }),
      ],
    );
    expect(bestForDay(results, "2026-10-11")?.kills).toBe(40);
    expect(bestForDay(results, "2026-10-12")).toBeNull();
  });

  it("caps the stored list", () => {
    const many = Array.from({ length: DAILY_HISTORY_LIMIT + 5 }, (_, i) =>
      summaryFor(new Date(2026, 0, 1 + i)),
    );
    expect(mergeDailyResults([], many).length).toBe(DAILY_HISTORY_LIMIT);
  });

  it("round-trips through storage and tolerates garbage", () => {
    const store = new MemoryStore();
    const results: DailyResult[] = mergeDailyResults([], [summaryFor(OCT_11)]);
    saveDailyResults(store, results);
    expect(loadDailyResults(store)).toEqual(results);
    store.setItem("shattered_stars_survival_daily", "{nope");
    expect(loadDailyResults(store)).toEqual([]);
  });
});

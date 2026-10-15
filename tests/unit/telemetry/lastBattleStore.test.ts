import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../src/systems/keyValueStore";
import {
  LAST_BATTLE_KEY,
  formatDuration,
  lastBattleLine,
  loadLastBattle,
  saveLastBattle,
} from "../../../src/telemetry/lastBattleStore";
import { MatchStatsAccumulator } from "../../../src/telemetry/matchStats";

function summary(outcome = "victory", durationMs = 182_000) {
  const match = new MatchStatsAccumulator("skirmish", () => 0);
  return { ...match.finish(outcome), durationMs };
}

describe("lastBattleStore", () => {
  it("round-trips a finished battle", () => {
    const store = createMemoryStore();
    saveLastBattle(summary(), store, () => 99);
    const record = loadLastBattle(store);
    expect(record?.savedAt).toBe(99);
    expect(record?.summary.outcome).toBe("victory");
  });

  it("formats the footer line", () => {
    const store = createMemoryStore();
    saveLastBattle(summary(), store);
    expect(lastBattleLine(loadLastBattle(store)!)).toBe(
      "Last: Skirmish — Victory 3:02",
    );
  });

  it("reads corrupt JSON as no last battle", () => {
    const store = createMemoryStore();
    store.setItem(LAST_BATTLE_KEY, "{nope");
    expect(loadLastBattle(store)).toBeNull();
  });

  it("rejects a record of another version", () => {
    const store = createMemoryStore();
    store.setItem(
      LAST_BATTLE_KEY,
      JSON.stringify({ version: 99, savedAt: 1, summary: summary() }),
    );
    expect(loadLastBattle(store)).toBeNull();
  });

  it("rejects a record without a usable summary", () => {
    const store = createMemoryStore();
    store.setItem(
      LAST_BATTLE_KEY,
      JSON.stringify({ version: 1, savedAt: 1, summary: { mode: 3 } }),
    );
    expect(loadLastBattle(store)).toBeNull();
  });

  it("formats durations as m:ss", () => {
    expect(formatDuration(59_400)).toBe("0:59");
    expect(formatDuration(600_000)).toBe("10:00");
  });
});

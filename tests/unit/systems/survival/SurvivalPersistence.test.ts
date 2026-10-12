import { describe, it, expect } from "vitest";
import { MemoryStore } from "../../../../src/systems/survival/KeyValueStore";
import {
  clearRun,
  loadRun,
  migrateRun,
  RUN_SAVE_KEY,
  saveRun,
} from "../../../../src/systems/survival/RunPersistence";
import {
  emptyMeta,
  HISTORY_LIMIT,
  loadMeta,
  META_SAVE_KEY,
  migrateMeta,
  purchaseUnlock,
  recordRunEnd,
  saveMeta,
} from "../../../../src/systems/survival/MetaProgression";
import {
  chartsEarned,
  formatDuration,
  summarizeRun,
} from "../../../../src/systems/survival/RunHistory";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

describe("run save / resume", () => {
  it("restores exactly what was saved", () => {
    const store = new MemoryStore();
    const run = atActiveNode(RunBuilder.aRun().build(), "shop");
    saveRun(store, run);
    expect(loadRun(store)).toEqual(run);
  });

  it("resumes the free wingman with its persisted damage", () => {
    const store = new MemoryStore();
    const run = RunBuilder.aRun().build();
    const hurt = {
      ...run,
      escorts: [{ ...run.escorts[0]!, hull: 0.4, shields: 0.25 }],
    };
    saveRun(store, hurt);
    expect(loadRun(store)!.escorts).toEqual(hurt.escorts);
  });

  it("returns null for no save, corrupt JSON, a newer schema or a broken shape", () => {
    const store = new MemoryStore();
    expect(loadRun(store)).toBeNull();
    store.setItem(RUN_SAVE_KEY, "{not json");
    expect(loadRun(store)).toBeNull();
    store.setItem(
      RUN_SAVE_KEY,
      JSON.stringify({ ...RunBuilder.aRun().build(), version: 99 }),
    );
    expect(loadRun(store)).toBeNull();
    store.setItem(
      RUN_SAVE_KEY,
      JSON.stringify({ ...RunBuilder.aRun().build(), flagship: { hull: "x" } }),
    );
    expect(loadRun(store)).toBeNull();
    store.setItem(
      RUN_SAVE_KEY,
      JSON.stringify({ ...RunBuilder.aRun().build(), faction: "klingons" }),
    );
    expect(loadRun(store)).toBeNull();
  });

  it("does not resume a finished run", () => {
    const store = new MemoryStore();
    saveRun(store, RunBuilder.aRun().with({ status: "defeat" }).build());
    expect(loadRun(store)).toBeNull();
  });

  it("rejects saves without a version", () => {
    expect(migrateRun({ seed: 1 })).toBeNull();
  });

  it("clears the save", () => {
    const store = new MemoryStore();
    saveRun(store, RunBuilder.aRun().build());
    clearRun(store);
    expect(store.getItem(RUN_SAVE_KEY)).toBeNull();
  });
});

describe("meta profile", () => {
  it("migrates a v1 profile (charts + unlocks) to v2, dropping unknown unlocks", () => {
    const meta = migrateMeta({
      version: 1,
      charts: 50,
      unlocked: ["war_chest", "bogus"],
    });
    expect(meta).toMatchObject({
      version: 2,
      charts: 50,
      totalChartsEarned: 50,
      unlocked: ["war_chest"],
      maxAscension: 0,
    });
    expect(meta.history).toEqual([]);
  });

  it("falls back to a fresh profile for garbage or future versions", () => {
    expect(migrateMeta("nope")).toEqual(emptyMeta());
    expect(migrateMeta({ version: 9, charts: 5 })).toEqual(emptyMeta());
  });

  it("round-trips through storage", () => {
    const store = new MemoryStore();
    const meta = { ...emptyMeta(), charts: 12, unlocked: ["ace_pack"] };
    saveMeta(store, meta);
    expect(loadMeta(store)).toEqual(meta);
    expect(store.getItem(META_SAVE_KEY)).not.toBeNull();
  });

  it("buys unlocks with Star Charts, honouring prerequisites", () => {
    const rich = { ...emptyMeta(), charts: 200 };
    expect(purchaseUnlock(rich, "twin_wing_package")).toBeNull();
    const one = purchaseUnlock(rich, "wingmate_package")!;
    expect(one.charts).toBe(175);
    expect(purchaseUnlock(one, "wingmate_package")).toBeNull();
    expect(purchaseUnlock(one, "twin_wing_package")!.unlocked).toEqual([
      "wingmate_package",
      "twin_wing_package",
    ]);
    expect(purchaseUnlock(emptyMeta(), "war_chest")).toBeNull();
  });
});

describe("run end", () => {
  const lost = RunBuilder.aRun()
    .with({
      status: "defeat",
      cause: "Shot down",
      stats: {
        kills: 25,
        elitesKilled: 1,
        bossesKilled: 0,
        nodesCleared: 4,
        salvageEarned: 90,
        escortsLost: 0,
        bonusCharts: 3,
        elapsedMs: 125_000,
      },
    })
    .build();

  it("pays Star Charts even on a defeat", () => {
    expect(chartsEarned(lost)).toBe(4 * 2 + 0 + 2 + 3);
  });

  it("pays a victory bonus scaled by ascension", () => {
    const won = {
      ...lost,
      status: "victory" as const,
      sector: 3,
      ascension: 2,
    };
    expect(chartsEarned(won)).toBe(4 * 2 + 3 * 10 + 2 + 3 + 40 + 8);
  });

  it("summarizes cause, sectors, kills, relics, salvage, ascension and time", () => {
    const summary = summarizeRun({ ...lost, relics: ["wing_link"] }, 5000);
    expect(summary).toMatchObject({
      outcome: "defeat",
      cause: "Shot down",
      sectorReached: 1,
      sectorsCleared: 0,
      kills: 25,
      relics: ["wing_link"],
      salvageEarned: 90,
      ascension: 0,
      durationMs: 125_000,
      endedAt: 5000,
    });
    expect(formatDuration(summary.durationMs)).toBe("2:05");
  });

  it("keeps the last 20 runs and unlocks the next ascension on a win at the cap", () => {
    let meta = emptyMeta();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++)
      meta = recordRunEnd(meta, summarizeRun(lost, i));
    expect(meta.history).toHaveLength(HISTORY_LIMIT);
    expect(meta.history[0]!.endedAt).toBe(HISTORY_LIMIT + 4);
    expect(meta.runs).toBe(HISTORY_LIMIT + 5);
    expect(meta.maxAscension).toBe(0);
    const won = recordRunEnd(
      meta,
      summarizeRun({ ...lost, status: "victory", sector: 3 }, 99),
    );
    expect(won.maxAscension).toBe(1);
    expect(won.victories).toBe(1);
  });
});

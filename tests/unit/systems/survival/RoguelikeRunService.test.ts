import { describe, it, expect } from "vitest";
import {
  RoguelikeRunService,
  runServiceOf,
  RUN_SERVICE_KEY,
} from "../../../../src/systems/survival/RoguelikeRunService";
import { MemoryStore } from "../../../../src/systems/survival/KeyValueStore";
import { buyShopItem } from "../../../../src/systems/survival/ShopService";
import { nextOptions } from "../../../../src/systems/survival/SectorMapGenerator";
import { enterNode } from "../../../../src/systems/survival/RunNavigation";

function service(store = new MemoryStore(), start = 1_000) {
  let now = start;
  const svc = new RoguelikeRunService(
    store,
    () => now,
    () => 0.5,
  );
  return { svc, store, advance: (ms: number) => (now += ms) };
}

const REQUEST = {
  faction: "void_corsairs" as const,
  flagshipId: "corsair_fang",
  loadoutId: null,
  ascension: 0,
};

describe("RoguelikeRunService", () => {
  it("starts a seeded run and saves it", () => {
    const { svc } = service();
    const run = svc.startRun({ ...REQUEST, seed: 777 });
    expect(run.seed).toBe(777);
    expect(svc.hasSavedRun()).toBe(true);
  });

  it("resumes the saved run in a fresh service (continue after reload)", () => {
    const { svc, store } = service();
    svc.startRun({ ...REQUEST, seed: 31 });
    const node = nextOptions(svc.run!.map, null)[0]!;
    svc.apply((r) => enterNode(r, node.id));
    const resumed = service(store).svc.resume();
    expect(resumed).toEqual(svc.run);
    expect(resumed!.activeNodeId).toBe(node.id);
  });

  it("enters the first combat node directly for a quick start", () => {
    const { svc } = service();
    const run = svc.startQuickRun(REQUEST);
    expect(run.activeKind).toBe("combat");
    expect(run.activeNodeId).toBe(run.map.rows[0]![0]!.id);
  });

  it("counts map time but not idle time beyond the cap", () => {
    const { svc, advance } = service();
    svc.startRun({ ...REQUEST, seed: 1 });
    advance(30_000);
    svc.apply((r) => r);
    expect(svc.run!.stats.elapsedMs).toBe(30_000);
    advance(60 * 60 * 1000);
    svc.apply((r) => r);
    expect(svc.run!.stats.elapsedMs).toBe(30_000 + 5 * 60 * 1000);
  });

  it("closes a lost run into the history, pays charts and clears the save", () => {
    const { svc } = service();
    svc.startQuickRun(REQUEST);
    const summary = svc.loseBattle("Destroyed", 10_000, 12)!;
    expect(summary.outcome).toBe("defeat");
    expect(svc.run).toBeNull();
    expect(svc.hasSavedRun()).toBe(false);
    expect(svc.meta.history).toHaveLength(1);
    expect(svc.meta.charts).toBe(summary.chartsEarned);
    expect(svc.lastSummary).toEqual(summary);
  });

  it("abandons the saved run", () => {
    const { svc } = service();
    svc.startRun(REQUEST);
    expect(svc.abandon()!.outcome).toBe("abandoned");
    expect(svc.hasSavedRun()).toBe(false);
  });

  it("caps the starting ascension at the unlocked level", () => {
    const { svc } = service();
    expect(svc.startRun({ ...REQUEST, ascension: 5 }).ascension).toBe(0);
  });

  it("persists shop purchases", () => {
    const { svc, store } = service();
    svc.startRun({ ...REQUEST, seed: 5 });
    svc.apply((r) => ({ ...r, salvage: 100 }));
    const after = svc.apply((r) => buyShopItem(r, "s1-r2-c0", "reroll") ?? r)!;
    expect(service(store).svc.resume()!.salvage).toBe(after.salvage);
    expect(after.salvage).toBeLessThan(100);
  });

  it("is created once per registry", () => {
    const values = new Map<string, unknown>();
    const registry = {
      get: (k: string) => values.get(k),
      set: (k: string, v: unknown) => values.set(k, v),
    };
    const first = runServiceOf(registry);
    expect(runServiceOf(registry)).toBe(first);
    expect(values.get(RUN_SERVICE_KEY)).toBe(first);
  });
});

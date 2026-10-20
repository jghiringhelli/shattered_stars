import { describe, expect, it } from "vitest";
import { BOOT_ASSETS, shipSpriteAssetById } from "../../../src/assets/assetManifest";
import {
  PREFETCH_CONCURRENCY,
  PREFETCH_MAX_PER_CALL,
  ShipArtPrefetcher,
  planShipArtPrefetch,
} from "../../../src/assets/shipArtPrefetch";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

const shipIds = Object.keys(SHIP_DEFINITIONS);
const never = (): boolean => false;

describe("planShipArtPrefetch", () => {
  it("plans each upcoming ship's sprite once, in first-seen order", () => {
    const [a, b] = shipIds as [string, string];
    const plan = planShipArtPrefetch([b, a, b, a], never);
    expect(plan.map((entry) => entry.key)).toEqual([`ship_${b}`, `ship_${a}`]);
  });

  it("skips sprites already in the texture cache", () => {
    const [a, b] = shipIds as [string, string];
    const plan = planShipArtPrefetch([a, b], (key) => key === `ship_${a}`);
    expect(plan.map((entry) => entry.key)).toEqual([`ship_${b}`]);
  });

  it("skips sprites already requested", () => {
    const [a, b] = shipIds as [string, string];
    const plan = planShipArtPrefetch([a, b], never, new Set([`ship_${b}`]));
    expect(plan.map((entry) => entry.key)).toEqual([`ship_${a}`]);
  });

  it("drops unknown ship ids", () => {
    expect(planShipArtPrefetch(["no_such_ship"], never)).toEqual([]);
  });

  it("caps one call so a huge roster cannot flood the loader", () => {
    expect(planShipArtPrefetch(shipIds, never)).toHaveLength(
      Math.min(PREFETCH_MAX_PER_CALL, shipIds.length),
    );
  });

  it("never plans a boot asset (the first-load budget stays untouched)", () => {
    const bootKeys = new Set(BOOT_ASSETS.map((entry) => entry.key));
    const planned = planShipArtPrefetch(shipIds, never, new Set(), shipIds.length);
    expect(planned.filter((entry) => bootKeys.has(entry.key))).toEqual([]);
  });

  it("uses the same entries the on-demand loader and the cards use", () => {
    const [a] = shipIds as [string];
    expect(planShipArtPrefetch([a], never)[0]).toEqual(shipSpriteAssetById(a));
  });
});

describe("ShipArtPrefetcher", () => {
  function harness() {
    const loaded = new Set<string>();
    const started: string[] = [];
    const settle = new Map<string, () => void>();
    const prefetcher = new ShipArtPrefetcher(
      (key) => loaded.has(key),
      (entry, onSettled) => {
        started.push(entry.key);
        settle.set(entry.key, () => {
          loaded.add(entry.key);
          onSettled();
        });
      },
    );
    return { prefetcher, started, settle, loaded };
  }

  it("downloads only a few sprites at a time and starts the next as each lands", () => {
    const { prefetcher, started, settle } = harness();
    const queued = prefetcher.enqueue(shipIds.slice(0, 8));
    expect(queued).toBe(8);
    expect(started).toHaveLength(PREFETCH_CONCURRENCY);
    settle.get(started[0]!)!();
    expect(started).toHaveLength(PREFETCH_CONCURRENCY + 1);
    expect(prefetcher.pending).toBe(7);
  });

  it("does not request the same ship twice across calls", () => {
    const { prefetcher, started } = harness();
    prefetcher.enqueue(shipIds.slice(0, 2));
    expect(prefetcher.enqueue(shipIds.slice(0, 2))).toBe(0);
    expect(started).toHaveLength(2);
  });

  it("keeps going when a sprite fails to load (the settle callback also covers errors)", () => {
    const { prefetcher, started, settle } = harness();
    prefetcher.enqueue(shipIds.slice(0, 5));
    for (let i = 0; i < started.length; i++) settle.get(started[i]!)!();
    expect(started).toHaveLength(5);
    expect(prefetcher.pending).toBe(0);
  });
});

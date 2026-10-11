import { describe, it, expect } from "vitest";
import {
  DRONES_PER_SORTIE,
  MAX_CONCURRENT_DRONES,
  MIN_DRONE_BUDGET,
  SORTIE_COOLDOWN_MS,
  RepairDronePool,
} from "../../../../src/rendering/repairDrones/RepairDronePool";
import { DRONE_SORTIE_MS } from "../../../../src/rendering/repairDrones/droneFlight";
import type { RepairEvent } from "../../../../src/arcade/systems/repair/RepairEvents";

const POSITIONS: Record<string, { x: number; y: number }> = {
  carrier: { x: 0, y: 0 },
  ally: { x: 200, y: 0 },
  wing: { x: 400, y: 0 },
};

/**
 * Position lookup for the test fleet.
 * @param id - Ship id.
 * @returns Its position, or undefined.
 */
const positionOf = (id: string) => POSITIONS[id];

/**
 * A repair event.
 * @param over - Field overrides.
 * @returns The event.
 */
function repair(over: Partial<RepairEvent> = {}): RepairEvent {
  return {
    shipId: "ally",
    kind: "hull",
    amount: 1,
    sourceShipId: "carrier",
    sourceKind: "aura",
    ...over,
  };
}

/**
 * Number of drones flying.
 * @param pool - The pool.
 * @returns Active drone count.
 */
function flying(pool: RepairDronePool): number {
  return pool.slots().filter((slot) => slot.active).length;
}

describe("RepairDronePool", () => {
  it("sends drones from an allied repair ship to the repaired ship", () => {
    const pool = new RepairDronePool();
    const launched = pool.requestSortie(repair(), 20);
    expect(launched).toBe(DRONES_PER_SORTIE.aura);
    const drone = pool.slots().find((slot) => slot.active)!;
    expect(drone.sourceId).toBe("carrier");
    expect(drone.targetId).toBe("ally");
  });

  it("launches self-repair drones from the ship itself", () => {
    const pool = new RepairDronePool();
    expect(
      pool.requestSortie(
        repair({ sourceShipId: null, sourceKind: "mechanic_crew" }),
        20,
      ),
    ).toBe(2);
    expect(
      pool.requestSortie(
        repair({ shipId: "wing", sourceShipId: null, sourceKind: "astromech" }),
        20,
      ),
    ).toBe(1);
    const sources = pool
      .slots()
      .filter((slot) => slot.active)
      .map((slot) => slot.sourceId === slot.targetId);
    expect(sources.every(Boolean)).toBe(true);
  });

  it("sends no drones for plain shield regeneration", () => {
    const pool = new RepairDronePool();
    expect(
      pool.requestSortie(
        repair({ sourceShipId: null, sourceKind: "self_regen" }),
        20,
      ),
    ).toBe(0);
  });

  it("waits out a cooldown before re-sending to the same ship", () => {
    const pool = new RepairDronePool();
    pool.requestSortie(repair(), 20);
    expect(pool.requestSortie(repair(), 20)).toBe(0);
    pool.step(SORTIE_COOLDOWN_MS, positionOf);
    expect(pool.requestSortie(repair(), 20)).toBe(DRONES_PER_SORTIE.aura);
  });

  it("never flies more drones than the pool holds", () => {
    const pool = new RepairDronePool(3);
    pool.requestSortie(repair(), 20);
    pool.requestSortie(repair({ shipId: "wing" }), 20);
    expect(flying(pool)).toBe(3);
  });

  it("shrinks the drone budget with the performance particle scale", () => {
    const pool = new RepairDronePool();
    pool.setBudgetScale(0);
    expect(pool.budget()).toBe(MIN_DRONE_BUDGET);
    pool.setBudgetScale(1);
    expect(pool.budget()).toBe(MAX_CONCURRENT_DRONES);
  });

  it("frees drones once their sortie is over", () => {
    const pool = new RepairDronePool();
    pool.requestSortie(repair(), 20);
    pool.step(DRONE_SORTIE_MS + 1, positionOf);
    expect(flying(pool)).toBe(0);
  });

  it("moves drones along their flight path each step", () => {
    const pool = new RepairDronePool();
    pool.requestSortie(repair(), 20);
    pool.step(1, positionOf);
    const before = pool.slots().find((slot) => slot.active)!.x;
    pool.step(200, positionOf);
    const after = pool.slots().find((slot) => slot.active)!.x;
    expect(after).toBeGreaterThan(before);
  });

  it("brings drones home when the repaired ship is destroyed", () => {
    const pool = new RepairDronePool();
    pool.requestSortie(repair(), 20);
    pool.step(100, positionOf);
    pool.step(16, (id) => (id === "ally" ? undefined : POSITIONS[id]));
    const drone = pool.slots().find((slot) => slot.active)!;
    expect(drone.phase).toBe("return");
  });

  it("reuses its slots instead of allocating new drones", () => {
    const pool = new RepairDronePool();
    const slotsBefore = pool.slots();
    pool.requestSortie(repair(), 20);
    pool.step(DRONE_SORTIE_MS + SORTIE_COOLDOWN_MS, positionOf);
    pool.requestSortie(repair(), 20);
    expect(pool.slots()).toBe(slotsBefore);
    expect(pool.slots()).toHaveLength(MAX_CONCURRENT_DRONES);
  });
});

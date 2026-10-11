import { describe, it, expect } from "vitest";
import {
  detectRepairs,
  RepairEventError,
  type RepairObservation,
} from "../../../../../src/arcade/systems/repair/RepairEvents";

/**
 * Observation fixture: a ship going from 10 hull / 12 shields to `current`.
 * @param over - Field overrides.
 * @returns A repair observation.
 */
function observation(over: Partial<RepairObservation>): RepairObservation {
  return {
    shipId: "ally",
    previous: { hull: 10, shields: 12 },
    current: { hull: 10, shields: 12 },
    source: { kind: "self_regen", sourceShipId: null },
    ...over,
  };
}

describe("detectRepairs", () => {
  it("emits nothing when nothing grew", () => {
    expect(detectRepairs(observation({}))).toEqual([]);
  });

  it("emits a shield event for the shield gained", () => {
    const events = detectRepairs(
      observation({
        current: { hull: 10, shields: 15 },
        source: { kind: "astromech", sourceShipId: null },
      }),
    );
    expect(events).toEqual([
      {
        shipId: "ally",
        kind: "shield",
        amount: 3,
        sourceShipId: null,
        sourceKind: "astromech",
      },
    ]);
  });

  it("emits a hull event credited to the hull source when one is given", () => {
    const events = detectRepairs(
      observation({
        current: { hull: 11, shields: 12 },
        source: { kind: "astromech", sourceShipId: null },
        hullSource: { kind: "mechanic_crew", sourceShipId: null },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "hull", amount: 1 });
    expect(events[0]?.sourceKind).toBe("mechanic_crew");
  });

  it("emits both a shield and a hull event, shield first", () => {
    const events = detectRepairs(
      observation({
        current: { hull: 12, shields: 13 },
        source: { kind: "aura", sourceShipId: "carrier" },
      }),
    );
    expect(events.map((e) => e.kind)).toEqual(["shield", "hull"]);
    expect(events.every((e) => e.sourceShipId === "carrier")).toBe(true);
  });

  it("ignores losses (damage is not repair)", () => {
    const events = detectRepairs(
      observation({ current: { hull: 4, shields: 0 } }),
    );
    expect(events).toEqual([]);
  });

  it("ignores float noise below the minimum repair amount", () => {
    const events = detectRepairs(
      observation({ current: { hull: 10 + 1e-12, shields: 12 } }),
    );
    expect(events).toEqual([]);
  });

  it("rejects an aura repair that names no source ship", () => {
    expect(() =>
      detectRepairs(
        observation({
          current: { hull: 10, shields: 13 },
          source: { kind: "aura", sourceShipId: null },
        }),
      ),
    ).toThrow(RepairEventError);
  });
});

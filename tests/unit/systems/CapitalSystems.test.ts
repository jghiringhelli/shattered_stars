import { describe, it, expect } from "vitest";
import {
  createCapitalSystems,
  applyCapitalSystemDamage,
  sumSystemsHull,
  isEnginesOffline,
  isBridgeOffline,
  turretDamageMultiplier,
  TURRET_DISABLED_MULTIPLIER,
} from "../../../src/systems/CapitalSystems";

/** Deterministic sequence rng for tests: cycles through the given values. */
function sequenceRng(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("CapitalSystems", () => {
  it("splits total hull across engines/turrets/bridge proportionally", () => {
    const systems = createCapitalSystems(100);
    expect(systems.engines.maxHull).toBe(25);
    expect(systems.turrets.maxHull).toBe(40);
    expect(systems.bridge.maxHull).toBe(35);
    expect(sumSystemsHull(systems)).toBe(100);
  });

  it("every system starts online with full hull", () => {
    const systems = createCapitalSystems(60);
    for (const s of Object.values(systems)) {
      expect(s.disabled).toBe(false);
      expect(s.hull).toBe(s.maxHull);
    }
  });

  it("never assigns a system 0 hull even for a tiny total", () => {
    const systems = createCapitalSystems(1);
    expect(systems.engines.maxHull).toBeGreaterThanOrEqual(1);
    expect(systems.turrets.maxHull).toBeGreaterThanOrEqual(1);
    expect(systems.bridge.maxHull).toBeGreaterThanOrEqual(1);
  });

  it("routes damage to the system chosen by the weighted rng and reduces its hull", () => {
    const systems = createCapitalSystems(100); // engines 25, turrets 40, bridge 35
    // rng=0 always lands on the first candidate in iteration order (engines).
    const result = applyCapitalSystemDamage(systems, 10, sequenceRng([0]));
    expect(result.hitSystemId).toBe("engines");
    expect(result.systems.engines.hull).toBe(15);
    expect(result.justDisabled).toBe(false);
    // Untouched systems are unchanged.
    expect(result.systems.turrets).toEqual(systems.turrets);
    expect(result.systems.bridge).toEqual(systems.bridge);
  });

  it("marks a system disabled exactly when its hull first reaches 0", () => {
    const systems = createCapitalSystems(100);
    const result = applyCapitalSystemDamage(systems, 25, sequenceRng([0]));
    expect(result.systems.engines.hull).toBe(0);
    expect(result.systems.engines.disabled).toBe(true);
    expect(result.justDisabled).toBe(true);
  });

  it("clamps hull at 0 (never negative) on overkill damage", () => {
    const systems = createCapitalSystems(100);
    const result = applyCapitalSystemDamage(systems, 999, sequenceRng([0]));
    expect(result.systems.engines.hull).toBe(0);
  });

  it("does not re-flag justDisabled once a system is already disabled", () => {
    let systems = createCapitalSystems(100);
    systems = applyCapitalSystemDamage(systems, 25, sequenceRng([0])).systems;
    const second = applyCapitalSystemDamage(systems, 5, sequenceRng([0]));
    expect(second.justDisabled).toBe(false);
  });

  it("never routes damage to an already-disabled system", () => {
    let systems = createCapitalSystems(100);
    systems = applyCapitalSystemDamage(systems, 25, sequenceRng([0])).systems; // engines disabled
    // Even with rng always rolling toward the front of the weighted range,
    // engines is excluded, so the hit must land on turrets or bridge.
    const result = applyCapitalSystemDamage(systems, 10, sequenceRng([0]));
    expect(result.hitSystemId).not.toBe("engines");
  });

  it("returns hitSystemId null once every system is disabled", () => {
    let systems = createCapitalSystems(30); // engines 8, turrets 12, bridge 11 approx
    for (let i = 0; i < 10; i++) {
      systems = applyCapitalSystemDamage(
        systems,
        999,
        sequenceRng([0]),
      ).systems;
    }
    const result = applyCapitalSystemDamage(systems, 5, sequenceRng([0]));
    expect(result.hitSystemId).toBeNull();
    expect(sumSystemsHull(result.systems)).toBe(0);
  });

  it("isEnginesOffline / isBridgeOffline reflect each system's disabled flag", () => {
    let systems = createCapitalSystems(100);
    expect(isEnginesOffline(systems)).toBe(false);
    expect(isBridgeOffline(systems)).toBe(false);
    systems = applyCapitalSystemDamage(systems, 999, sequenceRng([0])).systems; // engines
    expect(isEnginesOffline(systems)).toBe(true);
    expect(isBridgeOffline(systems)).toBe(false);
  });

  it("turretDamageMultiplier is 1 while online and halved once turrets are disabled", () => {
    const systems = createCapitalSystems(100);
    expect(turretDamageMultiplier(systems)).toBe(1);
    // Force-disable turrets directly via repeated damage targeted with rng weighting.
    // engines(0.35) turrets(0.35..0.80) bridge(0.80..1.0) of total weight 1.0 combined.
    const disabledTurrets = applyCapitalSystemDamage(
      systems,
      999,
      sequenceRng([0.5]),
    ).systems;
    expect(disabledTurrets.turrets.disabled).toBe(true);
    expect(turretDamageMultiplier(disabledTurrets)).toBe(
      TURRET_DISABLED_MULTIPLIER,
    );
  });
});

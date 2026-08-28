/**
 * Unit tests for WeaponTelemetry — deterministic Monte-Carlo damage sampling.
 */

import { describe, it, expect } from "vitest";
import { createSeededRng } from "../../../src/utils/random";
import {
  sampleLaserDamage,
  sampleOrdnanceDamage,
  sampleTurretDamage,
  profileAllWeapons,
} from "../../../src/simulation/WeaponTelemetry";
import { ORDNANCE_DEFINITIONS } from "../../../src/systems/OrdnanceSystem";
import { TURRET_DEFINITIONS } from "../../../src/systems/TurretSystem";

const SAMPLES = 4000;

describe("sampleLaserDamage", () => {
  it("deals more damage with more attack dice against the same defender", () => {
    const two = sampleLaserDamage(
      2,
      { defenseDice: 2 },
      SAMPLES,
      createSeededRng(7),
    );
    const four = sampleLaserDamage(
      4,
      { defenseDice: 2 },
      SAMPLES,
      createSeededRng(7),
    );
    expect(four.mean).toBeGreaterThan(two.mean);
  });

  it("deals less damage against a higher-agility defender", () => {
    const lowAgi = sampleLaserDamage(
      3,
      { defenseDice: 0 },
      SAMPLES,
      createSeededRng(9),
    );
    const highAgi = sampleLaserDamage(
      3,
      { defenseDice: 3 },
      SAMPLES,
      createSeededRng(9),
    );
    expect(highAgi.mean).toBeLessThan(lowAgi.mean);
  });

  it("never reports negative damage", () => {
    const s = sampleLaserDamage(
      1,
      { defenseDice: 4 },
      SAMPLES,
      createSeededRng(3),
    );
    expect(s.min).toBeGreaterThanOrEqual(0);
    expect(s.mean).toBeGreaterThanOrEqual(0);
  });
});

describe("sampleOrdnanceDamage", () => {
  it("proton torpedoes out-damage ion rockets (more dice + bonus)", () => {
    const torp = sampleOrdnanceDamage(
      ORDNANCE_DEFINITIONS.proton_torpedoes!,
      SAMPLES,
      createSeededRng(11),
    );
    const rocket = sampleOrdnanceDamage(
      ORDNANCE_DEFINITIONS.ion_rockets!,
      SAMPLES,
      createSeededRng(11),
    );
    expect(torp.mean).toBeGreaterThan(rocket.mean);
  });

  it("bonus damage lifts the mean above the raw dice expectation", () => {
    // Concussion missiles: 3 dice (~1.5 expected hits) + 1 bonus on hit.
    const s = sampleOrdnanceDamage(
      ORDNANCE_DEFINITIONS.concussion_missile!,
      SAMPLES,
      createSeededRng(5),
    );
    expect(s.mean).toBeGreaterThan(1.5);
  });
});

describe("sampleTurretDamage", () => {
  it("gains damage from the range-1 bonus die", () => {
    const light = TURRET_DEFINITIONS.light_turret!;
    const atRange1 = sampleTurretDamage(light, 1, SAMPLES, createSeededRng(2));
    const atRange2 = sampleTurretDamage(light, 2, SAMPLES, createSeededRng(2));
    expect(atRange1.mean).toBeGreaterThan(atRange2.mean);
  });
});

describe("profileAllWeapons", () => {
  it("profiles every ordnance and turret weapon", () => {
    const profiles = profileAllWeapons(1000, createSeededRng(1));
    const expected =
      Object.keys(ORDNANCE_DEFINITIONS).length +
      Object.keys(TURRET_DEFINITIONS).length;
    expect(profiles.length).toBe(expected);
  });

  it("is sorted by damage-per-point descending", () => {
    const profiles = profileAllWeapons(1000, createSeededRng(1));
    for (let i = 1; i < profiles.length; i++) {
      expect(profiles[i - 1]!.damagePerPoint).toBeGreaterThanOrEqual(
        profiles[i]!.damagePerPoint,
      );
    }
  });

  it("reports positive point-efficiency for damage weapons", () => {
    const profiles = profileAllWeapons(1000, createSeededRng(1));
    const damageWeapon = profiles.find((p) => p.id === "proton_torpedoes");
    expect(damageWeapon).toBeDefined();
    expect(damageWeapon!.damagePerPoint).toBeGreaterThan(0);
    expect(damageWeapon!.burstDamagePerPoint).toBeGreaterThan(0);
  });
});

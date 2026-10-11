/**
 * Spec: tempo variants for the headless sims — a longer maneuver cycle is
 * modelled by running flight and AI on a "flight clock" (k = engine cycle /
 * variant cycle) while combat timing, shield regen, special cooldowns and
 * pilot reaction stay defined in real milliseconds.
 */

import { describe, it, expect } from "vitest";
import { CYCLE_DURATION_MS } from "../../src/config";
import { HIT_IMMUNITY_MS } from "../../src/arcade/systems/CombatTempo";
import {
  ENGINE_TEMPO,
  ScaledImmunityLedger,
  isEngineTempo,
  resolveTempo,
  scaleControlCooldowns,
} from "../../src/simulation/TempoVariant";
import { createCycleFlight } from "../../src/arcade/systems/CycleFlight";

describe("resolveTempo", () => {
  it("is the identity for the engine tempo", () => {
    const t = resolveTempo(ENGINE_TEMPO);
    expect(t.flightScale).toBe(1);
    expect(t.cycleMs).toBe(CYCLE_DURATION_MS);
    expect(t.attackIntervalMs(0)).toBe(CYCLE_DURATION_MS);
    expect(t.attackIntervalMs(900)).toBe(900);
    expect(t.immunityFlightMs).toBe(HIT_IMMUNITY_MS);
    expect(isEngineTempo(ENGINE_TEMPO)).toBe(true);
  });

  it("slows the flight clock for a longer cycle", () => {
    const t = resolveTempo({ ...ENGINE_TEMPO, cycleMs: 750 });
    expect(t.flightScale).toBeCloseTo(CYCLE_DURATION_MS / 750);
    expect(isEngineTempo({ ...ENGINE_TEMPO, cycleMs: 750 })).toBe(false);
  });

  it("caps attacks at one per (longer) cycle in real ms, expressed on the flight clock", () => {
    const t = resolveTempo({ ...ENGINE_TEMPO, cycleMs: 750 });
    // 750 real ms between attacks = 500 flight ms (one flight-clock cycle).
    expect(t.attackIntervalMs(0)).toBeCloseTo(500);
    expect(t.immunityFlightMs).toBeCloseTo(500);
  });

  it("keeps the attack interval at the engine's 500 ms when fixed", () => {
    const t = resolveTempo({
      ...ENGINE_TEMPO,
      cycleMs: 750,
      attackInterval: "fixed",
    });
    // 500 real ms = 333 flight ms.
    expect(t.attackIntervalMs(0)).toBeCloseTo(500 * (500 / 750));
    expect(t.immunityFlightMs).toBeCloseTo(500 * (500 / 750));
  });

  it("scales pilot reaction so it stays the same in real ms", () => {
    const t = resolveTempo({ ...ENGINE_TEMPO, cycleMs: 625 });
    expect(t.reactionScale(1)).toBeCloseTo(0.8);
    expect(t.reactionScale(0.5)).toBeCloseTo(0.4);
  });
});

describe("scaleControlCooldowns", () => {
  const control = createCycleFlight("confed_falcon", { x: 0, y: 0, angle: 0 })
    .motion.control;

  it("leaves the engine tempo untouched", () => {
    expect(scaleControlCooldowns(control, resolveTempo(ENGINE_TEMPO))).toEqual(
      control,
    );
  });

  it("multiplies special / boost / barrel-roll recharge in real ms", () => {
    const t = resolveTempo({
      ...ENGINE_TEMPO,
      cycleMs: 750,
      specialCooldownMultiplier: 2,
    });
    const scaled = scaleControlCooldowns(control, t);
    const k = 500 / 750;
    expect(scaled.kturnCooldownMax).toBeCloseTo(
      control.kturnCooldownMax * 2 * k,
    );
    expect(scaled.boostCooldownMax).toBeCloseTo(
      control.boostCooldownMax * 2 * k,
    );
    expect(scaled.barrelRollCooldownMax).toBeCloseTo(
      control.barrelRollCooldownMax * 2 * k,
    );
  });
});

describe("ScaledImmunityLedger", () => {
  it("keeps a struck target immune for the configured flight-clock window", () => {
    const ledger = new ScaledImmunityLedger(300);
    ledger.recordHit("a", "b", 1000);
    expect(ledger.isImmune("a", "b", 1299)).toBe(true);
    expect(ledger.isImmune("a", "b", 1300)).toBe(false);
  });
});

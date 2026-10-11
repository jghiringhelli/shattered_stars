/**
 * TempoVariant — what-if tempo settings for the headless sims (never the
 * game's constants): the maneuver cycle length, a multiplier on the special
 * maneuver / boost / barrel-roll recharge, and whether the one-attack-per-
 * cycle cap follows the cycle or stays at the engine's 500 ms.
 *
 * The cycle length is baked into the flight engine (ArcadeControls reads
 * CYCLE_DURATION_MS), so a longer cycle is modelled with a "flight clock":
 * flight, AI and squad orders run on time scaled by k = engine cycle /
 * variant cycle (each cycle keeps its template displacement but takes
 * longer in real time), while everything defined in real milliseconds is
 * converted onto that clock — weapon intervals, hit immunity, shield regen,
 * special recharge and pilot reaction (a human does not react faster when
 * the cycle is longer). Stress accrues per cycle at the variant's length.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS } from "../config";
import {
  HIT_IMMUNITY_MS,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
import type { ShipControlState } from "../core/ArcadeControls";

/** How the attack cap follows a variant cycle. */
export type AttackIntervalMode = "cycle" | "fixed";

/** A tempo to simulate. */
export interface TempoVariant {
  /** Maneuver cycle length (real ms). */
  readonly cycleMs: number;
  /** Multiplier on K-turn/Segnor/Tallon, boost and barrel-roll recharge. */
  readonly specialCooldownMultiplier: number;
  /** "cycle": at most one attack (and hit immunity) per cycle; "fixed": per engine 500 ms. */
  readonly attackInterval: AttackIntervalMode;
}

/** The game as it ships. */
export const ENGINE_TEMPO: TempoVariant = {
  cycleMs: CYCLE_DURATION_MS,
  specialCooldownMultiplier: 1,
  attackInterval: "cycle",
};

/** A variant resolved into flight-clock conversions. */
export interface ResolvedTempo {
  readonly variant: TempoVariant;
  /** Flight-clock ms per real ms (1 for the engine cycle). */
  readonly flightScale: number;
  /** Real cycle length (ms) — the stress accrual window. */
  readonly cycleMs: number;
  /** Hit immunity window on the flight clock (ms). */
  readonly immunityFlightMs: number;
  /**
   * @param weaponCooldownMs - The weapon's own cooldown (real ms).
   * @returns Time to its next attack on the flight clock (ms).
   */
  attackIntervalMs(weaponCooldownMs: number): number;
  /**
   * @param base - A pilot's reaction multiplier (1 = its tier).
   * @returns The multiplier that keeps its reaction time in real ms.
   */
  reactionScale(base: number): number;
}

/**
 * @param variant - The tempo to simulate.
 * @returns Its conversions onto the flight clock.
 */
export function resolveTempo(variant: TempoVariant): ResolvedTempo {
  const k = CYCLE_DURATION_MS / variant.cycleMs;
  const floorMs =
    variant.attackInterval === "cycle" ? variant.cycleMs : CYCLE_DURATION_MS;
  return {
    variant,
    flightScale: k,
    cycleMs: variant.cycleMs,
    immunityFlightMs: floorMs * k,
    attackIntervalMs: (cooldownMs) => Math.max(floorMs, cooldownMs) * k,
    reactionScale: (base) => base * k,
  };
}

/**
 * @param variant - A tempo.
 * @returns True when it is exactly the shipped tempo.
 */
export function isEngineTempo(variant: TempoVariant): boolean {
  return (
    variant.cycleMs === ENGINE_TEMPO.cycleMs &&
    variant.specialCooldownMultiplier === 1 &&
    variant.attackInterval === ENGINE_TEMPO.attackInterval
  );
}

/**
 * Express a ship's action recharge times on the flight clock, scaled by the
 * variant's multiplier (recharge is defined in real ms).
 *
 * @param control - The ship's control state (already equipped).
 * @param tempo - The resolved tempo.
 * @returns The control state with scaled recharge maxima.
 */
export function scaleControlCooldowns(
  control: ShipControlState,
  tempo: ResolvedTempo,
): ShipControlState {
  const factor = tempo.variant.specialCooldownMultiplier * tempo.flightScale;
  if (factor === 1) return control;
  return {
    ...control,
    kturnCooldownMax: control.kturnCooldownMax * factor,
    boostCooldownMax: control.boostCooldownMax * factor,
    barrelRollCooldownMax: control.barrelRollCooldownMax * factor,
  };
}

/**
 * A hit-immunity ledger whose window is not the engine's cycle (a variant
 * on the flight clock).
 */
export class ScaledImmunityLedger extends HitImmunityLedger {
  /** @param immunityMs - Immunity window (flight-clock ms). */
  constructor(private readonly immunityMs: number) {
    super();
  }

  /**
   * @param attackerId - The attacking ship.
   * @param targetId - The target.
   * @param nowMs - Flight-clock time of the hit (ms).
   */
  override recordHit(
    attackerId: string,
    targetId: string,
    nowMs: number,
  ): void {
    super.recordHit(
      attackerId,
      targetId,
      nowMs + this.immunityMs - HIT_IMMUNITY_MS,
    );
  }
}

/**
 * @param tempo - The resolved tempo.
 * @returns The ledger to fight with (the engine's own for the engine cycle).
 */
export function immunityLedgerFor(tempo: ResolvedTempo): HitImmunityLedger {
  return tempo.immunityFlightMs === HIT_IMMUNITY_MS
    ? new HitImmunityLedger()
    : new ScaledImmunityLedger(tempo.immunityFlightMs);
}

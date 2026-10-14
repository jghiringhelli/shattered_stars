/**
 * CreatureEncounterTypes — what builds a creature encounter and what a hit on
 * its body asks and answers. Pure types.
 */

import type { CreatureDefinition } from "../../data/creatures/creatureTypes";
import type { ArenaCircle } from "./CreatureMovement";
/** What builds an encounter. */
export interface CreatureEncounterConfig {
  readonly definition: CreatureDefinition;
  readonly seed: number;
  readonly worldSize: number;
  /** Survival's belt circle (no wrap), or null to wrap across the seam. */
  readonly arena: ArenaCircle | null;
  /** Hull fractions at which the next phase starts. */
  readonly phaseThresholds: readonly number[];
  readonly start: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
}

/** A hit about to land on the creature's ship. */
export interface AbsorbHitInput {
  readonly fromX: number;
  readonly fromY: number;
  /** Damage before part multipliers. */
  readonly damage: number;
  readonly nowMs: number;
  readonly shieldsUp: boolean;
}

/** What the creature's body does to a hit (the object is reused). */
export interface AbsorbHitResult {
  /** Damage the shields / hull should take. */
  damage: number;
  /** Part the hit landed on, or null. */
  partId: string | null;
  /** True when the hit was wasted (phase-shifted). */
  blocked: boolean;
}

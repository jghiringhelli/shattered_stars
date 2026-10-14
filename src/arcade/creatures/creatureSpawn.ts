/**
 * creatureSpawn — what every mode needs to put a creature on the field: its
 * encounter (belt-contained in Survival, seam-wrapping in Campaign, seeded
 * from the battle's seed and a serial) and the ship stats it carries — hit
 * points through the shared durability path, no primary weapon, agility by
 * size class. Shared by the scenes and the headless sims. Pure.
 */

import { creatureDurability } from "../../data/creatures/creatureCatalog";
import type { CreatureDefinition } from "../../data/creatures/creatureTypes";
import { CreatureEncounter } from "./CreatureEncounter";
import { BOSS_PHASE_THRESHOLDS } from "./phaseThresholds";

/** Distance kept between a creature's edge and the belt wall (px). */
export const CREATURE_ARENA_MARGIN_PX = 60;
/** Golden-ratio constant mixing a serial into a seed. */
const SEED_MIX = 0x9e3779b1;

/**
 * @param text - Any text (a mission id).
 * @returns A stable 32-bit seed derived from it.
 */
export function seedFromText(text: string): number {
  let hash = 7;
  for (let i = 0; i < text.length; i++)
    hash = (Math.imul(hash, 31) + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** Where a creature may roam and how its fight is staged. */
export interface EncounterSetup {
  readonly definition: CreatureDefinition;
  /** Battle seed (the plan's combat seed). */
  readonly battleSeed: number;
  /** Unique number per creature of the battle. */
  readonly serial: number;
  readonly worldSize: number;
  /** Survival's belt: the circle it may not leave; null wraps across the seam. */
  readonly belt: {
    readonly x: number;
    readonly y: number;
    readonly safeRadius: number;
  } | null;
  /** Phase count of the fight (1 for adds). */
  readonly phases: number;
  readonly start: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
}

/**
 * @param setup - Creature, seed, world and start.
 * @returns Its encounter.
 */
export function createBattleEncounter(
  setup: EncounterSetup,
): CreatureEncounter {
  const { definition, belt } = setup;
  return new CreatureEncounter({
    definition,
    seed: (setup.battleSeed ^ Math.imul(setup.serial + 1, SEED_MIX)) >>> 0,
    worldSize: setup.worldSize,
    arena: belt
      ? {
          x: belt.x,
          y: belt.y,
          radiusPx:
            belt.safeRadius - definition.radiusPx - CREATURE_ARENA_MARGIN_PX,
        }
      : null,
    phaseThresholds: phaseThresholdsFor(setup.phases),
    start: setup.start,
  });
}

/**
 * @param phases - Phases of the fight.
 * @returns The hull fractions at which the next phase starts.
 */
export function phaseThresholdsFor(phases: number): readonly number[] {
  return BOSS_PHASE_THRESHOLDS[phases] ?? [];
}

/** The ship stats a creature carries. */
export interface CreatureShipStats {
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly radiusPx: number;
  /** Defence dice of the mode's hit roll (small creatures are harder to hit). */
  readonly agilityDice: number;
}

/**
 * @param definition - A creature.
 * @returns Its ship stats (shared durability path).
 */
export function creatureShipStats(
  definition: CreatureDefinition,
): CreatureShipStats {
  const caps = creatureDurability(definition);
  return {
    hull: caps.maxHull,
    maxHull: caps.maxHull,
    shields: caps.maxShields,
    maxShields: caps.maxShields,
    radiusPx: definition.radiusPx,
    agilityDice: definition.sizeClass === "small" ? 1 : 0,
  };
}

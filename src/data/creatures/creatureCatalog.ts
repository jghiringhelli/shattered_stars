/**
 * creatureCatalog — every creature of the game by id, which creature each
 * Survival sector boss is, the shared durability conversion and the texture
 * keys each creature draws with. Pure data lookups.
 */

import { DURABILITY_SCALE } from "../../config";
import { CHOIR_HIVE } from "./choirHive";
import { CINDER_WYRM } from "./cinderWyrm";
import { DEEPMAW } from "./deepmaw";
import { PRUNING_HERALD } from "./pruningHerald";
import { HULK_GNAWER, TIDECELL } from "./standardCreatures";
import { WARDEN_AVATAR } from "./wardenAvatar";
import type { CreatureDefinition } from "./creatureTypes";

/** Parts whose ids start with this are drawn as orbiting pods. */
export const POD_PART_PREFIX = "brood_pod";

/** Every creature, bosses first. */
export const ALL_CREATURES: readonly CreatureDefinition[] = [
  CINDER_WYRM,
  DEEPMAW,
  CHOIR_HIVE,
  PRUNING_HERALD,
  WARDEN_AVATAR,
  TIDECELL,
  HULK_GNAWER,
];

const BY_ID: ReadonlyMap<string, CreatureDefinition> = new Map(
  ALL_CREATURES.map((creature) => [creature.id, creature]),
);

/** The creature of each Survival sector's boss row (index 0 = sector 1). */
export const SURVIVAL_SECTOR_BOSSES: readonly string[] = [
  CINDER_WYRM.id,
  DEEPMAW.id,
  CHOIR_HIVE.id,
];

/** Phases a creature boss fights beyond the plan's boss phases (its enrage). */
export const CREATURE_EXTRA_PHASES = 1;

/**
 * @param creatureId - A creature id.
 * @returns Its definition, or undefined when unknown.
 */
export function findCreature(
  creatureId: string,
): CreatureDefinition | undefined {
  return BY_ID.get(creatureId);
}

/**
 * @param creatureId - A creature id.
 * @returns Its definition.
 * @throws Error when the id is unknown.
 */
export function getCreature(creatureId: string): CreatureDefinition {
  const creature = BY_ID.get(creatureId);
  if (!creature) throw new Error(`Unknown creature "${creatureId}"`);
  return creature;
}

/**
 * @param sector - Survival sector (1-based).
 * @returns The creature boss of that sector's boss row (the last for any sector beyond).
 */
export function survivalBossFor(sector: number): CreatureDefinition {
  const index =
    Math.min(SURVIVAL_SECTOR_BOSSES.length, Math.max(1, sector)) - 1;
  return getCreature(SURVIVAL_SECTOR_BOSSES[index]!);
}

/** A creature's hit points on the real-time scale. */
export interface CreatureDurability {
  readonly maxHull: number;
  readonly maxShields: number;
}

/**
 * The shared durability path: miniature points × DURABILITY_SCALE.
 *
 * @param creature - A creature.
 * @returns Its real-time hull and shields.
 */
export function creatureDurability(
  creature: CreatureDefinition,
): CreatureDurability {
  return {
    maxHull: creature.hullPoints * DURABILITY_SCALE,
    maxShields: creature.shieldPoints * DURABILITY_SCALE,
  };
}

/** Texture keys a creature draws with. */
export interface CreatureTextureKeys {
  readonly body: string;
  /** Present for serpentine bodies. */
  readonly segment: string | null;
  /** Present for hive pods. */
  readonly pod: string | null;
}

/**
 * @param creature - A creature.
 * @returns The texture keys it needs (also the asset-manifest keys).
 */
export function creatureTextureKeys(
  creature: CreatureDefinition,
): CreatureTextureKeys {
  const stem = `creature_${creature.spriteStem}`;
  return {
    body: `${stem}_body`,
    segment: creature.segmentCount > 0 ? `${stem}_segment` : null,
    pod: creature.parts.some((part) => part.id.startsWith(POD_PART_PREFIX))
      ? `${stem}_pod`
      : null,
  };
}

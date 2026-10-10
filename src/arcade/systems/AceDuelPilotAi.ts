/**
 * Ace Duel pilot abilities tied to the maneuver cycle.
 */

/** Shields the regenerative_shields ability restores per maneuver cycle. */
export const REGENERATIVE_SHIELDS_PER_CYCLE = 1;

/**
 * Shields after a maneuver cycle completes: regenerative_shields restores
 * {@link REGENERATIVE_SHIELDS_PER_CYCLE} up to the maximum.
 *
 * @param shields - Current shields.
 * @param maxShields - Shield capacity.
 * @param abilities - The pilot's ability ids.
 * @returns The new shield value.
 */
export function shieldsAfterCycle(
  shields: number,
  maxShields: number,
  abilities: readonly string[],
): number {
  if (!abilities.includes("regenerative_shields")) return shields;
  return Math.min(maxShields, shields + REGENERATIVE_SHIELDS_PER_CYCLE);
}

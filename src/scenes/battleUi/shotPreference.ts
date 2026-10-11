/**
 * shotPreference — which of the targets a ship can shoot right now it
 * shoots: its squad's marked target first (focus fire), then the enemy its
 * pilot is working on, then the nearest.
 *
 * Pure: no Phaser.
 */

/**
 * @param candidateIds - Targets in reach this instant, nearest first.
 * @param preferredIds - Preferences, strongest first (the squad's mark, the
 *   pilot's target); nulls are skipped.
 * @returns The target to shoot, or null when none is in reach.
 */
export function pickShotTarget(
  candidateIds: readonly string[],
  preferredIds: readonly (string | null)[],
): string | null {
  for (const preferred of preferredIds) {
    if (preferred !== null && candidateIds.includes(preferred))
      return preferred;
  }
  return candidateIds[0] ?? null;
}

/**
 * duelRoundOutcome — how a simulated duel round ends and how a series of
 * rounds is summarised (DuelTempoSim).
 *
 * Pure.
 */

/**
 * The round ends the moment a side has no ship left, as in the scenes'
 * checkRoundEnd: a mutual wipe-out (e.g. two decisive torpedoes) goes to
 * side 1, the player's seat.
 *
 * @param ships - Every ship of the round.
 * @returns The winning side, or null while both sides fly.
 */
export function roundWinner(
  ships: readonly { readonly side: 1 | 2; readonly hull: number }[],
): 1 | 2 | null {
  const alive = (side: 1 | 2): boolean =>
    ships.some((ship) => ship.side === side && ship.hull > 0);
  if (!alive(2)) return 1;
  if (!alive(1)) return 2;
  return null;
}

/**
 * Median of the finished rounds' durations.
 *
 * @param results - Simulated rounds.
 * @returns Median duration (ms), or null when every round timed out.
 */
export function medianDurationMs(
  results: readonly { readonly durationMs: number | null }[],
): number | null {
  const sorted = results
    .map((r) => r.durationMs)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

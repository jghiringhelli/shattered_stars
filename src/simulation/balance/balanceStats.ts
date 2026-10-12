/**
 * balanceStats — the statistics of the balance harness: win tallies seen
 * from one side (draws count half), Wilson 95 % intervals, percentiles,
 * and the logit transform used for value-per-point trends.
 *
 * Pure.
 */

/** Two-sided 95 % normal quantile. */
export const Z_95 = 1.96;

/** Wins, losses and draws of one side over a series. */
export interface WinTally {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** A share with its 95 % interval. */
export interface ShareInterval {
  /** Win share: (wins + draws / 2) / games. */
  readonly share: number;
  readonly low: number;
  readonly high: number;
  readonly games: number;
}

/** A tally with nothing in it. */
export const EMPTY_TALLY: WinTally = { wins: 0, losses: 0, draws: 0 };

/**
 * @param a - A tally.
 * @param b - Another.
 * @returns Their sum.
 */
export function addTallies(a: WinTally, b: WinTally): WinTally {
  return {
    wins: a.wins + b.wins,
    losses: a.losses + b.losses,
    draws: a.draws + b.draws,
  };
}

/**
 * @param tally - A tally.
 * @returns The same games seen from the other side.
 */
export function flipTally(tally: WinTally): WinTally {
  return { wins: tally.losses, losses: tally.wins, draws: tally.draws };
}

/**
 * @param tally - A tally.
 * @returns Games played.
 */
export function gamesOf(tally: WinTally): number {
  return tally.wins + tally.losses + tally.draws;
}

/**
 * Win share with its Wilson score interval (draws count half a win).
 * @param tally - A tally.
 * @returns Share and 95 % interval (0.5 [0, 1] when no games).
 */
export function shareInterval(tally: WinTally): ShareInterval {
  const games = gamesOf(tally);
  if (games === 0) return { share: 0.5, low: 0, high: 1, games };
  const share = (tally.wins + tally.draws / 2) / games;
  const z2 = Z_95 * Z_95;
  const centre = (share + z2 / (2 * games)) / (1 + z2 / games);
  const half =
    (Z_95 *
      Math.sqrt((share * (1 - share)) / games + z2 / (4 * games * games))) /
    (1 + z2 / games);
  return {
    share,
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
    games,
  };
}

/**
 * @param values - Numbers.
 * @param fraction - Percentile in [0, 1] (0.5 = median).
 * @returns The nearest-rank percentile (NaN when empty).
 */
export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[rank]!;
}

/** Shares are clamped this far from 0 and 1 before the logit. */
const LOGIT_EPSILON = 0.01;

/**
 * @param share - A probability.
 * @returns Its log-odds (clamped away from ±∞).
 */
export function logit(share: number): number {
  const p = Math.min(1 - LOGIT_EPSILON, Math.max(LOGIT_EPSILON, share));
  return Math.log(p / (1 - p));
}

/**
 * @param x - Log-odds.
 * @returns The probability.
 */
export function inverseLogit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * @param share - A share.
 * @returns It as a whole percentage, e.g. "47%".
 */
export function percent(share: number): string {
  return Number.isFinite(share) ? `${Math.round(share * 100)}%` : "–";
}

/**
 * @param interval - A share and its interval.
 * @returns "47% [40–54]".
 */
export function formatInterval(interval: ShareInterval): string {
  const pct = (x: number): number => Math.round(x * 100);
  return `${pct(interval.share)}% [${pct(interval.low)}–${pct(interval.high)}]`;
}

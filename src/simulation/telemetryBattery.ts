/**
 * telemetryBattery — the shared vocabulary of the headless telemetry
 * battery: one {@link MatchSample} per simulated match whatever sim
 * produced it (duel, skill-arena squads, scenario, survival node), the
 * per-cell summary (length p10 / median / p90, time to first kill, damage
 * per second, hit rate, specials per ship-minute, share decided by
 * timeout) and its markdown row.
 *
 * Pure: no Phaser, no I/O.
 */

import type { BattleResult } from "./skill/ArenaSpec";
import type { DuelTempoResult } from "./DuelTempoSim";
import { DUEL_ROUND_LIMIT_MS } from "./DuelTempoSim";
import type { ScenarioMatch } from "./ScenarioMatchSim";
import type { NodeBattleResult } from "./survival/SurvivalNodeSim";

/** One simulated match, sim-agnostic. */
export interface MatchSample {
  readonly durationMs: number;
  readonly timedOut: boolean;
  readonly firstKillMs: number | null;
  /** Damage dealt by both sides; null when the sim does not track it. */
  readonly damage: number | null;
  readonly shots: number | null;
  readonly hits: number | null;
  readonly specials: number;
  /** Ships whose specials are counted. */
  readonly ships: number;
  /** Side 1 / A / player won. */
  readonly side1Won: boolean;
}

/** A battery cell, summarised. */
export interface CellStats {
  readonly matches: number;
  readonly p10Ms: number;
  readonly medianMs: number;
  readonly p90Ms: number;
  readonly meanMs: number;
  readonly medianFirstKillMs: number;
  /** Both sides' damage per second; NaN when untracked. */
  readonly dps: number;
  /** Hits / shots; NaN when untracked. */
  readonly hitRate: number;
  /** Special actions per ship per minute. */
  readonly specialsPerShipMinute: number;
  readonly timeoutRate: number;
  readonly side1WinRate: number;
}

const MS_PER_MIN = 60_000;
const MS_PER_S = 1000;
const PERCENT = 100;

/**
 * @param round - A duel round.
 * @param ships - Ships in the round.
 * @returns Its sample (a timeout lasts the full round limit).
 */
export function duelSample(round: DuelTempoResult, ships: number): MatchSample {
  return {
    durationMs: round.durationMs ?? DUEL_ROUND_LIMIT_MS,
    timedOut: round.durationMs === null,
    firstKillMs: round.firstKillMs,
    damage: round.damage[1] + round.damage[2],
    shots: round.attacks[1] + round.attacks[2],
    hits: round.hits[1] + round.hits[2],
    specials: round.specialsUsed,
    ships,
    side1Won: round.winner === 1,
  };
}

/**
 * @param result - A skill-arena battle.
 * @param ships - Ships in the battle.
 * @returns Its sample.
 */
export function arenaSample(result: BattleResult, ships: number): MatchSample {
  const { A, B } = result.tallies;
  return {
    durationMs: result.durationMs,
    timedOut: result.endedBy === "timeout",
    firstKillMs: result.firstKillMs,
    damage: A.damage + B.damage,
    shots: A.shots + B.shots,
    hits: A.hits + B.hits,
    specials: result.specialsUsed,
    ships,
    side1Won: result.winner === "A",
  };
}

/**
 * @param match - A scenario match.
 * @param ships - Ships in the match.
 * @returns Its sample ("time" endings count as timeouts).
 */
export function scenarioSample(
  match: ScenarioMatch,
  ships: number,
): MatchSample {
  const { A, B } = match.tallies;
  return {
    durationMs: match.result.elapsedMs,
    timedOut: match.result.reason === "time",
    firstKillMs: match.firstKillMs,
    damage: A.damage + B.damage,
    shots: A.shots + B.shots,
    hits: A.hits + B.hits,
    specials: match.specialsUsed,
    ships,
    side1Won: match.result.winner === "player",
  };
}

/**
 * @param battle - A survival node battle (specials: the player's fleet).
 * @returns Its sample (damage and gunnery are not tracked by the node sim).
 */
export function survivalSample(battle: NodeBattleResult): MatchSample {
  return {
    durationMs: battle.durationMs,
    timedOut: battle.timedOut,
    firstKillMs: battle.firstKillMs,
    damage: null,
    shots: null,
    hits: null,
    specials: battle.specialsUsed,
    ships: battle.playerShips,
    side1Won: battle.won,
  };
}

/**
 * @param samples - A cell's matches.
 * @returns The cell's summary.
 */
export function summarizeCell(samples: readonly MatchSample[]): CellStats {
  const n = Math.max(1, samples.length);
  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const totalMs = durations.reduce((a, b) => a + b, 0);
  const tracked = samples.filter((s) => s.damage !== null);
  const sum = (pick: (s: MatchSample) => number): number =>
    tracked.reduce((acc, s) => acc + pick(s), 0);
  const shipMinutes = samples.reduce(
    (acc, s) => acc + (s.ships * s.durationMs) / MS_PER_MIN,
    0,
  );
  const trackedMs = sum((s) => s.durationMs);
  return {
    matches: samples.length,
    p10Ms: quantile(durations, 0.1),
    medianMs: quantile(durations, 0.5),
    p90Ms: quantile(durations, 0.9),
    meanMs: samples.length > 0 ? totalMs / samples.length : Number.NaN,
    medianFirstKillMs: quantile(
      samples
        .map((s) => s.firstKillMs)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b),
      0.5,
    ),
    dps:
      tracked.length > 0 && trackedMs > 0
        ? sum((s) => s.damage ?? 0) / (trackedMs / MS_PER_S)
        : Number.NaN,
    hitRate:
      sum((s) => s.shots ?? 0) > 0
        ? sum((s) => s.hits ?? 0) / sum((s) => s.shots ?? 0)
        : Number.NaN,
    specialsPerShipMinute:
      shipMinutes > 0
        ? samples.reduce((a, s) => a + s.specials, 0) / shipMinutes
        : 0,
    timeoutRate: samples.filter((s) => s.timedOut).length / n,
    side1WinRate: samples.filter((s) => s.side1Won).length / n,
  };
}

/**
 * @param sorted - Ascending values.
 * @param q - Quantile in [0, 1].
 * @returns Nearest-rank quantile (NaN when empty).
 */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(q * sorted.length) - 1),
  );
  return sorted[index]!;
}

/** Column headers of a battery table. */
export const CELL_HEADER =
  "| Mode | Pairing | n | length p10 / median / p90 | first kill | DPS | hit rate | specials / ship·min | timeout | side-1 wins |";
/** Markdown separator matching {@link CELL_HEADER}. */
export const CELL_SEPARATOR = "|---|---|---|---|---|---|---|---|---|---|";

/**
 * @param mode - Mode label.
 * @param pairing - Tier pairing label.
 * @param s - The cell's stats.
 * @returns One markdown table row.
 */
export function cellRow(mode: string, pairing: string, s: CellStats): string {
  const sec = (ms: number): string =>
    Number.isNaN(ms) ? "—" : `${(ms / MS_PER_S).toFixed(0)}s`;
  const pct = (v: number): string =>
    Number.isNaN(v) ? "—" : `${(v * PERCENT).toFixed(0)}%`;
  return (
    `| ${mode} | ${pairing} | ${s.matches} | ${sec(s.p10Ms)} / ${sec(s.medianMs)} / ${sec(s.p90Ms)} | ` +
    `${sec(s.medianFirstKillMs)} | ${Number.isNaN(s.dps) ? "—" : s.dps.toFixed(2)} | ${pct(s.hitRate)} | ` +
    `${s.specialsPerShipMinute.toFixed(1)} | ${pct(s.timeoutRate)} | ${pct(s.side1WinRate)} |`
  );
}

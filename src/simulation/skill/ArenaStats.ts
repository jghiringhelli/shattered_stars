/**
 * ArenaStats — runs a series of seeded battles and summarises it from one
 * side's point of view: win/draw/loss rates, how battles ended, how long
 * they took, gunnery accuracy and where the hits came from (front, flank,
 * rear of the target).
 *
 * Pure: no Phaser.
 */

import type { ArcPosition } from "../../arcade/ai/AiGeometry";
import { runBattle, type BattleResult, type BattleSpec } from "./SkillArena";
import type { SideId } from "./ArenaCombatState";

/** Gunnery of one side over a series. */
export interface GunnerySummary {
  readonly shots: number;
  readonly hits: number;
  readonly accuracy: number;
  /** Share of hits by attacker position around the target (sums to 1). */
  readonly hitShareByArc: Readonly<Record<ArcPosition, number>>;
  /** Share of shots that were focus fire / crossfire / into covered space. */
  readonly focusFireShare: number;
  readonly crossfireShare: number;
  readonly coveredShare: number;
  /** Share of shots at a target flying with a wingman / at the squad's mark. */
  readonly wingmanTargetShare: number;
  readonly markedShare: number;
}

/** A series of battles seen from one side. */
export interface SeriesSummary {
  readonly battles: number;
  readonly winRate: number;
  readonly drawRate: number;
  readonly lossRate: number;
  /** Share of battles decided by elimination (rest: timeout). */
  readonly eliminationRate: number;
  readonly medianDurationMs: number;
  readonly meanDurationMs: number;
  /** Median duration of battles decided by elimination (NaN when none). */
  readonly medianDecisiveMs: number;
  readonly gunnery: Readonly<Record<SideId, GunnerySummary>>;
}

/** Results of a series plus their summary. */
export interface SeriesRun {
  readonly results: readonly BattleResult[];
  readonly summary: SeriesSummary;
}

/**
 * @param makeSpec - Builds the battle for a seed.
 * @param seeds - Seeds to run.
 * @param perspective - Side whose win rate is reported.
 * @returns Every result and the summary.
 */
export function runSeries(
  makeSpec: (seed: number) => BattleSpec,
  seeds: readonly number[],
  perspective: SideId = "A",
): SeriesRun {
  const results = seeds.map((seed) => runBattle(makeSpec(seed)));
  return { results, summary: summarizeSeries(results, perspective) };
}

/**
 * @param count - Number of seeds.
 * @param base - First seed.
 * @returns Consecutive seeds starting at base.
 */
export function seedRange(count: number, base = 1): number[] {
  return Array.from({ length: count }, (_, i) => base + i);
}

/**
 * @param results - Battles of the series.
 * @param perspective - Side whose win rate is reported.
 * @returns The series summary.
 */
export function summarizeSeries(
  results: readonly BattleResult[],
  perspective: SideId = "A",
): SeriesSummary {
  const n = Math.max(1, results.length);
  const share = (predicate: (r: BattleResult) => boolean): number =>
    results.filter(predicate).length / n;
  const durations = results.map((r) => r.durationMs);
  const decisive = results
    .filter((r) => r.endedBy === "elimination")
    .map((r) => r.durationMs);
  return {
    battles: results.length,
    winRate: share((r) => r.winner === perspective),
    drawRate: share((r) => r.winner === "draw"),
    lossRate: share((r) => r.winner !== perspective && r.winner !== "draw"),
    eliminationRate: share((r) => r.endedBy === "elimination"),
    medianDurationMs: median(durations),
    meanDurationMs: durations.reduce((a, b) => a + b, 0) / n,
    medianDecisiveMs: median(decisive),
    gunnery: { A: gunneryOf(results, "A"), B: gunneryOf(results, "B") },
  };
}

/**
 * @param results - Battles of the series.
 * @param side - Side whose guns are summarised.
 * @returns Shots, hits, accuracy and hit share by arc position.
 */
function gunneryOf(
  results: readonly BattleResult[],
  side: SideId,
): GunnerySummary {
  let shots = 0;
  let hits = 0;
  const teamwork = { focus: 0, cross: 0, covered: 0, wingman: 0, marked: 0 };
  const byArc: Record<ArcPosition, number> = { front: 0, flank: 0, rear: 0 };
  for (const result of results) {
    const tally = result.tallies[side];
    shots += tally.shots;
    hits += tally.hits;
    teamwork.focus += tally.focusFireShots;
    teamwork.cross += tally.crossfireShots;
    teamwork.covered += tally.coveredShots;
    teamwork.wingman += tally.wingmanTargetShots;
    teamwork.marked += tally.markedShots;
    for (const arc of ["front", "flank", "rear"] as const)
      byArc[arc] += tally.hitsByArc[arc];
  }
  const total = Math.max(1, hits);
  const fired = Math.max(1, shots);
  return {
    shots,
    hits,
    accuracy: shots > 0 ? hits / shots : 0,
    hitShareByArc: {
      front: byArc.front / total,
      flank: byArc.flank / total,
      rear: byArc.rear / total,
    },
    focusFireShare: teamwork.focus / fired,
    crossfireShare: teamwork.cross / fired,
    coveredShare: teamwork.covered / fired,
    wingmanTargetShare: teamwork.wingman / fired,
    markedShare: teamwork.marked / fired,
  };
}

/**
 * @param values - Numbers.
 * @returns Their median (NaN when empty).
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

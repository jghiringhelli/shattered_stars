/**
 * Survival roguelite — run summaries for the end screen and the run
 * history (pure): outcome, cause, sectors, kills, relics, salvage,
 * ascension, time, and the Star Charts the run paid out.
 */

import type { FactionId } from "../../config";
import {
  META_PER_ASCENSION,
  META_PER_NODE,
  META_PER_SECTOR,
  META_PER_TEN_KILLS,
  META_VICTORY_BONUS,
} from "../../data/survival/economy";
import { seedToCode } from "./RunRng";
import type { RunState } from "./RunTypes";

/** Kills per Star Chart. */
const KILLS_PER_CHART = 10;

/** How a run ended. */
export type RunOutcome = "victory" | "defeat" | "abandoned";

/** One finished run, as listed in the history. */
export interface RunSummary {
  readonly seedCode: string;
  readonly faction: FactionId;
  readonly flagshipId: string;
  readonly outcome: RunOutcome;
  readonly cause: string;
  readonly sectorReached: number;
  readonly sectorsCleared: number;
  readonly nodesCleared: number;
  readonly kills: number;
  readonly relics: readonly string[];
  readonly mutations: readonly string[];
  readonly salvageEarned: number;
  readonly ascension: number;
  readonly durationMs: number;
  readonly endedAt: number;
  readonly chartsEarned: number;
  /** Escorts lost over the run (absent in history saved before it was tracked). */
  readonly escortsLost?: number;
}

/**
 * @param run - A finished (or abandoned) run.
 * @returns Sectors whose boss the run defeated.
 */
export function sectorsCleared(run: RunState): number {
  return run.status === "victory" ? run.sector : run.sector - 1;
}

/**
 * Star Charts are paid win or lose: per node, per sector cleared, per ten
 * kills, per ascension level, plus a victory bonus and event finds.
 *
 * @param run - A finished run.
 * @returns Charts earned.
 */
export function chartsEarned(run: RunState): number {
  const base =
    run.stats.nodesCleared * META_PER_NODE +
    sectorsCleared(run) * META_PER_SECTOR +
    Math.floor(run.stats.kills / KILLS_PER_CHART) * META_PER_TEN_KILLS +
    run.stats.bonusCharts;
  const victory =
    run.status === "victory"
      ? META_VICTORY_BONUS + run.ascension * META_PER_ASCENSION
      : 0;
  return base + victory;
}

/**
 * @param run - A finished run (status victory, defeat or abandoned).
 * @param endedAt - Wall-clock end (ms since epoch).
 * @returns Its history entry.
 */
export function summarizeRun(run: RunState, endedAt: number): RunSummary {
  const outcome: RunOutcome =
    run.status === "victory"
      ? "victory"
      : run.status === "abandoned"
        ? "abandoned"
        : "defeat";
  return {
    seedCode: seedToCode(run.seed),
    faction: run.faction,
    flagshipId: run.flagship.definitionId,
    outcome,
    cause: run.cause ?? (outcome === "abandoned" ? "Abandoned" : "Unknown"),
    sectorReached: run.sector,
    sectorsCleared: sectorsCleared(run),
    nodesCleared: run.stats.nodesCleared,
    kills: run.stats.kills,
    relics: [...run.relics],
    mutations: Object.values(run.mutations).filter(
      (m): m is string => typeof m === "string",
    ),
    salvageEarned: run.stats.salvageEarned,
    ascension: run.ascension,
    durationMs: run.stats.elapsedMs,
    endedAt,
    chartsEarned: chartsEarned(run),
    escortsLost: run.stats.escortsLost,
  };
}

/**
 * @param ms - A duration.
 * @returns It as "m:ss".
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

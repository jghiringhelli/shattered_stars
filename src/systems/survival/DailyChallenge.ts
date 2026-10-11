/**
 * DailyChallenge — the offline Daily Survival run (P1-5, local half): the
 * seed, faction, starter flagship and ascension all derive from the local
 * calendar date, so the run is the same all day for everyone on any
 * machine. Finished daily runs are recognised in the run history by their
 * seed + starter, scored, and kept in a small local best / history list.
 *
 * Pure apart from the KeyValueStore it is handed.
 */

import type { FactionId } from "../../config";
import { SURVIVAL_STARTER_CHOICES } from "../../data/survival/starters";
import {
  isFiniteNumber,
  isRecord,
  readJson,
  type KeyValueStore,
} from "./KeyValueStore";
import type { RunOutcome, RunSummary } from "./RunHistory";
import { deriveSeed, seedToCode } from "./RunRng";
import type { StartRunRequest } from "./RoguelikeRunService";

/** localStorage key of the daily results list. */
export const DAILY_STORAGE_KEY = "shattered_stars_survival_daily";
/** Daily results kept (newest first). */
export const DAILY_HISTORY_LIMIT = 30;
/** Ascensions a daily rotates through (fixed for the day, unlock-free). */
export const DAILY_ASCENSIONS: readonly number[] = [1, 2, 3];

/** Score weights: a cleared sector, a cleared node, a kill, a victory. */
export const DAILY_SCORE = {
  perSector: 1000,
  perNode: 100,
  perKill: 10,
  victoryBonus: 5000,
} as const;

const DAILY_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const MS_PER_DAY = 86_400_000;

/** One day's challenge. */
export interface DailyChallenge {
  /** Local date, "YYYY-MM-DD". */
  readonly key: string;
  readonly seed: number;
  readonly seedCode: string;
  readonly faction: FactionId;
  readonly flagshipId: string;
  readonly ascension: number;
}

/** One finished daily run, as the local list keeps it. */
export interface DailyResult {
  readonly key: string;
  readonly seedCode: string;
  readonly outcome: RunOutcome;
  readonly score: number;
  readonly sectorReached: number;
  readonly kills: number;
  readonly endedAt: number;
}

/**
 * @param date - A moment.
 * @returns Its local calendar date, "YYYY-MM-DD".
 */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function pick<T>(options: readonly T[], seed: number, part: string): T {
  return options[deriveSeed(seed, part) % options.length]!;
}

/**
 * @param date - Any moment of the day.
 * @returns That day's challenge.
 */
export function dailyChallengeFor(date: Date): DailyChallenge {
  const key = localDateKey(date);
  const seed = deriveSeed(0, "daily", key);
  const faction = pick(DAILY_FACTIONS, seed, "faction");
  return {
    key,
    seed,
    seedCode: seedToCode(seed),
    faction,
    flagshipId: pick(SURVIVAL_STARTER_CHOICES[faction], seed, "starter"),
    ascension: pick(DAILY_ASCENSIONS, seed, "ascension"),
  };
}

/**
 * @param summary - A finished run.
 * @returns Its daily score (0 when abandoned).
 */
export function dailyScore(summary: RunSummary): number {
  if (summary.outcome === "abandoned") return 0;
  return (
    summary.sectorsCleared * DAILY_SCORE.perSector +
    summary.nodesCleared * DAILY_SCORE.perNode +
    summary.kills * DAILY_SCORE.perKill +
    (summary.outcome === "victory" ? DAILY_SCORE.victoryBonus : 0)
  );
}

/**
 * A run counts for a day's challenge when it flew that day's seed and
 * starter; runs that finish after midnight count for the day before.
 *
 * @param summary - A finished run.
 * @returns The challenge it was, or null for an ordinary run.
 */
export function matchDaily(summary: RunSummary): DailyChallenge | null {
  for (const back of [0, 1]) {
    const daily = dailyChallengeFor(
      new Date(summary.endedAt - back * MS_PER_DAY),
    );
    if (
      daily.seedCode === summary.seedCode &&
      daily.faction === summary.faction &&
      daily.flagshipId === summary.flagshipId
    )
      return daily;
  }
  return null;
}

function resultOf(summary: RunSummary, daily: DailyChallenge): DailyResult {
  return {
    key: daily.key,
    seedCode: summary.seedCode,
    outcome: summary.outcome,
    score: dailyScore(summary),
    sectorReached: summary.sectorReached,
    kills: summary.kills,
    endedAt: summary.endedAt,
  };
}

/**
 * Add the daily runs found in the run history (once each), newest first,
 * capped at {@link DAILY_HISTORY_LIMIT}.
 *
 * @param existing - The stored results.
 * @param history - Finished runs (any order).
 * @returns The merged list.
 */
export function mergeDailyResults(
  existing: readonly DailyResult[],
  history: readonly RunSummary[],
): DailyResult[] {
  const id = (r: { readonly endedAt: number; readonly seedCode: string }) =>
    `${r.seedCode}|${r.endedAt}`;
  const byId = new Map(existing.map((r) => [id(r), r]));
  for (const summary of history) {
    const daily = matchDaily(summary);
    if (daily && !byId.has(id(summary)))
      byId.set(id(summary), resultOf(summary, daily));
  }
  return [...byId.values()]
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, DAILY_HISTORY_LIMIT);
}

/**
 * @param results - Daily results.
 * @param key - A day ("YYYY-MM-DD").
 * @returns That day's best result, or null.
 */
export function bestForDay(
  results: readonly DailyResult[],
  key: string,
): DailyResult | null {
  return results
    .filter((r) => r.key === key)
    .reduce<DailyResult | null>(
      (best, r) => (best === null || r.score > best.score ? r : best),
      null,
    );
}

const OUTCOMES: readonly RunOutcome[] = ["victory", "defeat", "abandoned"];

function parseResult(raw: unknown): DailyResult | null {
  if (!isRecord(raw)) return null;
  const { key, seedCode, outcome, score, sectorReached, kills, endedAt } = raw;
  if (typeof key !== "string" || typeof seedCode !== "string") return null;
  if (!OUTCOMES.includes(outcome as RunOutcome)) return null;
  const numbers = [score, sectorReached, kills, endedAt];
  if (!numbers.every(isFiniteNumber)) return null;
  return {
    key,
    seedCode,
    outcome: outcome as RunOutcome,
    score: score as number,
    sectorReached: sectorReached as number,
    kills: kills as number,
    endedAt: endedAt as number,
  };
}

/**
 * @param store - Persistence.
 * @returns The stored results (invalid entries dropped; [] when none).
 */
export function loadDailyResults(store: KeyValueStore): DailyResult[] {
  const raw = readJson(store, DAILY_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(parseResult).filter((r): r is DailyResult => r !== null);
}

/**
 * @param store - Persistence.
 * @param results - Results to keep.
 */
export function saveDailyResults(
  store: KeyValueStore,
  results: readonly DailyResult[],
): void {
  store.setItem(DAILY_STORAGE_KEY, JSON.stringify(results));
}

/**
 * @param daily - Today's challenge.
 * @returns The run request that launches it (default quick build; the
 *   day's ascension applies even before the player unlocked it).
 */
export function dailyRunRequest(daily: DailyChallenge): StartRunRequest {
  return {
    faction: daily.faction,
    flagshipId: daily.flagshipId,
    loadoutId: null,
    ascension: daily.ascension,
    seed: daily.seed,
    uncappedAscension: true,
  };
}

/**
 * Fold the run history's daily runs into the stored list and save it.
 *
 * @param store - Persistence.
 * @param history - The meta profile's finished runs.
 * @returns The up-to-date results.
 */
export function syncDailyResults(
  store: KeyValueStore,
  history: readonly RunSummary[],
): DailyResult[] {
  const merged = mergeDailyResults(loadDailyResults(store), history);
  saveDailyResults(store, merged);
  return merged;
}

/**
 * Survival roguelite — meta-progression profile (persisted across runs).
 *
 * Separate from campaign saves and PlayerProfile: Star Charts, owned
 * unlocks, the highest ascension unlocked, and the last HISTORY_LIMIT run
 * summaries. Versioned with validation + migration:
 * - v1 (first release of the meta store): { version, charts, unlocked }.
 * - v2 adds ascension unlocks, run counters and the run history.
 */

import { clampAscension, MAX_ASCENSION } from "../../data/survival/ascension";
import { getMetaUnlock, META_UNLOCKS } from "../../data/survival/metaUnlocks";
import {
  isFiniteNumber,
  isRecord,
  readJson,
  type KeyValueStore,
} from "./KeyValueStore";
import type { RunSummary } from "./RunHistory";

/** localStorage key of the Survival meta profile. */
export const META_SAVE_KEY = "shattered_stars_survival_meta";

/** Current meta schema version. */
export const META_SCHEMA_VERSION = 2;

/** Runs kept in the history. */
export const HISTORY_LIMIT = 20;

/** The persisted meta profile. */
export interface MetaProfile {
  readonly version: number;
  /** Spendable Star Charts. */
  readonly charts: number;
  readonly totalChartsEarned: number;
  readonly unlocked: readonly string[];
  /** Highest ascension the player may start a run at. */
  readonly maxAscension: number;
  readonly runs: number;
  readonly victories: number;
  /** Newest first, at most HISTORY_LIMIT. */
  readonly history: readonly RunSummary[];
}

/** @returns A brand-new profile. */
export function emptyMeta(): MetaProfile {
  return {
    version: META_SCHEMA_VERSION,
    charts: 0,
    totalChartsEarned: 0,
    unlocked: [],
    maxAscension: 0,
    runs: 0,
    victories: 0,
    history: [],
  };
}

/**
 * @param raw - Parsed meta JSON of any known version.
 * @returns A valid current-version profile (fresh one when unreadable).
 */
export function migrateMeta(raw: unknown): MetaProfile {
  if (!isRecord(raw) || !isFiniteNumber(raw["version"])) return emptyMeta();
  const version = raw["version"];
  if (version > META_SCHEMA_VERSION) return emptyMeta();
  const charts = isFiniteNumber(raw["charts"]) ? Math.max(0, raw["charts"]) : 0;
  const unlocked = Array.isArray(raw["unlocked"])
    ? raw["unlocked"].filter(
        (id): id is string => typeof id === "string" && !!getMetaUnlock(id),
      )
    : [];
  if (version < 2) {
    return { ...emptyMeta(), charts, totalChartsEarned: charts, unlocked };
  }
  return {
    version: META_SCHEMA_VERSION,
    charts,
    totalChartsEarned: numberOr(raw["totalChartsEarned"], charts),
    unlocked,
    maxAscension: clampAscension(numberOr(raw["maxAscension"], 0)),
    runs: numberOr(raw["runs"], 0),
    victories: numberOr(raw["victories"], 0),
    history: Array.isArray(raw["history"])
      ? (raw["history"].filter(isRunSummary) as RunSummary[]).slice(
          0,
          HISTORY_LIMIT,
        )
      : [],
  };
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function isRunSummary(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    typeof raw["outcome"] === "string" &&
    typeof raw["seedCode"] === "string" &&
    isFiniteNumber(raw["kills"]) &&
    Array.isArray(raw["relics"])
  );
}

/**
 * @param store - The storage port.
 * @returns The meta profile (migrated; fresh when missing or corrupt).
 */
export function loadMeta(store: KeyValueStore): MetaProfile {
  return migrateMeta(readJson(store, META_SAVE_KEY));
}

/**
 * @param store - The storage port.
 * @param meta - The profile to persist.
 */
export function saveMeta(store: KeyValueStore, meta: MetaProfile): void {
  store.setItem(META_SAVE_KEY, JSON.stringify(meta));
}

/**
 * @param meta - The profile.
 * @param unlockId - An unlock to buy.
 * @returns The profile after buying it, or null when not allowed.
 */
export function purchaseUnlock(
  meta: MetaProfile,
  unlockId: string,
): MetaProfile | null {
  const unlock = META_UNLOCKS.find((u) => u.id === unlockId);
  if (!unlock || meta.unlocked.includes(unlockId)) return null;
  if (unlock.requires && !meta.unlocked.includes(unlock.requires)) return null;
  if (meta.charts < unlock.cost) return null;
  return {
    ...meta,
    charts: meta.charts - unlock.cost,
    unlocked: [...meta.unlocked, unlockId],
  };
}

/**
 * Banks a finished run: pays its Star Charts (win or lose), unlocks the
 * next ascension on a victory at the current cap, and prepends it to the
 * bounded history.
 *
 * @param meta - The profile.
 * @param summary - The finished run.
 * @returns The updated profile.
 */
export function recordRunEnd(
  meta: MetaProfile,
  summary: RunSummary,
): MetaProfile {
  const won = summary.outcome === "victory";
  const unlocksNext = won && summary.ascension >= meta.maxAscension;
  return {
    ...meta,
    charts: meta.charts + summary.chartsEarned,
    totalChartsEarned: meta.totalChartsEarned + summary.chartsEarned,
    maxAscension: unlocksNext
      ? Math.min(MAX_ASCENSION, summary.ascension + 1)
      : meta.maxAscension,
    runs: meta.runs + 1,
    victories: meta.victories + (won ? 1 : 0),
    history: [summary, ...meta.history].slice(0, HISTORY_LIMIT),
  };
}

/**
 * reservePersistence — the Squad Builder remembers the last reinforcement
 * setup in local storage: battle type (Classic / Reinforcements), strategy
 * preset, the faction the reserve was built for, the reserve list and
 * whether the player edited it by hand. Versioned: a document of another
 * version, or corrupt JSON, loads the defaults; bad fields are repaired one
 * by one.
 *
 * Pure over a KeyValueStore.
 */

import { FACTION_COLORS, type FactionId } from "../../config";
import type { KeyValueStore } from "../../systems/keyValueStore";
import { parseReserveEntries } from "./reinforcementConfig";
import { MAX_RESERVE_ENTRIES, isStrategyId } from "./strategyPresets";
import type { ReserveEntry, StrategyId } from "./reinforcementTypes";

/** Storage key (the version is part of the document, too). */
export const REINFORCEMENT_PREFS_KEY = "ss_reinforcements_v1";

/** Document version written by this build. */
export const REINFORCEMENT_PREFS_VERSION = 1;

/** Classic one-squad battle, or the reinforcement pool. */
export type BattleType = "classic" | "reinforcements";

/** What the Squad Builder remembers. */
export interface ReinforcementPrefs {
  readonly battle: BattleType;
  readonly strategy: StrategyId;
  /** Faction the reserve was built for, or null before the first build. */
  readonly factionId: FactionId | null;
  readonly reserve: readonly ReserveEntry[];
  /** True once the player changed the list by hand. */
  readonly edited: boolean;
}

/** First-visit setup: reinforcements on, Balanced, reserve built on demand. */
export const DEFAULT_REINFORCEMENT_PREFS: ReinforcementPrefs = {
  battle: "reinforcements",
  strategy: "balanced",
  factionId: null,
  reserve: [],
  edited: false,
};

/**
 * @param store - Where prefs live.
 * @returns The stored prefs, repaired, or the defaults.
 */
export function loadReinforcementPrefs(
  store: KeyValueStore,
): ReinforcementPrefs {
  const raw = store.getItem(REINFORCEMENT_PREFS_KEY);
  if (raw === null) return DEFAULT_REINFORCEMENT_PREFS;
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return DEFAULT_REINFORCEMENT_PREFS;
  }
  if (typeof doc !== "object" || doc === null)
    return DEFAULT_REINFORCEMENT_PREFS;
  const d = doc as Record<string, unknown>;
  if (d["version"] !== REINFORCEMENT_PREFS_VERSION)
    return DEFAULT_REINFORCEMENT_PREFS;
  const defaults = DEFAULT_REINFORCEMENT_PREFS;
  return {
    battle: d["battle"] === "classic" ? "classic" : defaults.battle,
    strategy: isStrategyId(d["strategy"]) ? d["strategy"] : defaults.strategy,
    factionId: isFaction(d["factionId"]) ? d["factionId"] : defaults.factionId,
    reserve: parseReserveEntries(d["reserve"]).slice(0, MAX_RESERVE_ENTRIES),
    edited: d["edited"] === true,
  };
}

/**
 * @param store - Where prefs live.
 * @param prefs - What to remember.
 */
export function saveReinforcementPrefs(
  store: KeyValueStore,
  prefs: ReinforcementPrefs,
): void {
  store.setItem(
    REINFORCEMENT_PREFS_KEY,
    JSON.stringify({ version: REINFORCEMENT_PREFS_VERSION, ...prefs }),
  );
}

function isFaction(value: unknown): value is FactionId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FACTION_COLORS, value)
  );
}

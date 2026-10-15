/**
 * lastBattleStore — remembers the latest finished battle (mode, outcome,
 * time and the full stat line) in a versioned record so the main menu can
 * show "Last: Skirmish — Victory 3:02" and open its details. Storage goes
 * through the safe key-value store; a corrupt or foreign record reads as
 * "no last battle".
 */

import { browserStore, type KeyValueStore } from "../systems/keyValueStore";
import type { MatchSummary } from "./matchStatTypes";

/** Storage key (the version is part of the key and of the record). */
export const LAST_BATTLE_KEY = "ss_last_battle_v1";
/** Record schema version. */
export const LAST_BATTLE_VERSION = 1;

/** Player-facing names of the telemetry mode ids. */
const MODE_LABELS: Readonly<Record<string, string>> = {
  skirmish: "Skirmish",
  dogfight: "Dogfight",
  ace_duel: "Ace Duel",
  continuous: "Continuous",
  survival: "Survival",
  campaign: "Campaign",
  boss_raid: "Boss Raid",
  scenario: "Scenario",
};

/** The persisted record. */
export interface LastBattleRecord {
  readonly version: number;
  /** Epoch ms when it ended. */
  readonly savedAt: number;
  readonly summary: MatchSummary;
}

/**
 * @param modeId - Telemetry mode id.
 * @returns The mode's display name (the id reworded when unknown).
 */
export function modeLabel(modeId: string): string {
  return MODE_LABELS[modeId] ?? modeId.replace(/_/g, " ");
}

/**
 * @param durationMs - Match length.
 * @returns "m:ss".
 */
export function formatDuration(durationMs: number): string {
  const total = Math.max(0, Math.round(durationMs / 1000));
  const seconds = String(total % 60).padStart(2, "0");
  return `${Math.floor(total / 60)}:${seconds}`;
}

/**
 * @param outcome - "victory", "defeat", "draw"...
 * @returns Capitalised outcome.
 */
export function outcomeLabel(outcome: string): string {
  return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

/**
 * Persist a finished battle (a failed write is ignored by the safe store).
 *
 * @param summary - The match summary.
 * @param store - Storage (default: the browser's safe store).
 * @param now - Clock (ms).
 */
export function saveLastBattle(
  summary: MatchSummary,
  store: KeyValueStore = browserStore(),
  now: () => number = Date.now,
): void {
  const record: LastBattleRecord = {
    version: LAST_BATTLE_VERSION,
    savedAt: now(),
    summary,
  };
  store.setItem(LAST_BATTLE_KEY, JSON.stringify(record));
}

/**
 * @param store - Storage (default: the browser's safe store).
 * @returns The stored record, or null when absent or invalid.
 */
export function loadLastBattle(
  store: KeyValueStore = browserStore(),
): LastBattleRecord | null {
  const raw = store.getItem(LAST_BATTLE_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastBattleRecord> | null;
    const summary = parsed?.summary;
    if (parsed?.version !== LAST_BATTLE_VERSION) return null;
    if (typeof summary !== "object" || summary === null) return null;
    if (typeof summary.mode !== "string") return null;
    if (typeof summary.outcome !== "string") return null;
    if (!Number.isFinite(summary.durationMs)) return null;
    return {
      version: LAST_BATTLE_VERSION,
      savedAt: Number(parsed.savedAt) || 0,
      summary,
    };
  } catch {
    return null;
  }
}

/**
 * @param record - A stored last battle.
 * @returns The footer line, e.g. "Last: Skirmish — Victory 3:02".
 */
export function lastBattleLine(record: LastBattleRecord): string {
  const { summary } = record;
  return `Last: ${modeLabel(summary.mode)} — ${outcomeLabel(summary.outcome)} ${formatDuration(summary.durationMs)}`;
}

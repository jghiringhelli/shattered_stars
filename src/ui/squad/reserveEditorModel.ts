/**
 * reserveEditorModel — the Squad Builder's reinforcement setup, as data:
 * editing the ordered reserve (move, remove, add), its total, which
 * reinforcement format a builder mode plays, the reserve a battle uses (the
 * saved one when it was built for the player's faction, else the strategy's
 * preset) and the one-line summary under the BATTLE button.
 *
 * Pure.
 */

import type { FactionId } from "../../config";
import type { GameMode } from "../../core/squadTypes";
import {
  MAX_RESERVE_ENTRIES,
  STRATEGY_LABELS,
  buildReserve,
  rulesFor,
  toDeployOption,
  type ReinforcementFormat,
  type ReinforcementPrefs,
  type ReserveEntry,
} from "../../arcade/reinforcements";

/**
 * @param entries - The reserve.
 * @param index - Entry to move.
 * @param delta - -1 = up, +1 = down.
 * @returns The reordered reserve (unchanged at the ends).
 */
export function moveEntry(
  entries: readonly ReserveEntry[],
  index: number,
  delta: -1 | 1,
): ReserveEntry[] {
  const target = index + delta;
  const out = [...entries];
  if (target < 0 || target >= out.length || !out[index]) return out;
  [out[index], out[target]] = [out[target]!, out[index]!];
  return out;
}

/**
 * @param entries - The reserve.
 * @param index - Entry to remove.
 * @returns The reserve without it.
 */
export function removeEntry(
  entries: readonly ReserveEntry[],
  index: number,
): ReserveEntry[] {
  return entries.filter((_, i) => i !== index);
}

/**
 * @param entries - The reserve.
 * @param entry - Ship to append.
 * @returns The longer reserve (the same one when full).
 */
export function addEntry(
  entries: readonly ReserveEntry[],
  entry: ReserveEntry,
): readonly ReserveEntry[] {
  return entries.length >= MAX_RESERVE_ENTRIES ? entries : [...entries, entry];
}

/** @returns The reserve's total cost. */
export function reserveTotal(entries: readonly ReserveEntry[]): number {
  return entries.reduce((sum, e) => sum + (toDeployOption(e)?.cost ?? 0), 0);
}

/**
 * @param mode - The Squad Builder's mode.
 * @param hasScenario - Whether a scenario is chosen.
 * @returns The reinforcement format, or null for modes without reinforcements.
 */
export function formatOfMode(
  mode: GameMode,
  hasScenario: boolean,
): ReinforcementFormat | null {
  if (mode === "epic") return "epic";
  if (mode !== "arcade") return null;
  return hasScenario ? "scenario" : "skirmish";
}

/**
 * @param prefs - Saved setup.
 * @param faction - The player's faction.
 * @param format - The battle's format.
 * @returns The saved reserve when built for this faction, else the strategy preset.
 */
export function reserveForBattle(
  prefs: ReinforcementPrefs,
  faction: FactionId,
  format: ReinforcementFormat,
): readonly ReserveEntry[] {
  if (prefs.factionId === faction && prefs.reserve.length > 0)
    return prefs.reserve;
  return buildReserve(
    faction,
    prefs.strategy,
    rulesFor(format).poolPoints,
    format,
  );
}

/**
 * @param prefs - Saved setup.
 * @param format - The battle's format.
 * @returns "POOL 1000 · 250 ON FIELD · BALANCED · 9 IN RESERVE".
 */
export function battleSetupSummary(
  prefs: ReinforcementPrefs,
  format: ReinforcementFormat,
): string {
  if (prefs.battle === "classic") return "ONE SQUAD · NO REINFORCEMENTS";
  const rules = rulesFor(format);
  const strategy = STRATEGY_LABELS[prefs.strategy].name.toUpperCase();
  const reserve =
    prefs.reserve.length > 0
      ? `${prefs.reserve.length} IN RESERVE`
      : "AUTO RESERVE";
  return `POOL ${rules.poolPoints} · ${rules.fieldCapPoints} ON FIELD · ${strategy} · ${reserve}`;
}

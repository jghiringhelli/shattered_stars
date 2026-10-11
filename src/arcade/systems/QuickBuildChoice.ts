/**
 * QuickBuildChoice — the player's quick-build pick on a setup screen
 * (Dogfight, Ace Duel, Survival). A selection pairs the squad's ships with
 * one loadout each; it starts as exactly what assignQuickBuilds would hand
 * out (so not touching the chooser changes nothing) and cycles through each
 * ship's quick builds without ever fielding a unique ace twice.
 *
 * Pure: no Phaser. Reads the loadout catalogue at call time.
 */

import { getEquippableLoadouts } from "../../data/ShipLoadouts";
import { wouldDuplicateUniquePilot } from "../../data/squadRules";
import { assignQuickBuilds } from "./QuickBuildEquip";

/** The squad's ships and the quick build each flies (null = bare hull). */
export interface QuickBuildSelection {
  readonly shipIds: readonly string[];
  readonly loadoutIds: readonly (string | null)[];
}

/** Which way the chooser cycles. */
export type CycleStep = 1 | -1;

/**
 * The quick builds a ship offers, in catalogue order.
 *
 * @param shipId - Ship definition id.
 * @returns Loadout ids the player can cycle through (empty when none).
 */
export function quickBuildOptions(shipId: string): string[] {
  return getEquippableLoadouts(shipId).map((loadout) => loadout.id);
}

/**
 * Whether two ship lists are the same squad, in order.
 * @param a - One list.
 * @param b - The other.
 * @returns True when they match ship for ship.
 */
function sameShips(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((shipId, i) => shipId === b[i]);
}

/**
 * The previous picks that still stand: offered by their ship and not
 * repeating a unique ace picked earlier in the squad.
 * @param previous - The earlier selection (same ships).
 * @returns One kept id (or null) per ship.
 */
function validPicks(previous: QuickBuildSelection): (string | null)[] {
  const kept: (string | null)[] = [];
  previous.shipIds.forEach((shipId, i) => {
    const pick = previous.loadoutIds[i] ?? null;
    const offered = pick !== null && quickBuildOptions(shipId).includes(pick);
    kept.push(offered && !wouldDuplicateUniquePilot(kept, pick) ? pick : null);
  });
  return kept;
}

/**
 * The selection for a squad: the previous picks when they were made for the
 * same ships (and still stand), every other ship gets its default build.
 *
 * @param shipIds - The squad's ships, in order.
 * @param previous - The earlier selection, if any.
 * @returns A full selection (one loadout per ship).
 */
export function selectionFor(
  shipIds: readonly string[],
  previous?: QuickBuildSelection | null,
): QuickBuildSelection {
  const kept =
    previous && sameShips(previous.shipIds, shipIds)
      ? validPicks(previous)
      : [];
  return {
    shipIds: [...shipIds],
    loadoutIds: assignQuickBuilds(shipIds, kept),
  };
}

/**
 * An index wrapped into [0, length), negative indices included.
 * @param index - Any integer.
 * @param length - The list length (> 0).
 * @returns The wrapped index.
 */
function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/**
 * Cycle one ship's quick build to the next (or previous) option, skipping
 * builds whose unique ace already flies elsewhere in the squad.
 *
 * @param selection - The current selection.
 * @param index - Which ship to change.
 * @param step - 1 for the next build, -1 for the previous one.
 * @returns The new selection (unchanged when there is nothing to cycle to).
 */
export function cycleQuickBuild(
  selection: QuickBuildSelection,
  index: number,
  step: CycleStep,
): QuickBuildSelection {
  const shipId = selection.shipIds[index];
  if (shipId === undefined) return selection;
  const options = quickBuildOptions(shipId);
  const others = selection.loadoutIds.filter((_, i) => i !== index);
  const current = options.indexOf(selection.loadoutIds[index] ?? "");
  const origin = current === -1 ? (step > 0 ? -1 : options.length) : current;
  for (let k = 1; k <= options.length; k++) {
    const candidate = options[wrapIndex(origin + step * k, options.length)]!;
    if (candidate === selection.loadoutIds[index]) break;
    if (wouldDuplicateUniquePilot(others, candidate)) continue;
    const loadoutIds = [...selection.loadoutIds];
    loadoutIds[index] = candidate;
    return { shipIds: selection.shipIds, loadoutIds };
  }
  return selection;
}

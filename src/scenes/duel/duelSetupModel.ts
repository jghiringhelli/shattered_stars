/**
 * duelSetupModel — plain-language texts and the build pick of the duel
 * setups: what each AI difficulty and match format means, and setting one
 * ship's quick build (never fielding a unique ace twice). Pure: no Phaser.
 */

import {
  quickBuildOptions,
  type QuickBuildSelection,
} from "../../arcade/systems/QuickBuildChoice";
import { wouldDuplicateUniquePilot } from "../../data/squadRules";
import type { TermId } from "../../data/tooltips";

/** AI difficulty of a duel. */
export type DuelDifficulty = "easy" | "normal" | "hard" | "brutal";
/** Best-of formats of a duel. */
export type DuelFormat = "best_of_3" | "best_of_5";

/** One sentence per AI difficulty, shown under the picker. */
export const DIFFICULTY_LINES: Readonly<Record<DuelDifficulty, string>> = {
  easy: "Easy: a slow pilot that reacts about twice as late as normal. Good for learning a hull.",
  normal: "Normal: an average pilot with steady pursuit. A fair fight if you fly sensibly.",
  hard: "Hard: an expert that plans one cycle ahead and flanks anyone who flies straight.",
  brutal: "Brutal: an expert with the fastest reactions in the game. Expect to lose rounds.",
};

/** One sentence per match format. */
export const FORMAT_LINES: Readonly<Record<DuelFormat, string>> = {
  best_of_3: "Best of 3: win two rounds to win the match (about five minutes).",
  best_of_5: "Best of 5: win three rounds to win the match (about eight minutes).",
};

/** Tooltip term of each AI difficulty. */
export const DIFFICULTY_TERMS: Readonly<Record<DuelDifficulty, TermId>> = {
  easy: "duel.diff_easy",
  normal: "duel.diff_normal",
  hard: "duel.diff_hard",
  brutal: "duel.diff_brutal",
};

/** Tooltip term of each match format. */
export const FORMAT_TERMS: Readonly<Record<DuelFormat, TermId>> = {
  best_of_3: "duel.format_bo3",
  best_of_5: "duel.format_bo5",
};

/**
 * Sets one ship's quick build.
 *
 * @param selection - The current selection.
 * @param index - Which ship to change.
 * @param loadoutId - The build to fly (null = bare hull).
 * @returns The new selection; the same object when the ship does not offer
 *   that build or a unique ace would fly twice.
 */
export function pickQuickBuild(
  selection: QuickBuildSelection,
  index: number,
  loadoutId: string | null,
): QuickBuildSelection {
  const shipId = selection.shipIds[index];
  if (shipId === undefined) return selection;
  if (loadoutId !== null && !quickBuildOptions(shipId).includes(loadoutId)) {
    return selection;
  }
  const others = selection.loadoutIds.filter((_, i) => i !== index);
  if (wouldDuplicateUniquePilot(others, loadoutId)) return selection;
  const loadoutIds = [...selection.loadoutIds];
  loadoutIds[index] = loadoutId;
  return { shipIds: selection.shipIds, loadoutIds };
}

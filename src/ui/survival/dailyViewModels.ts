/**
 * Survival Daily challenge — view models for the Daily panel (pure, no
 * Phaser): launch today's run (its fixed setup + today's best), the recent
 * daily results (read-only), Close.
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import { FACTION_NAMES_SHORT } from "../../data/survival/factionNames";
import {
  bestForDay,
  type DailyChallenge,
  type DailyResult,
} from "../../systems/survival/DailyChallenge";
import type { RunOutcome } from "../../systems/survival/RunHistory";
import type { ChoiceCard } from "./SurvivalChoicePanel";

/** Past results listed under the launch card. */
export const DAILY_PANEL_HISTORY = 5;
/** Card label of the launch option. */
export const LAUNCH_DAILY_LABEL = "Launch today's run";

const OUTCOME_LABELS: Readonly<Record<RunOutcome, string>> = {
  victory: "Victory",
  defeat: "Defeat",
  abandoned: "Abandoned",
};
const OUTCOME_ICONS: Readonly<Record<RunOutcome, string>> = {
  victory: "🏆",
  defeat: "💥",
  abandoned: "🏳",
};

/** "3,400" (en-US grouping, independent of the browser locale). */
function points(score: number): string {
  return score.toLocaleString("en-US");
}

/**
 * @param daily - Today's challenge.
 * @returns One line: faction · flagship · ascension · seed.
 */
export function dailySetupLine(daily: DailyChallenge): string {
  const ship = getShipDefinition(daily.flagshipId)?.name ?? daily.flagshipId;
  return `${FACTION_NAMES_SHORT[daily.faction]} · ${ship} · Ascension ${daily.ascension} · seed ${daily.seedCode}`;
}

/**
 * @param daily - Today's challenge.
 * @param results - Stored daily results (newest first).
 * @returns Launch card, up to {@link DAILY_PANEL_HISTORY} past results, Close.
 */
export function dailyCards(
  daily: DailyChallenge,
  results: readonly DailyResult[],
): ChoiceCard[] {
  const best = bestForDay(results, daily.key);
  const history = results.slice(0, DAILY_PANEL_HISTORY).map((r) => ({
    icon: OUTCOME_ICONS[r.outcome],
    name: `${r.key} · ${OUTCOME_LABELS[r.outcome]}`,
    description: `Sector ${r.sectorReached} · ${r.kills} kills · seed ${r.seedCode}`,
    note: `${points(r.score)} pts`,
    disabled: true,
  }));
  return [
    {
      icon: "📅",
      name: LAUNCH_DAILY_LABEL,
      description: dailySetupLine(daily),
      note: best ? `Best ${points(best.score)}` : "No score yet",
    },
    ...history,
    { icon: "✖", name: "Close", description: "Back to the run setup" },
  ];
}

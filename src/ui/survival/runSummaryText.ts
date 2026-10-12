/**
 * Survival roguelite — run summary and history text (pure view models).
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import { FACTION_NAMES_SHORT } from "../../data/survival/factionNames";
import { getMutation } from "../../data/survival/mutations";
import { getRelic } from "../../data/survival/relicCatalog";
import { ARCHETYPE_SETS } from "../../data/survival/relics";
import { archetypeCounts } from "../../data/survival/relicCatalog";
import {
  formatDuration,
  type RunSummary,
} from "../../systems/survival/RunHistory";

const OUTCOME_LABEL: Readonly<Record<RunSummary["outcome"], string>> = {
  victory: "VICTORY",
  defeat: "DEFEAT",
  abandoned: "ABANDONED",
};

/**
 * @param summary - A finished run.
 * @returns The headline, e.g. "VICTORY" or "DEFEAT — Destroyed by …".
 */
export function summaryTitle(summary: RunSummary): string {
  return summary.outcome === "victory"
    ? "VICTORY"
    : `${OUTCOME_LABEL[summary.outcome]} — ${summary.cause}`;
}

/**
 * @param summary - A finished run.
 * @returns Its detail lines: build, archetypes, sectors, kills, salvage, ascension, time, seed, payout.
 */
export function summaryLines(summary: RunSummary): string[] {
  const ship =
    getShipDefinition(summary.flagshipId)?.name ?? summary.flagshipId;
  const relics = summary.relics.map((id) => getRelic(id)?.name ?? id);
  const mutations = summary.mutations.map((id) => getMutation(id)?.name ?? id);
  const counts = archetypeCounts(summary.relics);
  const archetypes = (Object.keys(counts) as (keyof typeof counts)[])
    .filter((a) => counts[a] > 0)
    .map((a) => `${ARCHETYPE_SETS[a].name} ×${counts[a]}`);
  return [
    `${FACTION_NAMES_SHORT[summary.faction]} — ${ship}`,
    `Sectors cleared ${summary.sectorsCleared}/3 (reached ${summary.sectorReached})   Nodes ${summary.nodesCleared}   Kills ${summary.kills}   Escorts lost ${summary.escortsLost ?? 0}`,
    `Salvage earned ${summary.salvageEarned}   Ascension ${summary.ascension}   Time ${formatDuration(summary.durationMs)}   Seed ${summary.seedCode}`,
    `Relics (${relics.length}): ${relics.length > 0 ? relics.join(", ") : "none"}`,
    `Build archetypes: ${archetypes.length > 0 ? archetypes.join(", ") : "none"}${mutations.length > 0 ? `   Mutations: ${mutations.join(", ")}` : ""}`,
    `Star Charts earned: +${summary.chartsEarned} ★`,
  ];
}

/**
 * @param summary - A past run.
 * @param index - Its position in the history (0 = newest).
 * @returns One compact history row.
 */
export function historyRow(summary: RunSummary, index: number): string {
  const date = new Date(summary.endedAt).toISOString().slice(0, 10);
  const outcome = OUTCOME_LABEL[summary.outcome].padEnd(9);
  return `${String(index + 1).padStart(2)}. ${date}  ${outcome} A${summary.ascension}  S${summary.sectorReached}  ${String(summary.kills).padStart(3)} kills  ${String(summary.relics.length).padStart(2)} relics  ${formatDuration(summary.durationMs).padStart(6)}  ${summary.cause}`;
}

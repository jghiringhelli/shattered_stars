/**
 * Pilot codex — every pilot card as an encyclopedia entry: the ship, the
 * initiative and price, the ability's card text and its real-time reading,
 * the slots the pilot adds and the quick builds that fly it. Pure.
 */

import { PILOT_CARDS, type PilotCard } from "../../systems/SquadBuilder";
import { PILOT_ABILITIES } from "../../systems/PilotAbilities";
import { SHIP_DEFINITIONS } from "../ShipDefinitions";
import { summarizePilotAbility } from "../quickBuildDetails";
import { pilotAbilityHint } from "../roleHints";
import { buildsFlyingPilot } from "../quickBuildIndex";
import {
  titleCase,
  withSearchText,
  type CodexEntry,
  type CodexParagraph,
} from "./codexTypes";

/** List caption marker of a unique (named) pilot. */
const UNIQUE_MARK = " ★";

/**
 * @param pilot - A pilot card.
 * @returns The paragraphs about its ability (none for a generic pilot).
 */
function abilityParagraphs(pilot: PilotCard): CodexParagraph[] {
  if (!pilot.abilityId) {
    return [{ heading: "ABILITY", text: "None — a generic line pilot." }];
  }
  const name = PILOT_ABILITIES[pilot.abilityId]?.name ?? pilot.abilityId;
  const hint = pilotAbilityHint(pilot.abilityId);
  return [
    { heading: "ABILITY", text: `${name}: ${pilot.abilityText ?? ""}`.trim() },
    { heading: "IN BATTLE", text: summarizePilotAbility(pilot.abilityId) },
    { heading: "ROLE", text: hint.role },
  ];
}

/**
 * @param pilot - A pilot card.
 * @returns Its codex entry.
 */
function pilotEntry(pilot: PilotCard): CodexEntry {
  const ship = SHIP_DEFINITIONS[pilot.shipId];
  const builds = buildsFlyingPilot(pilot.id)
    .map((build) => `${build.name} (${build.pointCost} pts)`)
    .join(", ");
  const extra = (pilot.extraSlots ?? []).map(titleCase).join(", ");
  const paragraphs: CodexParagraph[] = [
    ...abilityParagraphs(pilot),
    ...(extra ? [{ heading: "EXTRA SLOTS", text: extra }] : []),
    { heading: "FLY IT IN", text: builds || "No quick build yet." },
  ];
  return withSearchText({
    section: "pilots",
    id: pilot.id,
    name: pilot.name,
    tag: `I${pilot.initiative}${pilot.isUnique ? UNIQUE_MARK : ""}`,
    faction: pilot.faction,
    subtitle: `${ship?.name ?? pilot.shipId} · initiative ${pilot.initiative} · ${
      pilot.isUnique ? "unique" : "generic"
    } · +${pilot.pointCost} pts`,
    paragraphs,
  });
}

/**
 * Every pilot card, ordered by ship then by initiative (aces last).
 * @returns The pilot entries.
 */
export function pilotCodexEntries(): CodexEntry[] {
  const shipOrder = Object.keys(SHIP_DEFINITIONS);
  return Object.values(PILOT_CARDS)
    .slice()
    .sort(
      (a, b) =>
        shipOrder.indexOf(a.shipId) - shipOrder.indexOf(b.shipId) ||
        a.initiative - b.initiative ||
        a.name.localeCompare(b.name),
    )
    .map(pilotEntry);
}

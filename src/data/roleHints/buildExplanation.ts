/**
 * buildExplanation — the plain-language guide to a quick build ("pre-build"):
 * when to pick it, how to fly it, strengths, weaknesses, who it pairs with
 * and loses to, a concrete example and a cost breakdown (hull + pilot + each
 * card). Everything is derived from the catalogues — the hull's stats, the
 * pilot and its ability, each upgrade card and the build's play style — and
 * assembled from the fixed phrase tables in buildGuideText.ts. Nothing is
 * hand-written per build, so a rebalanced card changes its guide.
 *
 * Pure: no Phaser, no state.
 */

import type { ShipDefinition } from "../../core/types";
import type { UpgradeDefinition } from "../../core/upgradeTypes";
import { PILOT_CARDS, type PilotCard } from "../../systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { slotDisplayName } from "../encyclopedia/codexTypes";
import { getShipDefinition } from "../ShipDefinitions";
import type { ShipLoadout } from "../ShipLoadouts";
import { summarizePilotAbility, summarizeUpgrade } from "../quickBuildDetails";
import { PILOT_ABILITIES } from "../../systems/PilotAbilities";
import { quickBuildHint, shipHint } from "./cardHints";
import { hullTraits } from "./hullTraits";
import {
  SLOT_TIP,
  STYLE_COUNTER,
  STYLE_OPENER,
  STYLE_TACTIC,
} from "./buildGuideText";
import { PLAYSTYLES, ROLE_TITLES, type Playstyle } from "./playstyleCatalog";

/** Cards that launch ordnance recharge slowly — a built-in weakness. */
const ORDNANCE_SLOTS: ReadonlySet<string> = new Set([
  "missile",
  "torpedo",
  "bomb",
]);
/** Initiative from which a pilot reads as an ace. */
const ACE_INITIATIVE = 4;

/** One line of a build's price. */
export interface CostLine {
  readonly kind: "hull" | "pilot" | "card";
  readonly label: string;
  readonly points: number;
}

/** What a build is, how to fly it and what it costs. */
export interface BuildExplanation {
  readonly shipName: string;
  readonly buildName: string;
  readonly playstyle: Playstyle;
  /** Generated "when to pick it" paragraph. */
  readonly whenToPick: string;
  /** Short how-to-fly lines: the style's tactic, the pilot, each card. */
  readonly howToFly: readonly string[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly bestWith: string;
  readonly counter: string;
  /** A concrete sentence starting with the build's name. */
  readonly example: string;
  readonly costLines: readonly CostLine[];
  readonly totalPoints: number;
  /** Names of the cards the explanation cites. */
  readonly cardNames: readonly string[];
}

/**
 * @param card - An upgrade card.
 * @returns "Name (Slot): what it does — handling tip".
 */
function cardLine(card: UpgradeDefinition): string {
  const reading = summarizeUpgrade(card) || "passive bonus";
  return `${card.name} (${slotDisplayName(card.slotType)}): ${reading} — ${SLOT_TIP[card.slotType]}.`;
}

/**
 * @param cards - The build's cards.
 * @returns Drawbacks cards bring (ordnance recharge, illicit downsides).
 */
function cardWeaknesses(cards: readonly UpgradeDefinition[]): string[] {
  const lines: string[] = [];
  for (const card of cards) {
    if (ORDNANCE_SLOTS.has(card.slotType))
      lines.push(`${card.name} is limited ordnance — it must recharge`);
    if (card.slotType === "illicit")
      lines.push(`${card.name} is illicit gear with a drawback`);
  }
  return lines;
}

/**
 * @param loadout - The build.
 * @returns Its cards, unknown ids skipped.
 */
function cardsOf(loadout: ShipLoadout): UpgradeDefinition[] {
  return loadout.upgrades.flatMap((id) => {
    const card = UPGRADE_DEFINITIONS[id];
    return card ? [card] : [];
  });
}

/** The pilot's ability as the guide cites it. */
interface AbilityReading {
  readonly name: string;
  readonly reading: string;
}

/**
 * @param ship - The hull.
 * @param pilot - The pilot card, if any.
 * @param ability - The pilot's ability, if any.
 * @param cards - The build's cards.
 * @returns Strengths and weaknesses from hull, pilot and cards.
 */
function prosAndCons(
  ship: ShipDefinition,
  pilot: PilotCard | undefined,
  ability: AbilityReading | null,
  cards: readonly UpgradeDefinition[],
): { strengths: string[]; weaknesses: string[] } {
  const traits = hullTraits(ship);
  const strengths = [...traits.strengths];
  const weaknesses = [...traits.weaknesses, ...cardWeaknesses(cards)];
  if (pilot && pilot.initiative >= ACE_INITIATIVE)
    strengths.push(`Initiative ${pilot.initiative} pilot (${pilot.name})`);
  if (ability?.reading) strengths.push(`${ability.name}: ${ability.reading}`);
  if (pilot?.isUnique) weaknesses.push("named pilot — only one per squad");
  if (!ability) weaknesses.push("no pilot ability");
  return { strengths, weaknesses };
}
/**
 * The example sentence: the build's name, its pilot, how its style opens a
 * fight and the first weapon or the ability it leans on.
 */
function exampleSentence(
  buildName: string,
  pilotName: string,
  style: Playstyle,
  weapon: UpgradeDefinition | undefined,
  abilityName: string | undefined,
): string {
  const lean = weapon
    ? `, firing ${weapon.name} as soon as it is ready`
    : abilityName
      ? `, leaning on ${abilityName}`
      : "";
  return `${buildName}: ${pilotName} ${STYLE_OPENER[style]}${lean}.`;
}

/**
 * Whole-build guide.
 *
 * @param loadout - The quick build.
 * @returns Its explanation.
 * @throws Error when the build's ship has no definition.
 */
export function explainQuickBuild(loadout: ShipLoadout): BuildExplanation {
  const ship = getShipDefinition(loadout.shipId);
  if (!ship) throw new Error(`Unknown ship "${loadout.shipId}"`);
  const pilot = PILOT_CARDS[loadout.pilotId];
  const cards = cardsOf(loadout);
  const hint = quickBuildHint(loadout);
  const style = hint.playstyle;
  const ability = pilot?.abilityId
    ? {
        name: PILOT_ABILITIES[pilot.abilityId]?.name ?? pilot.abilityId,
        reading: summarizePilotAbility(pilot.abilityId),
      }
    : null;
  const { strengths, weaknesses } = prosAndCons(ship, pilot, ability, cards);
  const costLines = costOf(ship, loadout, cards);
  const howToFly = [
    STYLE_TACTIC[style],
    ...(ability
      ? [`${ability.name}: ${ability.reading || "see the pilot card"}.`]
      : []),
    ...cards.map(cardLine),
  ];
  return {
    shipName: ship.name,
    buildName: loadout.name,
    playstyle: style,
    whenToPick: pickParagraph(ship, style, strengths, loadout.pointCost),
    howToFly,
    strengths,
    weaknesses,
    bestWith: hint.bestWith,
    counter: `Struggles against: ${STYLE_COUNTER[style]}`,
    example: exampleSentence(
      loadout.name,
      pilot?.name ?? "a rookie",
      style,
      cards.find((card) => card.weapon),
      ability?.name,
    ),
    costLines,
    totalPoints: loadout.pointCost,
    cardNames: cards.map((card) => card.name),
  };
}

/**
 * @param ship - The hull.
 * @param style - The play style.
 * @param strengths - Strength lines (the first two are quoted).
 * @param total - The build's price.
 * @returns The "when to pick it" paragraph.
 */
function pickParagraph(
  ship: ShipDefinition,
  style: Playstyle,
  strengths: readonly string[],
  total: number,
): string {
  const info = PLAYSTYLES[style];
  const role = ROLE_TITLES[ship.role].toLowerCase();
  const quoted = strengths.slice(0, 2).join(" and ");
  return `Pick it for a ${role} that plays as a ${info.label.toLowerCase()} — ${info.tagline}. ${quoted ? `It brings ${quoted}. ` : ""}Total ${total} pts.`;
}

/**
 * @param ship - The hull.
 * @param loadout - The build.
 * @param cards - Its cards.
 * @returns Hull, pilot and card lines.
 */
function costOf(
  ship: ShipDefinition,
  loadout: ShipLoadout,
  cards: readonly UpgradeDefinition[],
): CostLine[] {
  const pilot = PILOT_CARDS[loadout.pilotId];
  return [
    { kind: "hull", label: ship.name, points: ship.baseStats.pointCost },
    ...(pilot
      ? [{ kind: "pilot" as const, label: pilot.name, points: pilot.pointCost }]
      : []),
    ...cards.map((card) => ({
      kind: "card" as const,
      label: card.name,
      points: card.pointCost,
    })),
  ];
}

/**
 * Guide for the stock ship (BASE payload): rookie pilot, no cards.
 *
 * @param shipId - Ship definition id.
 * @returns The explanation.
 * @throws Error when the ship has no definition.
 */
export function explainBaseShip(shipId: string): BuildExplanation {
  const ship = getShipDefinition(shipId);
  if (!ship) throw new Error(`Unknown ship "${shipId}"`);
  const style = shipHint(shipId).playstyle;
  const traits = hullTraits(ship);
  return {
    shipName: ship.name,
    buildName: "Base",
    playstyle: style,
    whenToPick: `The stock ${ROLE_TITLES[ship.role].toLowerCase()}: a rookie pilot and no cards, ${ship.baseStats.pointCost} pts. Pick it to save points or to learn the hull before choosing a build.`,
    howToFly: [STYLE_TACTIC[style]],
    strengths: traits.strengths,
    weaknesses: [...traits.weaknesses, "no pilot ability, no upgrade cards"],
    bestWith: `Best with ${PLAYSTYLES[style].squadPartner}`,
    counter: `Struggles against: ${STYLE_COUNTER[style]}`,
    example: `Base ${ship.name}: a rookie ${STYLE_OPENER[style]}.`,
    costLines: [
      { kind: "hull", label: ship.name, points: ship.baseStats.pointCost },
    ],
    totalPoints: ship.baseStats.pointCost,
    cardNames: [],
  };
}

/**
 * cardHints — one-line role + "best with" hints for upgrade cards, pilot
 * abilities and quick builds (P2-1), derived from their real-time effects,
 * weapons and stat bonuses (playstyles.ts) — never authored per card, so a
 * rebalanced card's hint follows its new numbers.
 *
 * Pure: no Phaser, no state.
 */

import type {
  UpgradeDefinition,
  UpgradeSlotType,
} from "../../core/upgradeTypes";
import type { ShipRole } from "../../core/types";
import {
  PILOT_ABILITIES,
  type AbilityCategory,
} from "../../systems/PilotAbilities";
import { PILOT_CARDS } from "../../systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { PILOT_ABILITY_REALTIME } from "../pilotAbilityEffects";
import { getShipDefinition } from "../ShipDefinitions";
import { getEquippableLoadouts, type ShipLoadout } from "../ShipLoadouts";
import {
  PLAYSTYLES,
  ROLE_PLURALS,
  ROLE_TITLES,
  addVote,
  dominantPlaystyle,
  effectScores,
  mergeScores,
  roleLine,
  type Playstyle,
  type PlaystyleScores,
} from "./playstyles";

/** A role line and a "best with" line, plus the partner names it cites. */
export interface RoleHint {
  readonly playstyle: Playstyle;
  /** e.g. "Flanker — strikes from behind". */
  readonly role: string;
  /** e.g. "Best with interceptors · pairs with Afterburners, Daredevil". */
  readonly bestWith: string;
  /** Catalogue names cited in {@link bestWith}. */
  readonly pairsWith: readonly string[];
}

/** Longest hint line (fits one row of the widest card / tooltip). */
export const MAX_HINT_CHARS = 90;
/** Partner cards cited per hint. */
const MAX_PAIRS = 2;
/** Weight of a card being a secondary weapon (defines its style). */
const WEAPON_WEIGHT = 2;

const WEAPON_STYLE: Partial<Record<UpgradeSlotType, Playstyle>> = {
  missile: "bomber",
  torpedo: "bomber",
  bomb: "bomber",
  turret: "gunner",
  cannon: "striker",
};

/** Style of a card whose effects say nothing (a bare slot filler). */
const SLOT_FALLBACK: Readonly<Record<UpgradeSlotType, Playstyle>> = {
  talent: "striker",
  missile: "bomber",
  torpedo: "bomber",
  cannon: "striker",
  turret: "gunner",
  bomb: "bomber",
  crew: "support",
  gunner: "gunner",
  astromech: "tank",
  sensor: "marksman",
  tech: "marksman",
  modification: "tank",
  illicit: "striker",
  title: "striker",
  configuration: "interceptor",
  force_power: "marksman",
};

const STAT_STYLE = [
  ["hullBonus", "tank"],
  ["shieldBonus", "tank"],
  ["attackBonus", "striker"],
  ["agilityBonus", "interceptor"],
] as const;

const CATEGORY_STYLE: Readonly<Record<AbilityCategory, Playstyle>> = {
  offensive: "striker",
  defensive: "tank",
  movement: "interceptor",
  support: "support",
  special: "marksman",
};

const LOADOUT_STYLE: Readonly<Record<ShipLoadout["role"], Playstyle>> = {
  offense: "striker",
  defense: "tank",
  support: "support",
  balanced: "marksman",
  swarm: "wingman",
};

/**
 * @param card - An upgrade card.
 * @returns Votes from its effect knobs, weapon and stat bonuses.
 */
function upgradeScores(card: UpgradeDefinition): PlaystyleScores {
  let scores = card.realtime ? effectScores(card.realtime) : {};
  const weaponStyle = WEAPON_STYLE[card.slotType];
  if (card.weapon && weaponStyle)
    scores = addVote(scores, weaponStyle, WEAPON_WEIGHT);
  for (const [stat, voted] of STAT_STYLE)
    if ((card.effects?.[stat] ?? 0) > 0) scores = addVote(scores, voted);
  return scores;
}

/**
 * @param card - An upgrade card.
 * @returns The style it serves.
 */
export function upgradePlaystyle(card: UpgradeDefinition): Playstyle {
  return dominantPlaystyle(upgradeScores(card), SLOT_FALLBACK[card.slotType]);
}

/**
 * Catalogue cards that complement a style: its partner style first, then
 * the same style; cards for another slot before same-slot rivals; cheaper
 * first; faction-locked cards only for their own faction.
 *
 * @param s - The style to complement.
 * @param exclude - The card asking (never cited), if any.
 * @returns Up to two card names.
 */
function partnerCards(s: Playstyle, exclude?: UpgradeDefinition): string[] {
  const partner = PLAYSTYLES[s].partner;
  const rank = (card: UpgradeDefinition): number => {
    const own = upgradePlaystyle(card);
    const styleRank = own === partner ? 0 : own === s ? 1 : 2;
    const slotRank = exclude && card.slotType === exclude.slotType ? 1 : 0;
    return styleRank * 2 + slotRank;
  };
  const names = Object.values(UPGRADE_DEFINITIONS)
    .filter((card) => card.id !== exclude?.id && card.name !== exclude?.name)
    .filter(
      (card) =>
        !card.requiredFaction ||
        card.requiredFaction === exclude?.requiredFaction,
    )
    .filter((card) => rank(card) < 4)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.pointCost - b.pointCost ||
        a.name.localeCompare(b.name),
    )
    .map((card) => card.name);
  return [...new Set(names)].slice(0, MAX_PAIRS);
}

/**
 * "Best with X · pairs with A, B", dropping cited cards until it fits.
 *
 * @param lead - Leading phrase ("Best with interceptors").
 * @param pairs - Partner names.
 * @returns The line and the names it kept.
 */
export function bestWithLine(
  lead: string,
  pairs: readonly string[],
): { readonly line: string; readonly kept: readonly string[] } {
  for (let count = pairs.length; count > 0; count--) {
    const kept = pairs.slice(0, count);
    const line = `${lead} · pairs with ${kept.join(", ")}`;
    if (line.length <= MAX_HINT_CHARS) return { line, kept };
  }
  return { line: lead, kept: [] };
}

function rolesLead(s: Playstyle, required?: ShipRole | ShipRole[]): string {
  const allowed = required === undefined ? null : [required].flat();
  const roles = PLAYSTYLES[s].bestRoles.filter(
    (role) => !allowed || allowed.includes(role),
  );
  const role = roles[0] ?? allowed?.[0] ?? PLAYSTYLES[s].bestRoles[0];
  return `Best with ${role ? ROLE_PLURALS[role] : "any hull"}`;
}

function hintFor(
  s: Playstyle,
  lead: string,
  pairs: readonly string[],
): RoleHint {
  const { line, kept } = bestWithLine(lead, pairs);
  return { playstyle: s, role: roleLine(s), bestWith: line, pairsWith: kept };
}

/**
 * @param card - An upgrade card.
 * @returns Its role and best-with hint.
 */
export function upgradeHint(card: UpgradeDefinition): RoleHint {
  const s = upgradePlaystyle(card);
  return hintFor(s, rolesLead(s, card.requiredShipRole), partnerCards(s, card));
}

/**
 * @param abilityId - PILOT_ABILITIES / PILOT_ABILITY_REALTIME key.
 * @returns The style the ability serves.
 */
export function abilityPlaystyle(abilityId: string): Playstyle {
  const effect = PILOT_ABILITY_REALTIME[abilityId];
  const category = PILOT_ABILITIES[abilityId]?.category;
  const fallback = category ? CATEGORY_STYLE[category] : "striker";
  return dominantPlaystyle(effect ? effectScores(effect) : {}, fallback);
}

/**
 * @param abilityId - PILOT_ABILITIES / PILOT_ABILITY_REALTIME key.
 * @returns Its role and best-with hint (partners are upgrade cards).
 */
export function pilotAbilityHint(abilityId: string): RoleHint {
  const s = abilityPlaystyle(abilityId);
  return hintFor(s, rolesLead(s), partnerCards(s));
}

/**
 * A quick build reads as its hull's role plus what its pilot and cards add
 * up to: "Heavy fighter · Flanker — strikes from behind" (just
 * "Interceptor — chases and flanks" when the two agree).
 *
 * @param loadout - The build.
 * @returns Its role and best-with (the squadmate it wants) hint.
 */
export function quickBuildHint(loadout: ShipLoadout): RoleHint {
  const abilityId = PILOT_CARDS[loadout.pilotId]?.abilityId;
  const ability = abilityId ? PILOT_ABILITY_REALTIME[abilityId] : undefined;
  const cards = loadout.upgrades.flatMap((id) => {
    const card = UPGRADE_DEFINITIONS[id];
    return card ? [upgradeScores(card)] : [];
  });
  const scores = mergeScores(ability ? effectScores(ability) : {}, ...cards);
  const s = dominantPlaystyle(scores, LOADOUT_STYLE[loadout.role]);
  return hullHint(
    getShipDefinition(loadout.shipId)?.role ?? "light_fighter",
    s,
  );
}

/**
 * "Heavy fighter · Flanker — strikes from behind" (just the style line when
 * hull and style share a name) and the squadmate the style wants.
 *
 * @param hullRole - The ship's role.
 * @param s - The style it plays.
 * @returns The hint.
 */
function hullHint(hullRole: ShipRole, s: Playstyle): RoleHint {
  const info = PLAYSTYLES[s];
  const hull = ROLE_TITLES[hullRole];
  return {
    playstyle: s,
    role:
      hull === info.label
        ? roleLine(s)
        : `${hull} · ${info.label} — ${info.tagline}`,
    bestWith: `Best with ${info.squadPartner}`,
    pairsWith: [],
  };
}

/** Style a hull plays when it offers no quick build. */
const HULL_STYLE: Readonly<Record<ShipRole, Playstyle>> = {
  light_fighter: "wingman",
  heavy_fighter: "striker",
  interceptor: "interceptor",
  bomber: "bomber",
  support: "support",
  gunship: "tank",
  capital: "support",
};

/**
 * A ship's hint: its signature (first equippable) quick build, or its
 * hull role's natural style when it offers none.
 *
 * @param shipId - Ship definition id.
 * @returns Its role and best-with hint.
 */
export function shipHint(shipId: string): RoleHint {
  const signature = getEquippableLoadouts(shipId)[0];
  if (signature) return quickBuildHint(signature);
  const hullRole = getShipDefinition(shipId)?.role ?? "light_fighter";
  return hullHint(hullRole, HULL_STYLE[hullRole]);
}

/**
 * modeHints — role + "best with" hints for Survival relics and Campaign
 * armory mods (P2-1). Relics read their designed archetype and pair with the
 * relics sharing the most synergy tags; armory mods read their squad
 * bonuses and pair with a complementary mod in another slot.
 *
 * Pure: no Phaser, no state.
 */

import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";
import { ARMORY_MODS, type ArmoryMod } from "../campaign/armory";
import { ALL_RELICS } from "../survival/relicCatalog";
import type { Relic, RelicArchetype } from "../survival/relics";
import { MAX_HINT_CHARS, bestWithLine, type RoleHint } from "./cardHints";
import {
  PLAYSTYLES,
  ROLE_PLURALS,
  addVote,
  dominantPlaystyle,
  roleLine,
  type Playstyle,
  type PlaystyleScores,
} from "./playstyles";

const ARCHETYPE_STYLE: Readonly<Record<RelicArchetype, Playstyle>> = {
  ace: "interceptor",
  hunter: "hunter",
  squadron: "wingman",
  bulwark: "tank",
  salvager: "salvager",
};

/** Relics cited per hint. */
const MAX_RELIC_PAIRS = 2;

/**
 * @param a - A relic.
 * @param b - Another relic.
 * @returns How many synergy tags they share.
 */
function sharedTags(a: Relic, b: Relic): number {
  return a.tags.filter((tag) => b.tags.includes(tag)).length;
}

/**
 * @param relic - A relic.
 * @returns Its role and the relics it combos with (most shared tags, then
 *   same archetype, then name).
 */
export function relicHint(relic: Relic): RoleHint {
  const s = ARCHETYPE_STYLE[relic.archetype];
  const score = (other: Relic): number =>
    sharedTags(relic, other) * 2 +
    (other.archetype === relic.archetype ? 1 : 0);
  const pairs = ALL_RELICS.filter(
    (other) => other.id !== relic.id && sharedTags(relic, other) > 0,
  )
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, MAX_RELIC_PAIRS)
    .map((other) => other.name);
  const kept = stackLine(pairs);
  return {
    playstyle: s,
    role: roleLine(s),
    bestWith: kept ? kept.line : `Best with ${PLAYSTYLES[s].squadPartner}`,
    pairsWith: kept ? kept.names : [],
  };
}

/**
 * "Stacks with A, B", dropping names until it fits one line.
 *
 * @param names - Combo relics, best first.
 * @returns The line and the names kept, or null when there are none.
 */
function stackLine(
  names: readonly string[],
): { readonly line: string; readonly names: readonly string[] } | null {
  for (let count = names.length; count > 0; count--) {
    const kept = names.slice(0, count);
    const line = `Stacks with ${kept.join(", ")}`;
    if (line.length <= MAX_HINT_CHARS) return { line, names: kept };
  }
  return null;
}

type BonusKey = keyof CampaignShipBonuses;
type Helps = (value: number) => boolean;
const above: Helps = (value) => value > 0;
const growth: Helps = (value) => value > 1;
const shrink: Helps = (value) => value < 1;

const BONUS_STYLE: ReadonlyArray<readonly [BonusKey, Playstyle, Helps]> = [
  ["hullMultiplier", "tank", growth],
  ["shieldMultiplier", "tank", growth],
  ["shieldRegenPerSecond", "tank", above],
  ["damageTakenMultiplier", "tank", shrink],
  ["attackBonus", "striker", above],
  ["weaponIntervalMultiplier", "striker", shrink],
  ["agilityBonus", "interceptor", above],
  ["powerCooldownMultiplier", "commander", shrink],
  ["researchPerBonus", "commander", above],
  ["creditMultiplier", "salvager", growth],
  ["escortAttackBonus", "wingman", above],
];

/**
 * @param mod - An armory mod.
 * @returns The style its squad bonuses serve.
 */
export function armoryPlaystyle(mod: ArmoryMod): Playstyle {
  let scores: PlaystyleScores = {};
  for (const [key, voted, helps] of BONUS_STYLE) {
    const value = mod.bonuses[key];
    if (value !== undefined && helps(value)) scores = addVote(scores, voted);
  }
  return dominantPlaystyle(scores, "striker");
}

/**
 * Armory complements: squad-wide mods pair a defensive pick with an
 * offensive one (the general style partners have no armory mods).
 */
const ARMORY_COMPLEMENT: Partial<Record<Playstyle, Playstyle>> = {
  tank: "striker",
  striker: "tank",
  interceptor: "striker",
  commander: "striker",
};

/**
 * @param mod - An armory mod.
 * @returns Its role, the hulls it suits, and a complementary mod in
 *   another slot (complement style first, then the same style).
 */
export function armoryHint(mod: ArmoryMod): RoleHint {
  const s = armoryPlaystyle(mod);
  const partner = ARMORY_COMPLEMENT[s] ?? PLAYSTYLES[s].partner;
  const rank = (other: ArmoryMod): number => {
    const own = armoryPlaystyle(other);
    return own === partner ? 0 : own === s ? 1 : 2;
  };
  const pair = ARMORY_MODS.filter((other) => other.slot !== mod.slot)
    .sort((a, b) => rank(a) - rank(b) || a.cost - b.cost)
    .slice(0, 1)
    .map((other) => other.name);
  const role = PLAYSTYLES[s].bestRoles[0];
  const lead = `Best with ${role ? ROLE_PLURALS[role] : "any squad"}`;
  const { line, kept } = bestWithLine(lead, pair);
  return { playstyle: s, role: roleLine(s), bestWith: line, pairsWith: kept };
}

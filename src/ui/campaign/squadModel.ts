/**
 * squadModel — what the squad panel says: campaign totals and the roster
 * (overview), the selected pilot's ship numbers (stats), equipped abilities
 * (loadout) and skill / xp progress (pilot). Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import { getShipDefinition } from "../../data/ShipDefinitions";
import type { TermId } from "../../data/tooltips";
import type { CampaignPilotState } from "../../campaign/save/campaignSaveTypes";
import {
  getMaxEquippedAbilities,
  getPilotDefinition,
  MAX_PILOT_SKILL,
  xpToNextLevel,
} from "../../systems/CampaignPilotManager";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { abilityDisplayName } from "../idLabels";
import type { Tone } from "./optionPanelTypes";

/** Skill from which a pilot row is highlighted as a veteran. */
const SKILL_HIGH = 5;
/** Skill from which a pilot row is highlighted as experienced. */
const SKILL_MID = 3;

/** A figure with the term that explains it. */
export interface TermText {
  readonly text: string;
  readonly term: TermId;
}

/** One roster row. */
export interface RosterRow {
  readonly pilotId: string;
  /** "CALLSIGN · SKILL 3". */
  readonly text: string;
  readonly tone: Tone;
}

/** One number of the selected pilot's ship. */
export interface PilotStatRow {
  readonly label: string;
  readonly value: string;
  readonly term: TermId;
}

/** One equipped ability. */
export interface AbilityLine {
  readonly name: string;
  readonly description: string;
}

/**
 * @param save - Campaign totals.
 * @returns Experience, credits, research points and kills with their units.
 */
export function squadTotals(save: {
  readonly totalXp: number;
  readonly credits: number;
  readonly researchPoints: number;
  readonly totalKills: number;
}): readonly TermText[] {
  return [
    { text: `${save.totalXp} XP`, term: "campaign.stat_xp" },
    { text: `${save.credits} CR`, term: "campaign.stat_credits" },
    { text: `${save.researchPoints} RESEARCH`, term: "campaign.stat_research" },
    { text: `${save.totalKills} KILLS`, term: "campaign.stat_kills" },
  ];
}

function skillTone(skill: number): Tone {
  if (skill >= SKILL_HIGH) return "warn";
  return skill >= SKILL_MID ? "accent" : "muted";
}

/**
 * @param factionId - Campaign faction.
 * @param pilots - Squad pilots.
 * @returns One row per pilot: callsign and skill.
 */
export function rosterRows(
  factionId: FactionId,
  pilots: readonly CampaignPilotState[],
): readonly RosterRow[] {
  return pilots.map((pilot) => ({
    pilotId: pilot.pilotId,
    text: `${(getPilotDefinition(factionId, pilot.pilotId)?.callsign ?? pilot.pilotId.toUpperCase())} \u00b7 SKILL ${pilot.pilotSkill}`,
    tone: skillTone(pilot.pilotSkill),
  }));
}

/**
 * @param pilot - A squad pilot.
 * @returns Hull, shields, attack and agility of their ship, with evolution bonuses in brackets.
 */
export function pilotStatRows(pilot: CampaignPilotState): readonly PilotStatRow[] {
  const base = getShipDefinition(pilot.currentShipId)?.baseStats;
  const bonus = pilot.statBonuses;
  const value = (own: number | undefined, extra: number): string =>
    extra > 0 ? `${(own ?? 0) + extra} (+${extra})` : String(own ?? 0);
  return [
    { label: "HULL", value: value(base?.hull, bonus.hull), term: "stat.hull" },
    { label: "SHIELDS", value: value(base?.shields, bonus.shields), term: "stat.shields" },
    { label: "ATTACK", value: value(base?.attack, bonus.attack), term: "stat.attack" },
    { label: "AGILITY", value: value(base?.agility, bonus.agility), term: "stat.agility" },
  ];
}

function abilityLine(id: string): AbilityLine {
  const card = UPGRADE_DEFINITIONS[id];
  return {
    name: card?.name ?? abilityDisplayName(id),
    description: card?.description ?? "",
  };
}

/**
 * @param _factionId - Campaign faction (reserved for faction-specific slots).
 * @param pilot - A squad pilot.
 * @returns Equipped abilities and how many slots the pilot's skill allows.
 */
export function pilotLoadout(
  _factionId: FactionId,
  pilot: CampaignPilotState,
): { slotsText: string; abilities: readonly AbilityLine[] } {
  const slots = getMaxEquippedAbilities(pilot.pilotSkill);
  return {
    slotsText: `ABILITY SLOTS ${pilot.equippedAbilityIds.length} / ${slots}`,
    abilities: pilot.equippedAbilityIds.map(abilityLine),
  };
}

/**
 * @param factionId - Campaign faction.
 * @param pilot - A squad pilot.
 * @returns Skill, xp to the next level, next unlock and role lines.
 */
export function pilotProgress(
  factionId: FactionId,
  pilot: CampaignPilotState,
): {
  skillText: string;
  xpText: string;
  nextText: string;
  roleText: string;
} {
  const def = getPilotDefinition(factionId, pilot.pilotId);
  const missing = xpToNextLevel(pilot.xp);
  const nextId = def?.levelAbilityMap[pilot.pilotSkill + 1];
  return {
    skillText: `SKILL ${pilot.pilotSkill} / ${MAX_PILOT_SKILL}`,
    xpText: `${pilot.xp} XP \u00b7 ${missing === null ? "MAX" : `${missing} TO NEXT`}`,
    nextText: nextId
      ? `NEXT UNLOCK \u00b7 ${abilityLine(nextId).name} (SKILL ${pilot.pilotSkill + 1})`
      : "NEXT UNLOCK \u2014",
    roleText: def?.role === "protagonist" ? "PROTAGONIST" : "SUPPORT",
  };
}

/** Panel height with no pilot rows beyond the first three (px, 8 px grid). */
const SQUAD_PANEL_BASE_HEIGHT = 328;
/** Everything above and below the roster rows on the overview (px). */
const SQUAD_PANEL_FIXED = 168;
/** Height of one roster row with its gap (px). */
export const ROSTER_ROW_STRIDE = 48;

/**
 * @param pilotCount - Pilots in the squad.
 * @returns Panel height: the base size, grown when the roster needs more rows.
 */
export function squadPanelHeight(pilotCount: number): number {
  return Math.max(
    SQUAD_PANEL_BASE_HEIGHT,
    SQUAD_PANEL_FIXED + pilotCount * ROSTER_ROW_STRIDE,
  );
}

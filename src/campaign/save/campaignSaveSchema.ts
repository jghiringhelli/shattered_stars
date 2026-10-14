/**
 * campaignSaveSchema — validates and migrates a raw campaign save (any
 * version ≤ current) into the current schema without losing data: every
 * known field is type-checked and kept; missing or malformed fields fall back
 * to safe defaults (v2 → v3 derives hero power ranks from completed missions;
 * v3 → v4 adds the slot).
 * Only input that is not an object at all is rejected. Pure.
 */

import type { FactionId } from "../../config";
import { heroPowerRanksFor } from "../powers/heroPowerState";
import {
  CAMPAIGN_SAVE_VERSION,
  type CampaignPilotState,
  type CampaignSaveData,
  type CampaignSlot,
} from "./campaignSaveTypes";

/** Valid research picks. */
const RESEARCH_PICKS: ReadonlySet<string> = new Set(["A", "B"]);

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

/**
 * @param value - Raw value.
 * @param accept - Per-entry value test.
 * @returns The record's valid entries.
 */
function recordOf<T>(
  value: unknown,
  accept: (v: unknown) => v is T,
): Record<string, T> {
  if (!isRecord(value)) return {};
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(value))
    if (accept(entry)) out[key] = entry;
  return out;
}

const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isPick = (v: unknown): v is "A" | "B" =>
  typeof v === "string" && RESEARCH_PICKS.has(v);

/**
 * @param value - Raw pilot.
 * @returns A valid pilot state, or null when it has no pilot id.
 */
function pilotOf(value: unknown): CampaignPilotState | null {
  if (!isRecord(value) || typeof value["pilotId"] !== "string") return null;
  const bonuses = isRecord(value["statBonuses"]) ? value["statBonuses"] : {};
  return {
    pilotId: value["pilotId"],
    currentShipId:
      typeof value["currentShipId"] === "string" ? value["currentShipId"] : "",
    pilotSkill: num(value["pilotSkill"], 1),
    xp: num(value["xp"], 0),
    unlockedAbilityIds: strings(value["unlockedAbilityIds"]),
    equippedAbilityIds: strings(value["equippedAbilityIds"]),
    statBonuses: {
      hull: num(bonuses["hull"], 0),
      shields: num(bonuses["shields"], 0),
      attack: num(bonuses["attack"], 0),
      agility: num(bonuses["agility"], 0),
    },
    evolutionChoiceIds: strings(value["evolutionChoiceIds"]),
  };
}

/**
 * @param raw - Raw save object.
 * @param factionId - Faction the save belongs to (its storage key).
 * @param slot - Storage slot.
 * @returns The v1/v2 fields, validated.
 */
function legacyFields(
  raw: Raw,
  factionId: FactionId,
  slot: CampaignSlot,
): Omit<CampaignSaveData, keyof V3Fields> {
  const completedMissions = [...new Set(strings(raw["completedMissions"]))];
  return {
    version: CAMPAIGN_SAVE_VERSION,
    factionId,
    slot,
    currentMission: Math.max(
      1,
      num(raw["currentMission"], completedMissions.length + 1),
    ),
    completedMissions,
    totalXp: num(raw["totalXp"], 0),
    credits: Math.max(0, num(raw["credits"], 0)),
    totalKills: num(raw["totalKills"], 0),
    shipsLost: num(raw["shipsLost"], 0),
    unlockedShips: strings(raw["unlockedShips"]),
    lastPlayed: num(raw["lastPlayed"], Date.now()),
    campaignPilots: Array.isArray(raw["campaignPilots"])
      ? raw["campaignPilots"]
          .map(pilotOf)
          .filter((p): p is CampaignPilotState => p !== null)
      : [],
    pendingEvolution: bool(raw["pendingEvolution"], false),
  };
}

/** The fields introduced by v3. */
type V3Fields = Pick<
  CampaignSaveData,
  | "storyFlags"
  | "branchChoices"
  | "researchPoints"
  | "research"
  | "armory"
  | "heroPowerRanks"
  | "bonusObjectivesCompleted"
  | "campaignComplete"
>;

/**
 * @param raw - Raw save object.
 * @param factionId - Faction.
 * @param completedCount - Missions completed.
 * @returns The v3 fields, validated (defaults for older saves).
 */
function v3Fields(
  raw: Raw,
  factionId: FactionId,
  completedCount: number,
): V3Fields {
  const armory = isRecord(raw["armory"]) ? raw["armory"] : {};
  const derivedRanks = heroPowerRanksFor(factionId, completedCount);
  const savedRanks = recordOf(raw["heroPowerRanks"], isNum);
  const heroPowerRanks: Record<string, number> = {};
  for (const id of Object.keys(derivedRanks)) {
    heroPowerRanks[id] = Math.max(derivedRanks[id] ?? 0, savedRanks[id] ?? 0);
  }
  return {
    storyFlags: recordOf(raw["storyFlags"], isBool),
    branchChoices: recordOf(raw["branchChoices"], isStr),
    researchPoints: Math.max(0, num(raw["researchPoints"], 0)),
    research: recordOf(raw["research"], isPick),
    armory: { installed: recordOf(armory["installed"], isNum) },
    heroPowerRanks,
    bonusObjectivesCompleted: [
      ...new Set(strings(raw["bonusObjectivesCompleted"])),
    ],
    campaignComplete: bool(raw["campaignComplete"], false),
  };
}

/**
 * Validates and migrates a raw save to the current schema.
 *
 * @param raw - Parsed JSON.

 * @param factionId - Faction whose key it was stored under (the lead hero for
 *   a Coalition save: the stored faction wins when valid).
 * @param slot - Storage slot (defaults to the faction).
 * @returns The save, or null if it is not an object.
 */
export function migrateCampaignSave(
  raw: unknown,
  factionId: FactionId,
  slot: CampaignSlot = factionId,
): CampaignSaveData | null {
  if (!isRecord(raw)) return null;
  const legacy = legacyFields(raw, factionId, slot);
  return {
    ...legacy,
    ...v3Fields(raw, factionId, legacy.completedMissions.length),
  };
}

/**
 * @param factionId - Faction.
 * @returns The v3 fields of a brand-new playthrough.
 */
export function freshV3Fields(factionId: FactionId): V3Fields {
  return v3Fields({}, factionId, 0);
}

/**
 * chronicleRules — the Chronicle's pure rules (docs/lore/campaign_arc.md §3):
 * shared flags, "first witness writes canon" with exclusive flag groups,
 * derived flags (keys, joint breakout), unity and key counts, act completion
 * and seeding the Chronicle from saves made before it existed. Pure.
 */

import type { FactionId } from "../../config";
import type { FactionCampaign } from "../../data/campaign/campaignTypes";
import {
  CHRONICLE_FLAGS,
  DERIVED_FLAGS,
  EXCLUSIVE_FLAG_GROUPS,
  FACTION_KEYS,
  UNITY_FLAGS,
  crossoversOfMission,
} from "../../data/campaign/crossovers";
import {
  CHRONICLE_VERSION,
  type ChronicleData,
  type ChronicleVictory,
  type CrossoverRecord,
} from "./chronicleTypes";

type Flags = Readonly<Record<string, boolean>>;

/** @returns A Chronicle with nothing resolved (Free Order off). */
export function emptyChronicle(): ChronicleData {
  return {
    version: CHRONICLE_VERSION,
    flags: {},
    crossovers: {},
    actsComplete: {},
    freeOrder: false,
    ending: null,
  };
}

/**
 * @param flags - Flags.
 * @returns The flags plus the derived ones (keys, joint breakout) that hold.
 */
export function deriveFlags(flags: Flags): Record<string, boolean> {
  const out: Record<string, boolean> = { ...flags };
  for (const rule of DERIVED_FLAGS) {
    const all = rule.allOf?.every((f) => out[f] === true) ?? true;
    const any = rule.anyOf?.some((f) => out[f] === true) ?? true;
    if (all && any) out[rule.flag] = true;
  }
  return out;
}

/**
 * @param flag - A flag.
 * @param chronicleFlags - Flags already in the Chronicle.
 * @returns Whether canon has already taken the opposite side of an
 *   exclusive group containing it.
 */
function isBlocked(flag: string, chronicleFlags: Flags): boolean {
  return EXCLUSIVE_FLAG_GROUPS.some(
    (group) =>
      group.includes(flag) &&
      group.some((other) => other !== flag && chronicleFlags[other] === true),
  );
}

/**
 * Drops the flags a second witness may not write: a flag whose exclusive
 * counterpart is already canon (the first witness wins).
 *
 * @param storyFlags - Flags a mission persisted.
 * @param chronicleFlags - The Chronicle's flags.
 * @returns The flags that may be saved.
 */
export function canonFilter(
  storyFlags: Flags,
  chronicleFlags: Flags,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [flag, value] of Object.entries(storyFlags))
    if (!isBlocked(flag, chronicleFlags)) out[flag] = value;
  return out;
}

/**
 * @param record - A crossover's record, if any.
 * @param faction - A witness.
 * @param missionId - The witness's mission.
 * @returns The record with the witness added (canon when first).
 */
function withWitness(
  record: CrossoverRecord | undefined,
  faction: FactionId,
  missionId: string,
): CrossoverRecord {
  if (!record)
    return { canonFaction: faction, canonMissionId: missionId, witnesses: [faction] };
  if (record.witnesses.includes(faction)) return record;
  return { ...record, witnesses: [...record.witnesses, faction] };
}

/**
 * Folds a mission win into the Chronicle.
 *
 * @param chronicle - Chronicle before.
 * @param victory - The win.
 * @returns The new Chronicle.
 */
export function recordVictory(
  chronicle: ChronicleData,
  victory: ChronicleVictory,
): ChronicleData {
  const written: Record<string, boolean> = { ...chronicle.flags };
  for (const [flag, value] of Object.entries(victory.storyFlags)) {
    if (value !== true || !CHRONICLE_FLAGS.has(flag)) continue;
    if (!isBlocked(flag, written)) written[flag] = true;
  }
  const crossovers: Record<string, CrossoverRecord> = { ...chronicle.crossovers };
  for (const crossover of crossoversOfMission(victory.missionId)) {
    const sideOfFaction = crossover.sides.some(
      (s) =>
        s.faction === victory.faction && s.missionIds.includes(victory.missionId),
    );
    if (sideOfFaction)
      crossovers[crossover.id] = withWitness(
        crossovers[crossover.id],
        victory.faction,
        victory.missionId,
      );
  }
  const acts = new Set([
    ...(chronicle.actsComplete[victory.campaignId] ?? []),
    ...victory.actsComplete,
  ]);
  return {
    ...chronicle,
    flags: deriveFlags(written),
    crossovers,
    actsComplete: {
      ...chronicle.actsComplete,
      [victory.campaignId]: [...acts].sort((a, b) => a - b),
    },
  };
}

/**
 * @param storyFlags - A save's story flags.
 * @param chronicle - The Chronicle.
 * @param extra - Extra flags (e.g. the Coalition's lead markers).
 * @returns The flags a mission is played with: the save's, then the
 *   Chronicle's canon (exclusive counterparts of canon read false).
 */
export function effectiveFlags(
  storyFlags: Flags,
  chronicle: ChronicleData,
  extra: Flags = {},
): Record<string, boolean> {
  const merged: Record<string, boolean> = {
    ...storyFlags,
    ...chronicle.flags,
  };
  for (const group of EXCLUSIVE_FLAG_GROUPS) {
    if (!group.some((f) => chronicle.flags[f] === true)) continue;
    for (const f of group) if (chronicle.flags[f] !== true) merged[f] = false;
  }
  return { ...deriveFlags(merged), ...extra };
}

/**
 * @param flags - Chronicle flags.
 * @returns Coalition Unity: how many of the 12 unity flags are set.
 */
export function unityCount(flags: Flags): number {
  return UNITY_FLAGS.filter((f) => flags[f] === true).length;
}

/**
 * @param flags - Chronicle flags.
 * @returns The key flags earned (of the five faction keys).
 */
export function earnedKeys(flags: Flags): string[] {
  return FACTION_KEYS.filter((k) => flags[k.flag] === true).map((k) => k.flag);
}

/**
 * @param campaign - A campaign.
 * @param completedIds - Completed mission ids.
 * @returns The acts in which every mission slot has a completed mission.
 */
export function completedActs(
  campaign: FactionCampaign,
  completedIds: readonly string[],
): number[] {
  const acts = new Set(campaign.missions.map((m) => m.act));
  return [...acts]
    .filter((act) =>
      campaign.missions
        .filter((m) => m.act === act)
        .every((m) =>
          campaign.missions.some(
            (other) =>
              other.missionNumber === m.missionNumber &&
              completedIds.includes(other.id),
          ),
        ),
    )
    .sort((a, b) => a - b);
}

/** What seeding reads from an existing save. */
export interface SeedSave {
  readonly faction: FactionId;
  readonly campaign: FactionCampaign;
  readonly completedMissions: readonly string[];
  readonly storyFlags: Flags;
  readonly lastPlayed: number;
}

/**
 * Builds the Chronicle for saves made before it existed (v3 → v4): the
 * oldest save is treated as the first witness.
 *
 * @param saves - Existing faction playthroughs.
 * @returns The seeded Chronicle.
 */
export function seedChronicle(saves: readonly SeedSave[]): ChronicleData {
  let chronicle = emptyChronicle();
  const ordered = [...saves].sort((a, b) => a.lastPlayed - b.lastPlayed);
  for (const save of ordered) {
    const actsComplete = completedActs(save.campaign, save.completedMissions);
    const missions =
      save.completedMissions.length > 0 ? save.completedMissions : [""];
    missions.forEach((missionId, index) => {
      chronicle = recordVictory(chronicle, {
        missionId,
        faction: save.faction,
        campaignId: save.faction,
        storyFlags: index === 0 ? save.storyFlags : {},
        actsComplete,
      });
    });
  }
  return chronicle;
}

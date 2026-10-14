/**
 * actUnlocks — the Rule of N (docs/lore/campaign_arc.md §2): Act N of a
 * faction opens once Act N−1 is complete in at least N factions, the
 * faction's own among them. All five Act I campaigns are always open. The
 * Coalition's Act IV needs Act III in four factions; Act V needs Act IV and
 * Act III in all five. Free Order lifts the cross-faction part. Progress
 * already made is never taken away. Pure.
 */

import type { FactionId } from "../../config";
import type { ChronicleData } from "./chronicleTypes";

/** Faction campaign acts (story Acts I-III). */
export const FACTION_ACTS = [1, 2, 3] as const;
/** The Coalition's acts. */
export const COALITION_ACTS = [4, 5] as const;
/** Factions in the galaxy. */
export const FACTION_COUNT = 5;
/** Factions that must have finished Act III before Act IV opens. */
export const ACT_IV_FACTIONS_REQUIRED = 4;
/** With Free Order: factions that must have finished Act III before Act IV. */
const FREE_ORDER_ACT_IV_FACTIONS = 1;

/** State of an act in the hub. */
export type ActState = "complete" | "open" | "locked";

/** An act's state and, when locked, why. */
export interface ActStatus {
  readonly act: number;
  readonly state: ActState;
  /** Hub text explaining a lock. */
  readonly reason?: string;
  /** How many more factions (or acts) are missing. */
  readonly missing: number;
}

/** Act numbers as the story names them. */
const ROMAN = ["", "I", "II", "III", "IV", "V"] as const;

/**
 * @param act - Act 1-5.
 * @returns Its numeral.
 */
export const actNumeral = (act: number): string => ROMAN[act] ?? `${act}`;

/**
 * @param chronicle - The Chronicle.
 * @param act - An act.
 * @returns How many factions have completed it.
 */
export function factionsCompleting(
  chronicle: ChronicleData,
  act: number,
): number {
  return (
    Object.entries(chronicle.actsComplete) as [string, readonly number[]][]
  ).filter(([id, acts]) => id !== "coalition" && acts.includes(act)).length;
}

const plural = (n: number, one: string, many: string): string =>
  n === 1 ? one : many;

/**
 * @param chronicle - The Chronicle.
 * @param faction - The faction.
 * @param act - 1-3.
 * @param startedActs - Acts in which the faction already has progress.
 * @returns The act's status for that faction's campaign.
 */
export function factionActStatus(
  chronicle: ChronicleData,
  faction: FactionId,
  act: number,
  startedActs: readonly number[] = [],
): ActStatus {
  const own = chronicle.actsComplete[faction] ?? [];
  if (own.includes(act)) return { act, state: "complete", missing: 0 };
  if (act === 1 || startedActs.includes(act))
    return { act, state: "open", missing: 0 };
  const previous = act - 1;
  if (!own.includes(previous))
    return {
      act,
      state: "locked",
      missing: 1,
      reason: `Complete Act ${actNumeral(previous)} of this campaign first`,
    };
  const missing = chronicle.freeOrder
    ? 0
    : Math.max(0, act - factionsCompleting(chronicle, previous));
  if (missing === 0) return { act, state: "open", missing: 0 };
  return {
    act,
    state: "locked",
    missing,
    reason:
      `ACT ${actNumeral(act)} — the war must be seen from another side first ` +
      `(complete Act ${actNumeral(previous)} in ${missing} more ` +
      `${plural(missing, "faction", "factions")})`,
  };
}

/**
 * @param chronicle - The Chronicle.
 * @param act - 4 or 5.
 * @param startedActs - Coalition acts already in progress.
 * @returns The Coalition act's status.
 */
export function coalitionActStatus(
  chronicle: ChronicleData,
  act: number,
  startedActs: readonly number[] = [],
): ActStatus {
  const own = chronicle.actsComplete["coalition"] ?? [];
  if (own.includes(act)) return { act, state: "complete", missing: 0 };
  if (startedActs.includes(act)) return { act, state: "open", missing: 0 };
  const done = factionsCompleting(chronicle, 3);
  if (act === 4) {
    const needed = chronicle.freeOrder
      ? FREE_ORDER_ACT_IV_FACTIONS
      : ACT_IV_FACTIONS_REQUIRED;
    const missing = Math.max(0, needed - done);
    if (missing === 0) return { act, state: "open", missing: 0 };
    return {
      act,
      state: "locked",
      missing,
      reason:
        `ACT IV — the Coalition forms when ${needed} ` +
        `${plural(needed, "campaign is", "campaigns are")} finished ` +
        `(Act III in ${missing} more ${plural(missing, "faction", "factions")})`,
    };
  }
  if (!own.includes(4))
    return {
      act,
      state: "locked",
      missing: 1,
      reason: "ACT V — complete Act IV of the Coalition first",
    };
  const missing = chronicle.freeOrder ? 0 : Math.max(0, FACTION_COUNT - done);
  if (missing === 0) return { act, state: "open", missing: 0 };
  return {
    act,
    state: "locked",
    missing,
    reason:
      `ACT V — the true ending needs every witness (Act III in ${missing} ` +
      `more ${plural(missing, "faction", "factions")})`,
  };
}

/**
 * @param chronicle - The Chronicle.
 * @param faction - The faction.
 * @param startedActs - Acts with progress in the faction's save.
 * @returns Status of acts I-III of the faction's campaign.
 */
export function factionActStatuses(
  chronicle: ChronicleData,
  faction: FactionId,
  startedActs: readonly number[] = [],
): ActStatus[] {
  return FACTION_ACTS.map((act) =>
    factionActStatus(chronicle, faction, act, startedActs),
  );
}

/**
 * @param chronicle - The Chronicle.
 * @param startedActs - Coalition acts in progress.
 * @returns Status of acts IV-V.
 */
export function coalitionActStatuses(
  chronicle: ChronicleData,
  startedActs: readonly number[] = [],
): ActStatus[] {
  return COALITION_ACTS.map((act) =>
    coalitionActStatus(chronicle, act, startedActs),
  );
}

/**
 * @param statuses - A campaign's act statuses.
 * @returns The acts the hub must not offer missions for.
 */
export function lockedActsOf(statuses: readonly ActStatus[]): number[] {
  return statuses.filter((s) => s.state === "locked").map((s) => s.act);
}

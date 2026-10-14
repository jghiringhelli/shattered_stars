/**
 * endings — which Act V endings the Chronicle allows (campaign_arc §6).
 * Answer (true): all five faction keys and Coalition Unity ≥ 7. Sever:
 * Unity ≥ 4. Seal: always available. The Quiet: the forced Seal when Unity
 * is below 4. Pure.
 */

import type { EndingId } from "../../data/campaign/crossovers";
import { deriveFlags, earnedKeys, unityCount } from "./chronicleRules";

/** Keys needed for the true ending. */
export const KEYS_FOR_ANSWER = 5;
/** Unity needed for the true ending. */
export const UNITY_FOR_ANSWER = 7;
/** Unity needed to be allowed Sever (below it the ending is forced). */
export const UNITY_FOR_SEVER = 4;

/** What the Chronicle allows at the end of Act V. */
export interface EndingOptions {
  readonly unity: number;
  readonly keys: number;
  /** Endings the player may choose, best first. */
  readonly available: readonly EndingId[];
  /** True when the only ending is forced (The Quiet). */
  readonly forced: boolean;
}

/**
 * @param chronicleFlags - Chronicle flags (derived keys are recomputed).
 * @returns The endings available and the unity / key counts behind them.
 */
export function endingOptions(
  chronicleFlags: Readonly<Record<string, boolean>>,
): EndingOptions {
  const flags = deriveFlags(chronicleFlags);
  const unity = unityCount(flags);
  const keys = earnedKeys(flags).length;
  if (unity < UNITY_FOR_SEVER)
    return { unity, keys, available: ["quiet"], forced: true };
  const available: EndingId[] = [];
  if (keys >= KEYS_FOR_ANSWER && unity >= UNITY_FOR_ANSWER)
    available.push("answer");
  available.push("sever", "seal");
  return { unity, keys, available, forced: false };
}

/**
 * @param flags - Chronicle flags.
 * @returns The best ending the Chronicle allows.
 */
export function bestEnding(flags: Readonly<Record<string, boolean>>): EndingId {
  return endingOptions(flags).available[0]!;
}

/**
 * @param flags - Chronicle flags.
 * @param ending - A chosen ending.
 * @returns Whether it is allowed.
 */
export function isEndingAllowed(
  flags: Readonly<Record<string, boolean>>,
  ending: EndingId,
): boolean {
  return endingOptions(flags).available.includes(ending);
}

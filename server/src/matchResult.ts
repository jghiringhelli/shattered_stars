/**
 * matchResult — decides a match's result from the seats' `match_over`
 * reports. The relay cannot simulate the battle, so one client's claim never
 * decides alone: a strict majority of the connected human seats must agree.
 * A split vote is settled by the authority seat's report only when every
 * seat's state hash agreed at the last comparison (the simulations were
 * identical, so the disagreement is about the report, not the game).
 * Anything else is "no result". Pure.
 */

import type { TeamId } from "../../src/net/protocol";

/** One connected human seat's vote. */
export interface ResultVote {
  readonly seat: number;
  /** The reported winner, or `undefined` when the seat has not reported. */
  readonly winner: TeamId | null | undefined;
}

/** The relay's verdict. */
export type ResultVerdict =
  | { readonly kind: "finished"; readonly winner: TeamId | null }
  | { readonly kind: "no_result" };

const NO_RESULT: ResultVerdict = { kind: "no_result" };

/**
 * @param voters - The connected human seats and what each reported.
 * @param authoritySeat - The authority seat (breaks a split vote).
 * @param stateAgreed - Whether the seats' latest compared state hashes matched.
 * @returns The agreed result, or no result.
 */
export function decideResult(
  voters: readonly ResultVote[],
  authoritySeat: number,
  stateAgreed: boolean,
): ResultVerdict {
  if (voters.length === 0) return NO_RESULT;
  const tally = new Map<TeamId | null, number>();
  for (const voter of voters)
    if (voter.winner !== undefined)
      tally.set(voter.winner, (tally.get(voter.winner) ?? 0) + 1);
  for (const [winner, count] of tally)
    if (count * 2 > voters.length) return { kind: "finished", winner };
  return splitVerdict(voters, tally, authoritySeat, stateAgreed);
}

function splitVerdict(
  voters: readonly ResultVote[],
  tally: ReadonlyMap<TeamId | null, number>,
  authoritySeat: number,
  stateAgreed: boolean,
): ResultVerdict {
  const everyoneReported = voters.every((v) => v.winner !== undefined);
  const authority = voters.find((v) => v.seat === authoritySeat)?.winner;
  if (!everyoneReported || !stateAgreed || authority === undefined)
    return NO_RESULT;
  const top = Math.max(...tally.values());
  const leaders = [...tally.values()].filter((count) => count === top);
  const authorityIsLeading = tally.get(authority) === top;
  return leaders.length > 1 && authorityIsLeading
    ? { kind: "finished", winner: authority }
    : NO_RESULT;
}

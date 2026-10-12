/**
 * roomSeats — pure seat and team rules of a room: the lowest free seat, and
 * which team a newcomer joins (teams alternate in 1v1 modes, the smaller
 * team in team modes).
 */

import {
  MODE_RULES,
  type MatchMode,
  type TeamId,
} from "../../src/net/protocol";

/** What the seat rules read of a member. */
export interface SeatedMember {
  readonly seat: number;
  readonly team: TeamId;
}

/** @param members - Seated members. @returns The lowest seat nobody holds. */
export function freeSeat(members: Iterable<SeatedMember>): number {
  const taken = new Set([...members].map((m) => m.seat));
  let seat = 0;
  while (taken.has(seat)) seat++;
  return seat;
}

/**
 * @param mode - Room mode.
 * @param seat - The newcomer's seat.
 * @param members - Members already seated.
 * @returns The newcomer's team.
 */
export function defaultTeam(
  mode: MatchMode,
  seat: number,
  members: Iterable<SeatedMember>,
): TeamId {
  if (!MODE_RULES[mode].teams) return seat % 2 === 0 ? 0 : 1;
  const all = [...members];
  const onTeamA = all.filter((m) => m.team === 0).length;
  return onTeamA <= all.length - onTeamA ? 0 : 1;
}

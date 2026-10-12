/**
 * teamFactions — the squad battles' side rule, shared by the relay (it will
 * not start a match that breaks it) and the lobby (it says why): in every
 * mode but the duel a side is one faction, so teammates fly the same
 * faction and the two teams fly different ones. Pure.
 */

import type { MatchMode, TeamId } from "./limits";

/** Why a room's factions cannot start a squad battle. */
export type TeamFactionConflict = "mixed_team" | "same_faction";

/** What the rule reads of a player. */
export interface TeamFactionPlayer {
  readonly team: TeamId;
  readonly loadout: { readonly faction: string } | null;
}

/**
 * @param mode - Match mode.
 * @returns Whether a side must be one faction (every squad battle).
 */
export function sidesAreFactions(mode: MatchMode): boolean {
  return mode !== "dogfight";
}

/**
 * @param mode - Match mode.
 * @param players - The room's players (players without a loadout are skipped).
 * @returns The conflict, or null when the factions can start.
 */
export function teamFactionConflict(
  mode: MatchMode,
  players: readonly TeamFactionPlayer[],
): TeamFactionConflict | null {
  if (!sidesAreFactions(mode)) return null;
  const byTeam = new Map<TeamId, Set<string>>();
  for (const p of players) {
    if (!p.loadout) continue;
    const set = byTeam.get(p.team) ?? new Set<string>();
    set.add(p.loadout.faction);
    byTeam.set(p.team, set);
  }
  const teams = [...byTeam.values()];
  if (teams.some((factions) => factions.size > 1)) return "mixed_team";
  const [a, b] = teams.map((factions) => [...factions][0]);
  return a !== undefined && a === b ? "same_faction" : null;
}

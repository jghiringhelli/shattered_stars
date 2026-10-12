/**
 * teams — side identity of a squad battle, separate from faction. Every
 * ship flies for a team (a non-negative integer); ships of different teams
 * are hostile, ships of the same team are allies, whatever their factions.
 * Faction stays a ship's look, quick builds, points and aura doctrine.
 *
 * Battle configs name a squad's team as `teamId: "team_<n>"` (Squad Builder,
 * online lobby). A squad without a team gets its own (backward compatible:
 * every squad of an old config is its own side, so a mirror match works).
 *
 * Pure.
 */

/** A team: a non-negative integer. */
export type TeamId = number;

/** Anything that flies for a team. */
export interface Teamed {
  readonly team: TeamId;
}

/** How a viewer sees a team. */
export type TeamRelation = "ally" | "enemy";

/** Prefix of a team's battle-config id and string side key. */
const TEAM_PREFIX = "team_";

/**
 * @param team - A team.
 * @returns Its string side key (squad commands, marks, weapon sides).
 */
export function teamKey(team: TeamId): string {
  return `${TEAM_PREFIX}${team}`;
}

/**
 * @param raw - A battle config's `teamId` (`"team_<n>"` or a number).
 * @returns The team, or null when absent or malformed.
 */
export function parseTeamId(raw: unknown): TeamId | null {
  if (typeof raw === "number") return isTeam(raw) ? raw : null;
  if (typeof raw !== "string" || !raw.startsWith(TEAM_PREFIX)) return null;
  const digits = raw.slice(TEAM_PREFIX.length);
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}

/**
 * Every squad's team: its declared one, else a team of its own that no
 * other squad uses.
 *
 * @param squads - The battle config's squads in order.
 * @returns One team per squad.
 */
export function assignSquadTeams(squads: readonly object[]): TeamId[] {
  const declared = squads.map((squad) =>
    parseTeamId((squad as { readonly teamId?: unknown }).teamId),
  );
  let next = declared.reduce<number>(
    (max, team) => (team === null ? max : Math.max(max, team + 1)),
    0,
  );
  return declared.map((team) => team ?? next++);
}

/**
 * @param a - A ship.
 * @param b - Another ship.
 * @returns Whether they fight each other (different teams).
 */
export function areHostile(a: Teamed, b: Teamed): boolean {
  return a.team !== b.team;
}

/**
 * @param a - A ship.
 * @param b - Another ship.
 * @returns Whether they fly for the same team.
 */
export function areAllies(a: Teamed, b: Teamed): boolean {
  return a.team === b.team;
}

/**
 * @param viewerTeam - The viewer's team.
 * @param team - The team looked at.
 * @returns Ally or enemy.
 */
export function relationOf(viewerTeam: TeamId, team: TeamId): TeamRelation {
  return viewerTeam === team ? "ally" : "enemy";
}

function isTeam(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

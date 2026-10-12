/**
 * reinforcementPilots — names and pilots of reinforced ships in the
 * Skirmish scene: a squad's director member key, fresh ship ids per pilot
 * (`player_n`, `ally_n`, `enemy_n`, matching the opening squads) and who
 * flies a deployment in the scene (by team: only the primary human's own
 * replacement is the scene's `player`).
 *
 * Pure.
 */

import type { DeployPilot, Deployment } from "../../../arcade/reinforcements";
import { teamKey, type TeamId } from "../../../arcade/teams";
import type { FactionId } from "../../../config";
import type { ArcadeSpawnSpec } from "../arcadeShipFactory";
import type { ReinforcementView } from "./reinforcementHudModel";

/** Id prefix of each pilot's ships (matches the opening squad's ids). */
const ID_PREFIX: Readonly<Record<DeployPilot, string>> = {
  player: "player",
  wingman: "ally",
  ai: "enemy",
};

/** Prefix of a squad's director member key. */
const MEMBER_PREFIX = "squad_";

/**
 * @param squad - A battle-config squad index.
 * @returns Its director member key.
 */
export function memberKey(squad: number): string {
  return `${MEMBER_PREFIX}${squad}`;
}

/**
 * @param member - A director member key.
 * @returns Its battle-config squad index, or -1.
 */
export function squadOfMember(member: string): number {
  const index = Number(member.replace(MEMBER_PREFIX, ""));
  return Number.isInteger(index) ? index : -1;
}

/**
 * Who flies a deployment in the scene (sprite size, ids, wingman AI): the
 * primary human's own ship is the `player`; any other ship of the player's
 * team is a wingman; every other team's ship is an AI enemy.
 *
 * @param deployment - The director's pilot and the ship's squad.
 * @param teams - The player's team, the primary human squad and every squad's team.
 * @returns The scene pilot.
 */
export function scenePilotOf(
  deployment: { readonly pilot: DeployPilot; readonly squad: number },
  teams: {
    readonly playerTeam: TeamId;
    readonly primarySquad: number;
    readonly squadTeams: readonly TeamId[];
  },
): DeployPilot {
  if (deployment.pilot === "player" && deployment.squad === teams.primarySquad)
    return "player";
  return teams.squadTeams[deployment.squad] === teams.playerTeam
    ? "wingman"
    : "ai";
}

/**
 * @param link - The player's team, every squad's team and the local squad.
 * @returns Who is looking: the local pilot's team side key and squad member key.
 */
export function localViewOf(link: {
  readonly playerTeam: TeamId;
  readonly squadTeams: readonly TeamId[];
  readonly localSquad: number | null;
}): ReinforcementView {
  const squad = link.localSquad;
  const team = squad === null ? undefined : link.squadTeams[squad];
  return {
    side: teamKey(team ?? link.playerTeam),
    member: squad === null ? null : memberKey(squad),
  };
}

/**
 * @param deployment - A ship the director deployed.
 * @param teams - The player's team, the primary human squad and every squad's team.
 * @param pose - Where it warps in.
 * @returns What the scene spawns: its team and squad, and who flies it.
 */
export function deploymentSpawnSpec(
  deployment: Deployment,
  teams: Parameters<typeof scenePilotOf>[1],
  pose: { readonly x: number; readonly y: number; readonly angle: number },
): ArcadeSpawnSpec {
  const squad = squadOfMember(deployment.member);
  return {
    id: deployment.shipId,
    definitionId: deployment.option.definitionId,
    loadoutId: deployment.option.loadoutId,
    faction: deployment.faction as FactionId,
    team: teams.squadTeams[squad] ?? teams.playerTeam,
    squad,
    pilot: scenePilotOf({ pilot: deployment.pilot, squad }, teams),
    ...pose,
  };
}

/**
 * @param pilot - Who will fly the ship.
 * @param isTaken - Whether an id is in use.
 * @returns The pilot's first free id (`enemy_3`, `ally_1`, `player_2`...).
 */
export function freshShipId(
  pilot: DeployPilot,
  isTaken: (id: string) => boolean,
): string {
  for (let n = 0; ; n++) {
    const id = `${ID_PREFIX[pilot]}_${n}`;
    if (!isTaken(id)) return id;
  }
}

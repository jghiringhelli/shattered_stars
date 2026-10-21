/**
 * roomEdits — the rules a room applies to lobby edits and to starting. Pure:
 * each function either refuses or applies the change to the member it gets.
 */

import {
  MODE_RULES,
  type Loadout,
  type MatchMode,
  type RoomOptions,
  type RoomPhase,
  type TeamId,
} from "../../src/net/protocol";
import { isOnlineScenarioId } from "../../src/net/rules/scenarioIds";
import { validateLoadout } from "../../src/net/rules/squadRules";
import { refuse, type Member, type Refusal } from "./roomTypes";

/**
 * @param mode - The room's mode.
 * @param member - The member editing (un-readied when the loadout is stored).
 * @param loadout - Proposed squad.
 * @returns A refusal, or null when stored.
 */
export function applyLoadout(
  mode: MatchMode,
  member: Member,
  loadout: Loadout,
): Refusal | null {
  const problem = validateLoadout(mode, loadout);
  if (problem) return refuse("invalid_loadout", problem);
  member.loadout = loadout;
  member.ready = false;
  return null;
}

/**
 * @param mode - The room's mode.
 * @param members - Everyone seated.
 * @param member - The member switching (un-readied when the team changes).
 * @param team - Team to join.
 * @returns A refusal or null.
 */
export function applyTeam(
  mode: MatchMode,
  members: readonly Member[],
  member: Member,
  team: TeamId,
): Refusal | null {
  const rules = MODE_RULES[mode];
  if (!rules.teams) return refuse("not_allowed", "Teams are fixed in this mode.");
  if (member.team === team) return null;
  const crew = members.filter((m) => m.team === team).length;
  if (crew >= rules.maxPerTeam) return refuse("team_full", "That team is full.");
  member.team = team;
  member.ready = false;
  return null;
}

/**
 * @param mode - The room's mode.
 * @param phase - The room's phase.
 * @param byHost - Whether the editor is the host.
 * @param options - Proposed options.
 * @returns A refusal, or null when the options are acceptable.
 */
export function optionsRefusal(
  mode: MatchMode,
  phase: RoomPhase,
  byHost: boolean,
  options: RoomOptions,
): Refusal | null {
  if (phase === "playing")
    return refuse("room_started", "The match already started.");
  if (!byHost)
    return refuse("not_host", "Only the room host can change options.");
  if (mode !== "scenario")
    return refuse("not_allowed", "This mode has no options.");
  if (!isOnlineScenarioId(options.scenarioId))
    return refuse("invalid_options", "Unknown scenario.");
  return null;
}

/**
 * @param mode - The room's mode.
 * @param phase - The room's phase.
 * @param members - Everyone seated, ordered by seat.
 * @returns Whether the room can start right now.
 */
export function canStartRoom(
  mode: MatchMode,
  phase: RoomPhase,
  members: readonly Member[],
): boolean {
  if (phase === "playing" || members.length < MODE_RULES[mode].minPlayers)
    return false;
  if (!members.every((m) => m.ready && m.connected && m.loadout)) return false;
  return new Set(members.map((m) => m.team)).size === 2;
}

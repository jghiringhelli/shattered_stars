/**
 * matchDefinition — the relay's own definition of a match. Every field is
 * decided here from the room (mode, scenario, teams, seat order), the
 * relay's rules (point limit) and the relay's randomness (seed, and the map
 * theme derived from it). Clients only supplied their validated loadouts.
 * Pure.
 */

import {
  MODE_RULES,
  computeInputDelay,
  type MatchMode,
  type MatchStart,
  type RoomOptions,
} from "../../src/net/protocol";
import { ONLINE_SCENARIO_IDS } from "../../src/net/rules/scenarioIds";
import { resolveMapTheme } from "../../src/rendering/spaceMap/mapThemes";
import type { Member } from "./roomTypes";

/** A match as the room decided it. */
export interface MatchDefinitionInput {
  readonly matchId: string;
  readonly seed: number;
  readonly mode: MatchMode;
  readonly options: RoomOptions;
  /** Seated members with loadouts, in seat order. */
  readonly members: readonly Member[];
}

/**
 * @param mode - Room mode.
 * @param options - Room options.
 * @returns The options the match runs with (a scenario room always names its scenario).
 */
export function resolveMatchOptions(
  mode: MatchMode,
  options: RoomOptions,
): RoomOptions {
  if (mode !== "scenario") return {};
  const scenarioId = options.scenarioId ?? ONLINE_SCENARIO_IDS[0];
  return scenarioId ? { scenarioId } : {};
}

/**
 * @param input - Room state at the start.
 * @returns The match every client builds identically.
 * @throws Error when a member has no loadout (the room must not start then).
 */
export function buildMatchStart(input: MatchDefinitionInput): MatchStart {
  const { members, mode } = input;
  return {
    matchId: input.matchId,
    seed: input.seed,
    mode,
    options: resolveMatchOptions(mode, input.options),
    mapTheme: resolveMapTheme(undefined, input.seed).id,
    pointLimit: MODE_RULES[mode].pointLimit,
    seats: members.map((m, seat) => {
      if (!m.loadout)
        throw new Error(`Member ${m.id} has no loadout at match start`);
      return {
        seat,
        playerId: m.id,
        name: m.name,
        team: m.team,
        loadout: m.loadout,
      };
    }),
    inputDelay: computeInputDelay(members.map((m) => m.pingMs)),
    authoritySeat: 0,
  };
}

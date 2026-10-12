/**
 * matchSetup — turns the relay's MatchStart into the battle configuration
 * the scenes consume, identically on every client.
 *
 * The rule that fixes the old "online Arcade" divergence (the same ship was
 * up to 5,667 px apart): the battle is built in canonical seat order and
 * never from the local player's point of view. Only `localSeat` differs
 * between clients, and only presentation (camera, HUD, which inputs are
 * sampled) may read it. Pure.
 */

import type { FactionId } from "../../config";
import { SCENARIO_IDS } from "../../arcade/scenarios";
import type { MatchStart, SeatView } from "../protocol";

/** Squad point limit of online team battles (the Skirmish standard). */
export const ONLINE_POINT_LIMIT = 200;

/**
 * Whether the lobby launches the battle scenes on match start. Off until the
 * battle scenes run on the lockstep session (Phase 2 of the online work:
 * DogfightScene / ArcadeBattleScene integration); until then a started
 * match shows a "battle link pending" card and returns to the room.
 */
export const ONLINE_BATTLES_ENABLED = false;

/** Online context every online battle carries (registry `battleConfig.online` / Dogfight init). */
export interface OnlineBattleContext {
  readonly matchId: string;
  readonly localSeat: number;
  readonly seatCount: number;
  readonly authoritySeat: number;
  readonly inputDelay: number;
}

/** One seat of an online dogfight. */
export interface OnlineDogfightSeat {
  readonly seat: number;
  readonly name: string;
  readonly faction: FactionId;
  readonly shipId: string;
}

/** DogfightScene init data for an online duel. */
export interface OnlineDogfightInit {
  readonly online: OnlineBattleContext;
  readonly seed: number;
  /** Canonical order: seat 0, seat 1. */
  readonly seats: readonly OnlineDogfightSeat[];
}

/**
 * @param match - The match.
 * @param playerId - This client's player id.
 * @returns Its seat, or -1 when not seated.
 */
export function localSeatOf(match: MatchStart, playerId: string): number {
  return match.seats.find((s) => s.playerId === playerId)?.seat ?? -1;
}

/**
 * @param match - The match.
 * @param localSeat - This client's seat.
 * @returns The online context.
 */
export function onlineContext(
  match: MatchStart,
  localSeat: number,
): OnlineBattleContext {
  return {
    matchId: match.matchId,
    localSeat,
    seatCount: match.seats.length,
    authoritySeat: match.authoritySeat,
    inputDelay: match.inputDelay,
  };
}

/**
 * ArcadeBattleScene's `battleConfig` for Skirmish / Scenario / Reinforcements.
 * Every human seat is listed in seat order with its own team; the local seat
 * is "player", the other humans "remote" (their ships take inputs from the
 * lockstep session), the rest of each squad flies as AI wingmen.
 *
 * @param match - The match.
 * @param localSeat - This client's seat.
 * @returns The registry battle config.
 */
export function buildOnlineBattleConfig(
  match: MatchStart,
  localSeat: number,
): Record<string, unknown> {
  const factions = match.seats.map((s) => ({
    factionId: s.loadout.faction,
    controller: s.seat === localSeat ? "player" : "remote",
    ships: [...s.loadout.ships],
    teamId: `team_${s.team}`,
    seat: s.seat,
  }));
  return {
    factions,
    gameMode: "arcade",
    pointLimit: ONLINE_POINT_LIMIT,
    seed: match.seed,
    online: onlineContext(match, localSeat),
    ...modeFields(match),
  };
}

/**
 * @param match - A dogfight match.
 * @param localSeat - This client's seat.
 * @returns DogfightScene init data.
 */
export function buildOnlineDogfightInit(
  match: MatchStart,
  localSeat: number,
): OnlineDogfightInit {
  return {
    online: onlineContext(match, localSeat),
    seed: match.seed,
    seats: match.seats.map((s: SeatView) => ({
      seat: s.seat,
      name: s.name,
      faction: s.loadout.faction as FactionId,
      shipId: s.loadout.ships[0] ?? "",
    })),
  };
}

/**
 * Mode fields of the battle config. Classic vs. reinforcements is stated
 * explicitly so no client falls back to its locally saved preference.
 */
function modeFields(match: MatchStart): Record<string, unknown> {
  switch (match.mode) {
    case "scenario":
      return {
        scenario: match.options.scenarioId ?? SCENARIO_IDS[0],
        battle: "classic",
      };
    case "reinforcements": {
      const sides: Record<string, { strategy: "balanced" }> = {};
      for (const seat of match.seats)
        sides[seat.loadout.faction] = { strategy: "balanced" };
      return {
        battle: "reinforcements",
        reinforcements: { format: "skirmish", sides },
      };
    }
    default:
      return { battle: "classic" };
  }
}

/**
 * Dogfight's default pairing — what a new Dogfight preselects (the player
 * can change both ships on the setup screen) and what the telemetry battery
 * and duel reports measure as "Dogfight 1v1".
 *
 * Sparrow v Stiletto (light fighters). With ordnance at x2
 * (ORDNANCE_DAMAGE_SCALE) DuelTempoSim, 600 rounds per tier over two seed
 * ranges and both seatings, gave the Sparrow 53 % (average), 55 % (expert)
 * and 49 % (novice) of decided rounds. Once the duel sim modelled own hull
 * repair and auras the Sparrow's seeker missile build edged ahead
 * (55 / 61 / 61 %, 200 rounds per tier); the Stiletto's agility 4 (a real
 * third agility die in real time) brings it to 39–50 % (balance pass
 * 2026-10-12, docs/balance/). Falcon v Legionnaire, the x10 default,
 * drifted to 59-60 % at x2; the original Falcon v Raptor went to the
 * Falcon 89-97 %. See docs/telemetry/dogfight-pairing.md.
 */

import type { FactionId } from "../config";

/** One side of the default pairing. */
export interface DogfightSide {
  readonly faction: FactionId;
  readonly shipId: string;
}

/** The ships a new Dogfight preselects, player first. */
export const DOGFIGHT_DEFAULT_PAIRING: {
  readonly player: DogfightSide;
  readonly enemy: DogfightSide;
} = {
  player: { faction: "free_confederation", shipId: "confed_sparrow" },
  enemy: { faction: "terran_hegemony", shipId: "terran_stiletto" },
};

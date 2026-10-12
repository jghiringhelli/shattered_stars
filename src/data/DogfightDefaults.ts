/**
 * Dogfight's default pairing — what a new Dogfight preselects (the player
 * can change both ships on the setup screen) and what the telemetry battery
 * and duel reports measure as "Dogfight 1v1".
 *
 * Raven v Raptor (43-pt interceptors). Once the bots stopped weaving (the
 * stale-turn fix in PilotHands, balance round 2) every 1v1 between price
 * classes became one-sided and the agile Stiletto beat the Sparrow 67 % at
 * average on every build pairing; screening 40 FC v TH default-build pairs
 * (DuelTempoSim, both seatings) left Raven v Raptor the fairest: the Raven
 * wins 50 % (average) and 57 % (expert) of 120 decided rounds; novices
 * mostly time out. Before: Sparrow v Stiletto (53 / 55 / 49 % at x2,
 * 39–50 % after the duel sim modelled repair and auras), Falcon v
 * Legionnaire (59–60 %), Falcon v Raptor (89–97 %). See
 * docs/telemetry/dogfight-pairing.md.
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
  player: { faction: "free_confederation", shipId: "confed_raven" },
  enemy: { faction: "terran_hegemony", shipId: "terran_raptor" },
};

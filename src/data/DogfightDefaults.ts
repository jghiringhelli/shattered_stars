/**
 * Dogfight's default pairing — what a new Dogfight preselects (the player
 * can change both ships on the setup screen) and what the telemetry battery
 * and duel reports measure as "Dogfight 1v1".
 *
 * Falcon (heavy fighter, 50 pts) v Legionnaire (heavy fighter, 55 pts):
 * same hull / shields / attack / agility, the Legionnaire without Evade.
 * DuelTempoSim, 300 seeds per tier, both seatings — the Falcon wins 49–53 %
 * (average v average), 54–60 % (expert) and 40–45 % of decided rounds
 * (novice). The old default, Falcon v Raptor (interceptor, 48 pts), went to
 * the Falcon 89–97 % of the time at every tier.
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
  player: { faction: "free_confederation", shipId: "confed_falcon" },
  enemy: { faction: "terran_hegemony", shipId: "terran_legionnaire" },
};

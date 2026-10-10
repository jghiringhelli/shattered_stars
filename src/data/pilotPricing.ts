/**
 * pilotPricing — what a pilot adds to the price of the ship they fly.
 *
 * A pilot is a surcharge on top of the bare hull, never the hull's price
 * again: +1 point per initiative level above 1, plus the point value of the
 * pilot's single signature ability. A generic initiative-1 cadet costs 0, so
 * the bare ship price is the price of flying it with a rookie.
 *
 * Pure: reads the ability catalogue, owns no state.
 */

import { PILOT_ABILITIES } from "../systems/PilotAbilities";

/** Points charged per initiative level above the rookie baseline. */
export const POINTS_PER_INITIATIVE = 1;

/** The initiative a rookie pilot flies at — the free baseline. */
export const ROOKIE_INITIATIVE = 1;

/** Thrown when a pilot card names an ability that has no definition. */
export class UnknownAbilityError extends Error {
  constructor(public readonly abilityId: string) {
    super(
      `Unknown pilot ability "${abilityId}" — it has no entry in PILOT_ABILITIES, so the pilot cannot be priced.`,
    );
    this.name = "UnknownAbilityError";
  }
}

/**
 * Surcharge a pilot adds to the bare ship.
 *
 * @param initiative - Pilot initiative (1–6).
 * @param abilityId - The pilot's signature ability, if any.
 * @returns Points added on top of the ship's base cost.
 * @throws UnknownAbilityError if the ability has no definition.
 */
export function derivePilotSurcharge(
  initiative: number,
  abilityId: string | undefined,
): number {
  const initiativeCost =
    Math.max(0, initiative - ROOKIE_INITIATIVE) * POINTS_PER_INITIATIVE;
  if (!abilityId) return initiativeCost;
  const ability = PILOT_ABILITIES[abilityId];
  if (!ability) throw new UnknownAbilityError(abilityId);
  return initiativeCost + ability.pointCost;
}

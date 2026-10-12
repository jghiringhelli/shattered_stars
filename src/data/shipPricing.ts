/**
 * shipPricing — the expected point cost of a bare hull, derived from the
 * levers that weigh in real-time play (docs/specs/ship-variants.md).
 *
 * A hull is priced against its role's anchor: the anchor's price plus the
 * value of every difference in hull, shields, attack, agility, speed bounds,
 * dial permissiveness and size. Hull, shields, attack and agility are read
 * as real-time combat reads them (ModeBalancing.combatStatsFor: the role's
 * modifiers, rounded to whole points / dice), not as printed on the card —
 * a card point that rounds away buys nothing in play, and two hulls that
 * fly and fight identically cost the same. Unit values and role anchors
 * were calibrated on the real engine (npm run balance:report, value per
 * point of every hull in squads; docs/balance/).
 *
 * Not priced, on purpose:
 * - Action lists — no real-time system reads them (boost, barrel roll,
 *   cloak, … are available to every ship), so they are flavour only.
 * - The slot bar — every card bolted into a slot is paid for by the
 *   loadout (src/data/loadoutPricing.ts). Variants trade slots, they do not
 *   buy them.
 * - Role-intrinsic behaviour (support and capital hulls project their
 *   faction aura by role; ModeBalancing gives each role its firing arc,
 *   range and cadence) — the same for every ship of a role, so it lives in
 *   the anchor price.
 *
 * Pure: no state — callers pass the stats and dial.
 */

import type { ShipSize } from "../config";
import type { ManeuverDefinition, ShipRole, ShipStats } from "../core/types";
import { dialSteps } from "./dialPermissiveness";
import { combatStatsFor } from "./ModeBalancing";

// ============================================
// Unit values (points per real-time lever step)
// ============================================

/** +1 real-time hull point (12 HP): squad value per point, measured. */
export const HULL_POINTS = 5;
/** +1 real-time shield point (12 HP, regenerates): measured. */
export const SHIELD_POINTS = 8;
/** +1 damage per hit (real-time attack): +50 % output on a 2-damage fighter. */
export const ATTACK_POINTS = 10;
/** +1 real-time agility die (−8 % hit chance against the ship): measured weak. */
export const AGILITY_POINTS = 2;
/** +1 top speed — the catalogue's `maxSpeedBonus` knob (abilityPricing). */
export const TOP_SPEED_POINTS = 4;
/** −1 minimum speed (slower turning circle, speed-0 hover) — half a top-speed step. */
export const LOW_SPEED_POINTS = 2;
/**
 * One size class larger (tiny → small → medium → large → huge): a longer
 * base flies longer templates every cycle, outweighing the bigger hitbox.
 * Fitted on the shipped roster (best fit 4–5 pts per class).
 */
export const SIZE_STEP_POINTS = 4;

/** Price of one stress-relief tier (Flight Astromech / Squadron Leader). */
const STRESS_RELIEF_TIER_POINTS = 4;
/**
 * Dial steps a relief tier is worth on a reference fighter dial: the
 * non-green stress entries a full tier eases across speeds 1–5.
 */
const DIAL_STEPS_PER_RELIEF_TIER = 11;
/** One dial step: one stress entry one difficulty greener (≈0.36 pts). */
export const DIAL_STEP_POINTS =
  STRESS_RELIEF_TIER_POINTS / DIAL_STEPS_PER_RELIEF_TIER;

/**
 * Capital hull/shield pools are ~6× a fighter's; one capital point buys a
 * third of what one fighter point does. Fitted on the capital roster.
 */
export const CAPITAL_DURABILITY_SCALE = 1 / 3;

/** Smallest allowed gap between a ship's price and its expected price. */
export const PRICE_TOLERANCE_POINTS = 3;
/** Allowed gap as a share of the expected price (wins for big hulls). */
export const PRICE_TOLERANCE_RATIO = 0.05;

// ============================================
// Size classes
// ============================================

/** Size classes, smallest first. */
const SIZE_ORDER: Readonly<Record<ShipSize, number>> = {
  tiny: 0,
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
};

// ============================================
// Role anchors
// ============================================

/** The priced levers of a hull. */
export interface PricingProfile {
  readonly hull: number;
  readonly shields: number;
  readonly attack: number;
  readonly agility: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly size: ShipSize;
  /** {@link dialSteps} of the ship's dial inside its speed band. */
  readonly dialSteps: number;
}

/** A role's reference hull: its levers and what it costs. */
export interface RoleAnchor {
  /** The ship this profile was taken from (documentation only). */
  readonly referenceShipId: string;
  readonly profile: PricingProfile;
  readonly pointCost: number;
  /** Multiplier on hull/shield unit values (capitals only). */
  readonly durabilityScale: number;
}

/**
 * One anchor per role. Anchor prices are the roster-calibrated price of the
 * reference profile (median residual of the role, rounded).
 */
export const ROLE_ANCHORS: Readonly<Record<ShipRole, RoleAnchor>> = {
  light_fighter: anchor("terran_stiletto", [1, 1, 1, 3, 1, 5, "tiny", 12], 37),
  interceptor: anchor("terran_viper", [2, 1, 2, 2, 1, 5, "small", 14], 43),
  heavy_fighter: anchor(
    "terran_centurion",
    [3, 2, 2, 1, 1, 4, "small", 11],
    58,
  ),
  bomber: anchor("terran_hammer", [4, 2, 1, 0, 1, 3, "medium", 9], 53),
  support: anchor("confed_crane", [3, 3, 0, 0, 1, 3, "medium", 7], 53),
  gunship: anchor("terran_vindicator", [5, 2, 3, 0, 1, 3, "medium", 7], 90),
  capital: anchor(
    "terran_imperator",
    [22, 12, 3, 0, 0, 2, "huge", 4],
    118,
    CAPITAL_DURABILITY_SCALE,
  ),
};

/** Compact anchor row: hull, shields, attack, agility, min, max, size, dial steps. */
type AnchorRow = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  ShipSize,
  number,
];

/**
 * Build a role anchor from a compact row.
 *
 * @param referenceShipId - Ship the profile was taken from.
 * @param row - The reference levers.
 * @param pointCost - Calibrated price of the reference profile.
 * @param durabilityScale - Hull/shield unit multiplier (default 1).
 * @returns The anchor.
 */
function anchor(
  referenceShipId: string,
  row: AnchorRow,
  pointCost: number,
  durabilityScale = 1,
): RoleAnchor {
  const [hull, shields, attack, agility, minSpeed, maxSpeed, size, steps] = row;
  return {
    referenceShipId,
    profile: {
      hull,
      shields,
      attack,
      agility,
      minSpeed,
      maxSpeed,
      size,
      dialSteps: steps,
    },
    pointCost,
    durabilityScale,
  };
}

// ============================================
// Pricing
// ============================================

/**
 * Extract the priced levers of a hull: hull, shields, attack and agility
 * as real-time combat reads them (miniature points, role modifiers and
 * rounding applied), speed bounds, size and dial.
 *
 * @param role - The ship's role (its real-time modifiers).
 * @param stats - The ship's base stats.
 * @param dial - The ship's maneuver dial.
 * @returns The ship's pricing profile.
 */
export function pricingProfile(
  role: ShipRole,
  stats: ShipStats,
  dial: readonly ManeuverDefinition[],
): PricingProfile {
  const live = combatStatsFor(role, stats, "continuous", 1);
  return {
    hull: live.hull,
    shields: live.shields,
    attack: live.attackDice,
    agility: live.agilityDice,
    minSpeed: stats.speed.min,
    maxSpeed: stats.speed.max,
    size: stats.size,
    dialSteps: dialSteps(dial, stats.speed),
  };
}

/** Where a hull's expected price comes from, lever by lever (unrounded). */
export interface PriceBreakdown {
  readonly anchor: number;
  readonly hull: number;
  readonly shields: number;
  readonly attack: number;
  readonly agility: number;
  readonly speed: number;
  readonly dial: number;
  readonly size: number;
  readonly total: number;
}

/**
 * Price a hull lever by lever against its role anchor.
 *
 * @param role - The ship's role (selects the anchor).
 * @param profile - The ship's priced levers.
 * @returns Each lever's contribution and the unrounded total.
 */
export function priceBreakdown(
  role: ShipRole,
  profile: PricingProfile,
): PriceBreakdown {
  const { profile: ref, pointCost, durabilityScale } = ROLE_ANCHORS[role];
  const parts = {
    anchor: pointCost,
    hull: (profile.hull - ref.hull) * HULL_POINTS * durabilityScale,
    shields: (profile.shields - ref.shields) * SHIELD_POINTS * durabilityScale,
    attack: (profile.attack - ref.attack) * ATTACK_POINTS,
    agility: (profile.agility - ref.agility) * AGILITY_POINTS,
    speed:
      (profile.maxSpeed - ref.maxSpeed) * TOP_SPEED_POINTS +
      (ref.minSpeed - profile.minSpeed) * LOW_SPEED_POINTS,
    dial: (profile.dialSteps - ref.dialSteps) * DIAL_STEP_POINTS,
    size: (SIZE_ORDER[profile.size] - SIZE_ORDER[ref.size]) * SIZE_STEP_POINTS,
  };
  const total = Object.values(parts).reduce((sum, value) => sum + value, 0);
  return { ...parts, total };
}

/**
 * Expected point cost of a bare hull (flown by a rookie, no upgrades).
 *
 * @param role - The ship's role.
 * @param stats - The ship's base stats.
 * @param dial - The ship's maneuver dial.
 * @returns Whole points.
 */
export function expectedPointCost(
  role: ShipRole,
  stats: ShipStats,
  dial: readonly ManeuverDefinition[],
): number {
  return Math.round(
    priceBreakdown(role, pricingProfile(role, stats, dial)).total,
  );
}

/**
 * How far a ship's authored price may sit from its expected price:
 * {@link PRICE_TOLERANCE_POINTS}, or {@link PRICE_TOLERANCE_RATIO} of the
 * expected price when that is larger.
 *
 * @param expected - The expected price.
 * @returns Allowed absolute gap in points.
 */
export function priceTolerance(expected: number): number {
  return Math.max(
    PRICE_TOLERANCE_POINTS,
    Math.round(expected * PRICE_TOLERANCE_RATIO),
  );
}

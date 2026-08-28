/**
 * ShipEfficiency — deterministic point-value analysis for every ship.
 *
 * Answers "is each ship worth its squad-point cost?" by combining an offensive
 * score (expected damage vs an average defender) with a durability score
 * (effective hull once agility mitigation is folded in), then dividing the
 * product by point cost. Ships are compared within their role, and outliers
 * (over- or under-costed) are flagged so most loadouts "make sense".
 */

import type { ShipRole, ShipDefinition } from "../core/types";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import { calculateExpectedDamage } from "../systems/CombatSystem";

/** Attack-dice count of the reference attacker used for durability scaling. */
const REFERENCE_ATTACK_DICE = 3;

/** Agility of the reference defender used for offensive scoring. */
const REFERENCE_DEFENSE_DICE = 2;

/** Per-die evade cancellation from a d8 defense die (3/8 evade faces). */
const EVADE_PER_DIE = 0.375;

/** Computed combat value of a ship relative to its point cost. */
export interface ShipValue {
  readonly id: string;
  readonly name: string;
  readonly faction: string;
  readonly role: ShipRole;
  readonly pointCost: number;
  /** Expected damage per shot vs a reference defender. */
  readonly offense: number;
  /** Effective hull after agility mitigation. */
  readonly durability: number;
  /** offense x durability — a fleet-value product. */
  readonly combatRating: number;
  readonly ratingPerPoint: number;
}

/** Ships flagged as mispriced within their role. */
export interface OutlierReport {
  readonly overCosted: ReadonlyArray<ShipValue>;
  readonly underCosted: ReadonlyArray<ShipValue>;
}

/**
 * Effective hull for a ship: raw hull+shields inflated by the damage its
 * agility is expected to cancel against a reference attacker.
 */
function effectiveDurability(
  hull: number,
  shields: number,
  agility: number,
): number {
  const rawHp = hull + shields;
  const expectedHits = REFERENCE_ATTACK_DICE * 0.5;
  const mitigated = Math.min(agility * EVADE_PER_DIE, expectedHits);
  const survivalFactor = Math.max(0.1, 1 - mitigated / expectedHits);
  return rawHp / survivalFactor;
}

/** Compute the combat value / point-efficiency of a single ship. */
export function computeShipValue(def: ShipDefinition): ShipValue {
  const s = def.baseStats;
  const offense = calculateExpectedDamage(s.attack, REFERENCE_DEFENSE_DICE);
  const durability = effectiveDurability(s.hull, s.shields, s.agility);
  const combatRating = offense * durability;
  return {
    id: def.id,
    name: def.name,
    faction: def.faction,
    role: def.role,
    pointCost: s.pointCost,
    offense,
    durability,
    combatRating,
    ratingPerPoint: s.pointCost > 0 ? combatRating / s.pointCost : 0,
  };
}

/** Compute values for every ship, sorted by rating-per-point (desc). */
export function rankShipsByEfficiency(
  defs: ReadonlyArray<ShipDefinition> = Object.values(SHIP_DEFINITIONS),
): ShipValue[] {
  return defs
    .map(computeShipValue)
    .sort((a, b) => b.ratingPerPoint - a.ratingPerPoint);
}

function meanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Flag ships whose rating-per-point deviates from their ROLE's average by more
 * than `stdDevs` standard deviations. Under-costed = too efficient for its
 * cost; over-costed = too weak for its cost.
 */
export function flagCostOutliers(
  values: ReadonlyArray<ShipValue>,
  stdDevs = 1.5,
): OutlierReport {
  const byRole = new Map<ShipRole, ShipValue[]>();
  for (const v of values) {
    const bucket = byRole.get(v.role) ?? [];
    bucket.push(v);
    byRole.set(v.role, bucket);
  }
  const overCosted: ShipValue[] = [];
  const underCosted: ShipValue[] = [];
  for (const bucket of byRole.values()) {
    if (bucket.length < 3) continue;
    const { mean, stdDev } = meanAndStdDev(bucket.map((v) => v.ratingPerPoint));
    if (stdDev === 0) continue;
    for (const v of bucket) {
      const z = (v.ratingPerPoint - mean) / stdDev;
      if (z >= stdDevs) underCosted.push(v);
      else if (z <= -stdDevs) overCosted.push(v);
    }
  }
  overCosted.sort((a, b) => a.ratingPerPoint - b.ratingPerPoint);
  underCosted.sort((a, b) => b.ratingPerPoint - a.ratingPerPoint);
  return { overCosted, underCosted };
}

/**
 * Real-time levers of a ship variant, for the ShipVariants invariants.
 *
 * A variant is what a player feels in a match: hull, shields, attack and
 * agility as real-time combat reads them (ModeBalancing.combatStatsFor —
 * a card point that rounds away is not felt), armour, speed bounds, the
 * stress-relevant cells of its dial, its size and its slot bar (with
 * ordnance charges). Action lists are flavour and deliberately absent
 * (docs/specs/ship-variants.md).
 */

import type { ShipDefinition } from "../../../src/core/types";
import { combatStatsFor } from "../../../src/data/ModeBalancing";
import { SHIP_DIALS } from "../../../src/data/ShipDefinitions";
import { SHIP_SLOTS } from "../../../src/data/ShipSlots";
import { SIZE_POINTS } from "../../../src/data/shipPricing";
import {
  STRESS_DIRECTIONS,
  stressDifficulty,
} from "../../../src/data/dialPermissiveness";

/** Fastest speed any dial uses. */
const TOP_DIAL_SPEED = 5;
/** Score of a dial cell: unavailable < red < white < green. */
const CELL_SCORE = { red: 0, white: 1, green: 2 } as const;
const UNAVAILABLE = -1;

/** The comparable levers of one ship. */
export interface VariantLevers {
  readonly id: string;
  /** Scalar levers where higher is better. */
  readonly scalars: readonly number[];
  /** Stress cells, speed 1–5 × straight/bank/turn (higher is greener). */
  readonly dialCells: readonly number[];
  /** Slot bar, sorted. */
  readonly slots: readonly string[];
}

/**
 * Collect the levers of a ship.
 *
 * @param ship - Ship definition.
 * @returns The ship's comparable levers.
 */
export function leversOf(ship: ShipDefinition): VariantLevers {
  const s = ship.baseStats;
  const dial = SHIP_DIALS[ship.id] ?? [];
  const dialCells: number[] = [];
  for (let speed = 1; speed <= TOP_DIAL_SPEED; speed++) {
    for (const direction of STRESS_DIRECTIONS) {
      const inBand = speed >= s.speed.min && speed <= s.speed.max;
      dialCells.push(
        inBand
          ? CELL_SCORE[stressDifficulty(dial, direction, speed)]
          : UNAVAILABLE,
      );
    }
  }
  const slotConfig = SHIP_SLOTS[ship.id];
  const live = combatStatsFor(ship.role, s, "continuous", 1);
  return {
    id: ship.id,
    scalars: [
      live.hull,
      live.shields,
      live.attackDice,
      live.agilityDice,
      s.armor ?? 0,
      s.speed.max,
      -s.speed.min,
      // Size as the pricing heuristic values it (large below medium).
      SIZE_POINTS[s.size],
      slotConfig?.charges ?? 0,
    ],
    dialCells,
    slots: [...(slotConfig?.slots ?? [])].sort(),
  };
}

/**
 * Whether two ships play identically on every lever.
 *
 * @param a - First ship's levers.
 * @param b - Second ship's levers.
 * @returns True when nothing a player can feel tells them apart.
 */
export function sameLevers(a: VariantLevers, b: VariantLevers): boolean {
  const equal = (
    x: readonly (number | string)[],
    y: readonly (number | string)[],
  ): boolean => x.length === y.length && x.every((value, i) => value === y[i]);
  return (
    equal(a.scalars, b.scalars) &&
    equal(a.dialCells, b.dialCells) &&
    equal(a.slots, b.slots)
  );
}

/**
 * Whether one slot bar holds every slot of another (multiset inclusion).
 *
 * @param bigger - Candidate superset.
 * @param smaller - Candidate subset.
 * @returns True when `bigger` can carry anything `smaller` can.
 */
function slotsInclude(
  bigger: readonly string[],
  smaller: readonly string[],
): boolean {
  const free = [...bigger];
  return smaller.every((slot) => {
    const index = free.indexOf(slot);
    if (index < 0) return false;
    free.splice(index, 1);
    return true;
  });
}

/**
 * Whether `a` is at least as good as `b` on every lever.
 *
 * @param a - Candidate dominating ship.
 * @param b - Candidate dominated ship.
 * @returns True when `a` matches or beats `b` everywhere.
 */
export function atLeastAsGood(a: VariantLevers, b: VariantLevers): boolean {
  return (
    a.scalars.every((value, i) => value >= b.scalars[i]!) &&
    a.dialCells.every((value, i) => value >= b.dialCells[i]!) &&
    slotsInclude(a.slots, b.slots)
  );
}

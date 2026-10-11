/**
 * Survival roguelite — salvage economy (pure): earning (ascension and
 * relic multipliers), spending, shop prices and repair amounts.
 */

import { ascensionRules } from "../../data/survival/ascension";
import {
  MIN_SALVAGE_MULTIPLIER,
  SALVAGE_PER_KILL,
} from "../../data/survival/economy";
import {
  activeArchetypeSets,
  relicsOf,
} from "../../data/survival/relicCatalog";
import type { RelicEffect } from "../../data/survival/relics";
import type { WaveTier } from "../../arcade/systems/SurvivalLoadouts";
import type { RunState } from "./RunTypes";

/** Shop discounts from relics never exceed this. */
export const MAX_SHOP_DISCOUNT = 0.5;

/**
 * @param run - The run.
 * @returns Every economy-relevant effect of its relics and set bonuses.
 */
export function economyEffects(run: RunState): RelicEffect[] {
  return [
    ...relicsOf(run.relics).flatMap((relic) => relic.effects),
    ...activeArchetypeSets(run.relics).flatMap((set) => set.effects),
  ];
}

/**
 * @param run - The run.
 * @returns Multiplier on salvage earned (ascension; never below the floor).
 */
export function salvageMultiplier(run: RunState): number {
  return Math.max(
    MIN_SALVAGE_MULTIPLIER,
    ascensionRules(run.ascension).salvageMultiplier,
  );
}

/**
 * @param run - The run.
 * @param amount - Raw salvage gained (negative = lost).
 * @returns The run with salvage adjusted (gains scaled, never below 0).
 */
export function gainSalvage(run: RunState, amount: number): RunState {
  if (amount < 0) {
    return { ...run, salvage: Math.max(0, run.salvage + amount) };
  }
  const gained = Math.round(amount * salvageMultiplier(run));
  return {
    ...run,
    salvage: run.salvage + gained,
    stats: { ...run.stats, salvageEarned: run.stats.salvageEarned + gained },
  };
}

/**
 * @param run - The run.
 * @param amount - Salvage to pay.
 * @returns The run after paying, or null when it cannot afford it.
 */
export function spendSalvage(run: RunState, amount: number): RunState | null {
  if (amount > run.salvage) return null;
  return { ...run, salvage: run.salvage - amount };
}

/**
 * @param run - The run.
 * @param rank - The destroyed ship's rank.
 * @returns Raw salvage for the kill (before the ascension multiplier).
 */
export function killSalvage(run: RunState, rank: WaveTier): number {
  const effects = economyEffects(run);
  const perKill = effects.reduce(
    (sum, e) => sum + (e.kind === "onKill" ? (e.salvage ?? 0) : 0),
    0,
  );
  const bounty =
    rank === "regular"
      ? 1
      : effects.reduce(
          (m, e) =>
            e.kind === "economy" ? m * (e.eliteSalvageMultiplier ?? 1) : m,
          1,
        );
  return Math.round(SALVAGE_PER_KILL[rank] * bounty) + perKill;
}

/**
 * @param run - The run.
 * @param basePrice - The item's base price.
 * @returns The price after ascension markup and relic discounts.
 */
export function shopPrice(run: RunState, basePrice: number): number {
  const discount = Math.min(
    MAX_SHOP_DISCOUNT,
    economyEffects(run).reduce(
      (sum, e) => sum + (e.kind === "economy" ? (e.shopDiscount ?? 0) : 0),
      0,
    ),
  );
  const markup = ascensionRules(run.ascension).shopPriceMultiplier;
  return Math.max(1, Math.round(basePrice * markup * (1 - discount)));
}

/**
 * @param run - The run.
 * @param baseFraction - A repair's base share of max hull.
 * @returns The share it actually restores (ascension, relic bonuses).
 */
export function repairFraction(run: RunState, baseFraction: number): number {
  const bonus = economyEffects(run).reduce(
    (sum, e) => sum + (e.kind === "economy" ? (e.repairBonus ?? 0) : 0),
    0,
  );
  return baseFraction * ascensionRules(run.ascension).repairMultiplier + bonus;
}

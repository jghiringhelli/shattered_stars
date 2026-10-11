/**
 * heroPowerState — the hero's two power slots during a battle: rank (0 =
 * locked), cooldown, activation. Ranks come from the campaign save (see
 * {@link heroPowerRanksFor}); a research choice may shorten cooldowns. Pure.
 */

import type { FactionId } from "../../config";
import {
  FACTION_HEROES,
  POWER_UNLOCK_SCHEDULE,
} from "../../data/campaign/heroPowers";
import type { HeroPowerDefinition, HeroPowerEffect } from "./heroPowerTypes";

/** One power slot. */
export interface HeroPowerSlot {
  readonly power: HeroPowerDefinition;
  /** 0 = locked. */
  readonly rank: number;
  readonly cooldownRemainingMs: number;
  /** Cooldown started by the last cast (for the HUD gauge). */
  readonly cooldownTotalMs: number;
  /** Research multiplier on every cooldown. */
  readonly cooldownMultiplier: number;
}

/** A successful cast. */
export interface HeroPowerActivation {
  readonly powerId: string;
  readonly rank: number;
  readonly effect: HeroPowerEffect;
}

/**
 * @param factionId - Campaign faction.
 * @param completedMissions - Missions completed so far.
 * @returns Rank of each hero power (0 = still locked).
 */
export function heroPowerRanksFor(
  factionId: FactionId,
  completedMissions: number,
): Record<string, number> {
  const powers = FACTION_HEROES[factionId].powers;
  const ranks: Record<string, number> = {
    [powers[0].id]: 0,
    [powers[1].id]: 0,
  };
  for (const step of POWER_UNLOCK_SCHEDULE) {
    if (completedMissions < step.completedMissions) continue;
    const id = powers[step.slot].id;
    ranks[id] = Math.max(ranks[id] ?? 0, step.rank);
  }
  return ranks;
}

/**
 * @param factionId - Campaign faction.
 * @param ranks - Saved rank of each power.
 * @param cooldownMultiplier - Research cooldown multiplier (default 1).
 * @returns Both slots, ready.
 */
export function createHeroPowerSlots(
  factionId: FactionId,
  ranks: Readonly<Record<string, number>>,
  cooldownMultiplier = 1,
): HeroPowerSlot[] {
  return FACTION_HEROES[factionId].powers.map((power) => ({
    power,
    rank: Math.min(power.ranks.length, Math.max(0, ranks[power.id] ?? 0)),
    cooldownRemainingMs: 0,
    cooldownTotalMs: 0,
    cooldownMultiplier,
  }));
}

/**
 * @param slots - Power slots.
 * @param deltaMs - Frame length.
 * @returns Slots with cooldowns advanced.
 */
export function tickHeroPowers(
  slots: readonly HeroPowerSlot[],
  deltaMs: number,
): HeroPowerSlot[] {
  return slots.map((slot) =>
    slot.cooldownRemainingMs > 0
      ? {
          ...slot,
          cooldownRemainingMs: Math.max(0, slot.cooldownRemainingMs - deltaMs),
        }
      : slot,
  );
}

/**
 * Casts a slot's power if it is unlocked and ready.
 *
 * @param slots - Power slots.
 * @param index - Slot to cast (0 or 1).
 * @returns Slots after the cast and the activation (null when refused).
 */
export function activateHeroPower(
  slots: readonly HeroPowerSlot[],
  index: number,
): { slots: HeroPowerSlot[]; activation: HeroPowerActivation | null } {
  const slot = slots[index];
  if (!slot || slot.rank <= 0 || slot.cooldownRemainingMs > 0) {
    return { slots: [...slots], activation: null };
  }
  const rank = slot.power.ranks[slot.rank - 1]!;
  const cooldown = Math.round(rank.cooldownMs * slot.cooldownMultiplier);
  const next = slots.map((s, i) =>
    i === index
      ? { ...s, cooldownRemainingMs: cooldown, cooldownTotalMs: cooldown }
      : s,
  );
  return {
    slots: next,
    activation: {
      powerId: slot.power.id,
      rank: slot.rank,
      effect: rank.effect,
    },
  };
}

/**
 * @param slot - A power slot.
 * @returns Cooldown left as a fraction (1 = just cast, 0 = ready).
 */
export function slotCooldownFraction(slot: HeroPowerSlot): number {
  if (slot.cooldownTotalMs <= 0) return 0;
  return Math.min(1, slot.cooldownRemainingMs / slot.cooldownTotalMs);
}

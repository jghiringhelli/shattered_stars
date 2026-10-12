/**
 * bonusTypes — the squad bonuses campaign Armory mods and Research choices
 * grant (campaign only; never part of the global upgrade catalog).
 */

/** Every campaign bonus, as one neutral-by-default record. */
export interface CampaignShipBonuses {
  /** × hull caps of the player's ships. */
  readonly hullMultiplier: number;
  /** × shield caps. */
  readonly shieldMultiplier: number;
  /** + damage per hit (attack dice). */
  readonly attackBonus: number;
  /** + agility (evasion) dice. */
  readonly agilityBonus: number;
  /** × time between attacks (< 1 = faster). */
  readonly weaponIntervalMultiplier: number;
  /** + real-time shield HP regenerated per second (never rescaled). */
  readonly shieldRegenPerSecond: number;
  /** × incoming damage (< 1 = tougher). */
  readonly damageTakenMultiplier: number;
  /** × hero power cooldowns. */
  readonly powerCooldownMultiplier: number;
  /** × mission credit rewards. */
  readonly creditMultiplier: number;
  /** + research points per bonus objective completed. */
  readonly researchPerBonus: number;
  /** + attack for escorts/wingmen (not the flagship). */
  readonly escortAttackBonus: number;
}

/** Bonuses that change nothing. */
export const NEUTRAL_BONUSES: CampaignShipBonuses = {
  hullMultiplier: 1,
  shieldMultiplier: 1,
  attackBonus: 0,
  agilityBonus: 0,
  weaponIntervalMultiplier: 1,
  shieldRegenPerSecond: 0,
  damageTakenMultiplier: 1,
  powerCooldownMultiplier: 1,
  creditMultiplier: 1,
  researchPerBonus: 0,
  escortAttackBonus: 0,
};

/** Fields combined by multiplication (the rest add). */
export const MULTIPLICATIVE_BONUSES: ReadonlySet<keyof CampaignShipBonuses> =
  new Set([
    "hullMultiplier",
    "shieldMultiplier",
    "weaponIntervalMultiplier",
    "damageTakenMultiplier",
    "powerCooldownMultiplier",
    "creditMultiplier",
  ]);

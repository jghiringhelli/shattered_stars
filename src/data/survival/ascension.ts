/**
 * Survival roguelite — Ascension (Hades Heat-style), pure data + rules.
 *
 * Levels 0–10 are cumulative: ascension N applies modifiers 1..N. Each
 * level is unlocked by winning a run at the level below it (see
 * MetaProgression). Every modifier is listed on the setup screen and the
 * map so the player always sees what they opted into.
 */

/** Highest ascension level. */
export const MAX_ASCENSION = 10;

/** One ascension step and what it changes. */
export interface AscensionModifier {
  readonly level: number;
  readonly name: string;
  readonly description: string;
}

/** Every ascension modifier, in unlock order (level 1 first). */
export const ASCENSION_MODIFIERS: readonly AscensionModifier[] = [
  {
    level: 1,
    name: "Elite Contracts",
    description: "Elite nodes are more common and field +1 elite",
  },
  {
    level: 2,
    name: "Tight Belt",
    description: "The asteroid belt starts two squeezes tighter",
  },
  {
    level: 3,
    name: "Veteran Wings",
    description: "Enemy pilots reach the next skill tier earlier",
  },
  {
    level: 4,
    name: "Lean Pickings",
    description: "-20% salvage from every source",
  },
  { level: 5, name: "Hardened Hulls", description: "Enemies have +15% hull" },
  { level: 6, name: "Price Gouging", description: "Shop prices +25%" },
  { level: 7, name: "Affix Surge", description: "Elites roll two affixes" },
  {
    level: 8,
    name: "Second Wind",
    description: "Sector bosses gain an extra phase",
  },
  {
    level: 9,
    name: "Battle Scars",
    description: "Repairs restore 30% less hull",
  },
  { level: 10, name: "Void Tide", description: "Every wave's threat +25%" },
];

/** The numeric effect of an ascension level on a run. */
export interface AscensionRules {
  readonly extraElites: number;
  readonly eliteWeightMultiplier: number;
  readonly extraBeltSqueezes: number;
  /** Added to the effective wave used to pick enemy AI tiers. */
  readonly tierWaveShift: number;
  readonly salvageMultiplier: number;
  readonly enemyHullMultiplier: number;
  /** Multiplier on all damage the player's fleet takes from enemies. */
  readonly enemyDamageMultiplier: number;
  readonly shopPriceMultiplier: number;
  readonly eliteAffixCount: number;
  readonly extraBossPhases: number;
  readonly repairMultiplier: number;
  readonly threatMultiplier: number;
}

/** Elite weight boost from Elite Contracts. */
const ELITE_WEIGHT_BOOST = 1.6;
/**
 * Effective-wave shift from Veteran Wings: every tier arrives two map rows
 * earlier. A full band (3) made sector 1 average from its first node and,
 * with multi-wave nodes, dropped the run win from 16 % (A2) to 1 % (A3).
 */
const VETERAN_TIER_SHIFT = 1;
/**
 * Enemy hull at ascension 0, as a fraction of the survival-mode hull.
 * Tuned with the node-based run sim (SurvivalRunSim, ADR-0004): at 1.0 an
 * average pilot's lone flagship beat a single sector-1 novice only ~70% of
 * the time and no run was ever won. After the combat unification (enemy
 * secondaries, x2 ordnance) 0.7 left the run win at 16 %; 0.55 brings it to
 * 25–31.5 % over two 200-run seed ranges (ADR-0004, balance pass 2026-10-12).
 */
export const BASE_ENEMY_HULL_MULTIPLIER = 0.55;
/**
 * Enemy lethality: every hit (lasers, ordnance, death blasts) an enemy lands
 * on the player's fleet deals this fraction (RelicCombatEngine). Battle nodes
 * fight several waves (CombatNodePlan.WAVES_PER_NODE); the fleet's damage
 * persists across them, so each wave must cost less than the old single
 * wave: at 1.0 the run win was 11 %; after the R2 regen cap 0.62 gives
 * 29–30.5 % over two 200-run seed ranges (ADR-0004, node-length pass).
 */
export const BASE_ENEMY_DAMAGE_MULTIPLIER = 0.62;
/** Hardened Hulls (ascension 5): enemy hull ×1.15 on top of the base. */
const HARDENED_HULLS_MULTIPLIER = 1.15;

/**
 * @param level - Ascension level (clamped to 0..MAX_ASCENSION).
 * @returns The cumulative rules of that level.
 */
export function ascensionRules(level: number): AscensionRules {
  const at = (step: number): boolean => clampAscension(level) >= step;
  return {
    extraElites: at(1) ? 1 : 0,
    eliteWeightMultiplier: at(1) ? ELITE_WEIGHT_BOOST : 1,
    extraBeltSqueezes: at(2) ? 2 : 0,
    tierWaveShift: at(3) ? VETERAN_TIER_SHIFT : 0,
    salvageMultiplier: at(4) ? 0.8 : 1,
    enemyHullMultiplier:
      BASE_ENEMY_HULL_MULTIPLIER * (at(5) ? HARDENED_HULLS_MULTIPLIER : 1),
    enemyDamageMultiplier: BASE_ENEMY_DAMAGE_MULTIPLIER,
    shopPriceMultiplier: at(6) ? 1.25 : 1,
    eliteAffixCount: at(7) ? 2 : 1,
    extraBossPhases: at(8) ? 1 : 0,
    repairMultiplier: at(9) ? 0.7 : 1,
    threatMultiplier: at(10) ? 1.25 : 1,
  };
}

/**
 * @param level - Any number.
 * @returns It rounded down and clamped to 0..MAX_ASCENSION.
 */
export function clampAscension(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_ASCENSION, Math.floor(level)));
}

/**
 * @param level - Ascension level.
 * @returns The modifiers active at that level (1..level).
 */
export function activeAscensionModifiers(
  level: number,
): readonly AscensionModifier[] {
  return ASCENSION_MODIFIERS.filter((m) => m.level <= clampAscension(level));
}

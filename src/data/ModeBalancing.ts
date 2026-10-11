/**
 * Mode-Specific Ship Balancing
 *
 * Arcade:    Fast-paced real-time, direct control, forward laser capped at 2 dmg
 * Continuous: Interval maneuvers + continuous combat, tactical positioning
 * Survival:   Endless waves — durable ships, continuous-speed combat
 */

import { getShipDefinition } from "./ShipDefinitions";
import { DURABILITY_SCALE } from "../config";

/** The fewest miniature hull points any ship has in a real-time mode. */
const MIN_MINIATURE_HULL = 1;

export type GameMode = "arcade" | "continuous" | "survival";

/**
 * Combat stats scaled for the specific game mode
 */
export interface ModeCombatStats {
  // Health
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;

  // Offense
  attackDice: number; // Number of dice in turn-based / damage per hit in continuous
  weaponCooldown: number; // ms between attacks (continuous mode)
  weaponRange: number; // Attack range in pixels
  firingArc: number; // Degrees of firing arc

  // Defense
  agilityDice: number; // Defense dice in turn-based / dodge chance modifier in continuous
  evadeBonus: number; // Bonus when evading

  // Movement feel
  maneuverSpeedMultiplier: number; // How fast maneuvers animate
}

/**
 * Role-based stat modifiers
 * These adjust base stats based on ship archetype
 */
interface RoleModifiers {
  hullMod: number;
  shieldMod: number;
  attackMod: number;
  agilityMod: number;
  rangeMod: number;
  cooldownMod: number;
  arcMod: number;
}

const ROLE_MODIFIERS: Record<string, RoleModifiers> = {
  light_fighter: {
    hullMod: 0.8,
    shieldMod: 0.8,
    attackMod: 0.9,
    agilityMod: 1.2,
    rangeMod: 0.9,
    cooldownMod: 0.8, // Faster firing
    arcMod: 1.0,
  },
  interceptor: {
    hullMod: 0.9,
    shieldMod: 0.9,
    attackMod: 1.0,
    agilityMod: 1.3,
    rangeMod: 0.85,
    cooldownMod: 0.7, // Very fast firing
    arcMod: 0.8, // Narrower arc
  },
  heavy_fighter: {
    hullMod: 1.0,
    shieldMod: 1.0,
    attackMod: 1.0,
    agilityMod: 1.0,
    rangeMod: 1.0,
    cooldownMod: 1.0,
    arcMod: 1.0,
  },
  bomber: {
    hullMod: 1.3,
    shieldMod: 1.1,
    attackMod: 0.8, // Lower primary, but has ordnance
    agilityMod: 0.6,
    rangeMod: 0.8,
    cooldownMod: 1.5, // Slower firing
    arcMod: 1.2, // Wider arc for turrets
  },
  gunship: {
    hullMod: 1.4,
    shieldMod: 1.2,
    attackMod: 1.3,
    agilityMod: 0.5,
    rangeMod: 1.2,
    cooldownMod: 1.2,
    arcMod: 1.5, // Wide firing arcs
  },
  support: {
    hullMod: 1.2,
    shieldMod: 1.4,
    attackMod: 0.5,
    agilityMod: 0.7,
    rangeMod: 1.0,
    cooldownMod: 2.0, // Very slow firing
    arcMod: 2.0, // 360 degree coverage
  },
};

/**
 * Mode-specific base stats before role modifiers
 */
interface ModeBaseStats {
  hullMultiplier: number;
  shieldMultiplier: number;
  attackBase: number;
  agilityBase: number;
  baseWeaponCooldown: number;
  baseWeaponRange: number;
  baseFiringArc: number;
  maneuverSpeed: number;
}

const MODE_BASE_STATS: Record<GameMode, ModeBaseStats> = {
  arcade: {
    // Forward laser capped at 2 — fast kills, direct control
    hullMultiplier: 0.6,
    shieldMultiplier: 0.5,
    attackBase: 1.5,
    agilityBase: 1.2,
    baseWeaponCooldown: 400,
    baseWeaponRange: 250,
    baseFiringArc: 75,
    maneuverSpeed: 1.8,
  },
  continuous: {
    // === ARCADE MODE TUNING (Target: ~4 hit TTK like X-Wing) ===
    // Lower HP for faster kills - aim for 4-6 effective HP
    hullMultiplier: 0.6, // Reduced from 1.0 - faster deaths
    shieldMultiplier: 0.5, // Reduced from 0.8 - shields break fast
    // Attack = damage per hit - 1-2 per hit for 4-5 hit kills
    attackBase: 1.5, // Reduced from 2 - more hits needed but lower HP
    // Agility = dodge chance modifier - keep dodging meaningful
    agilityBase: 1.2, // Increased from 1 - evasion matters
    // Base weapon cooldown in ms - fast but not instant
    baseWeaponCooldown: 400, // Reduced from 500 - snappier combat
    // Range for engagement - close range dogfighting
    baseWeaponRange: 250, // Reduced from 300 - forces closer combat
    // Firing arc - requires aim but not punishing
    baseFiringArc: 75, // Reduced from 90 - positioning matters
    // Faster animations for responsive arcade feel
    maneuverSpeed: 1.8, // Increased from 1.5 - snappier movement
  },
  survival: {
    // Endless waves — ships must survive multiple engagements.
    // hullMultiplier 1.2 left the two base-hull-2 light-fighter starters
    // (terran_stiletto, synth_scout_drone) at hull 2 (round(2*1.2*0.8)=2),
    // one shy of the "hull >= 3" durability this mode was designed for —
    // that's 3 raw hit points against wave 1's 3 enemies converging on a
    // lone flagship. Raised to 1.6 so every light-fighter starter clears
    // hull >= 3 (round(2*1.6*0.8)=3); found via a live self-play death at
    // Wave 1 with a real player-piloted flagship (see Status.md).
    hullMultiplier: 1.6,
    shieldMultiplier: 0.9,
    attackBase: 1.5, // Same damage tempo as continuous
    agilityBase: 1.2,
    baseWeaponCooldown: 400,
    baseWeaponRange: 250,
    baseFiringArc: 75,
    maneuverSpeed: 1.8,
  },
};

/**
 * Get combat stats for a ship in a specific game mode.
 *
 * @param shipDefId - Ship definition id.
 * @param mode - Game mode.
 * @param durabilityScale - Real-time HP per miniature hull/shield point
 *   (abstract simulators pass 1 to stay on miniature numbers).
 * @returns The ship's combat stats in that mode.
 */
export function getModeCombatStats(
  shipDefId: string,
  mode: GameMode,
  durabilityScale: number = DURABILITY_SCALE,
): ModeCombatStats {
  const shipDef = getShipDefinition(shipDefId);
  if (!shipDef) {
    // Return default stats if ship not found
    return getDefaultStats(mode, durabilityScale);
  }

  const baseStats = shipDef.baseStats;
  const roleModifiers =
    ROLE_MODIFIERS[shipDef.role] ?? ROLE_MODIFIERS["heavy_fighter"];
  const modeStats = MODE_BASE_STATS[mode];

  // Calculate hull and shields
  // Every ship keeps at least one miniature hull point — a fragile drone
  // must still be a ship, not spawn already destroyed.
  const hull =
    Math.max(
      MIN_MINIATURE_HULL,
      Math.round(
        baseStats.hull *
          modeStats.hullMultiplier *
          (roleModifiers?.hullMod ?? 1),
      ),
    ) * durabilityScale;
  const shields =
    Math.round(
      baseStats.shields *
        modeStats.shieldMultiplier *
        (roleModifiers?.shieldMod ?? 1),
    ) * durabilityScale;

  // Calculate attack value (dice or damage)
  const attackDice = Math.round(
    baseStats.attack *
      (modeStats.attackBase / 3) *
      (roleModifiers?.attackMod ?? 1),
  );

  // Calculate agility (dice or modifier)
  const agilityDice = Math.round(
    baseStats.agility *
      (modeStats.agilityBase / 2) *
      (roleModifiers?.agilityMod ?? 1),
  );

  // Calculate weapon stats for continuous mode
  const weaponCooldown = Math.round(
    modeStats.baseWeaponCooldown * (roleModifiers?.cooldownMod ?? 1),
  );

  const weaponRange = Math.round(
    modeStats.baseWeaponRange * (roleModifiers?.rangeMod ?? 1),
  );

  const firingArc = Math.round(
    modeStats.baseFiringArc * (roleModifiers?.arcMod ?? 1),
  );

  return {
    hull,
    maxHull: hull,
    shields,
    maxShields: shields,
    attackDice,
    weaponCooldown,
    weaponRange,
    firingArc,
    agilityDice,
    evadeBonus: Math.round(baseStats.agility * 0.5),
    maneuverSpeedMultiplier: modeStats.maneuverSpeed,
  };
}

function getDefaultStats(
  mode: GameMode,
  durabilityScale: number,
): ModeCombatStats {
  const modeStats = MODE_BASE_STATS[mode];
  const hull = Math.round(4 * modeStats.hullMultiplier) * durabilityScale;
  const shields = Math.round(2 * modeStats.shieldMultiplier) * durabilityScale;
  return {
    hull,
    maxHull: hull,
    shields,
    maxShields: shields,
    attackDice: modeStats.attackBase,
    weaponCooldown: modeStats.baseWeaponCooldown,
    weaponRange: modeStats.baseWeaponRange,
    firingArc: modeStats.baseFiringArc,
    agilityDice: modeStats.agilityBase,
    evadeBonus: 1,
    maneuverSpeedMultiplier: modeStats.maneuverSpeed,
  };
}

/**
 * Calculate hit chance in continuous mode
 * Based on attacker's attack stat and defender's agility
 */
export function calculateHitChance(
  attackerAttack: number,
  defenderAgility: number,
): number {
  // Base 60% hit chance
  const baseChance = 0.6;
  // Each point of attack adds 5%
  const attackBonus = attackerAttack * 0.05;
  // Each point of agility reduces by 8%
  const agilityPenalty = defenderAgility * 0.08;

  return Math.max(
    0.2,
    Math.min(0.95, baseChance + attackBonus - agilityPenalty),
  );
}

/**
 * Roll attack dice for turn-based mode.
 *
 * @param numDice - Number of attack dice to roll.
 * @param rng - Optional seeded RNG. Defaults to Math.random (single-player). Pass a seedrandom
 *   instance for deterministic multiplayer so both clients produce identical rolls.
 * @returns Hit, crit, and focus counts.
 */
export function rollAttackDice(
  numDice: number,
  rng: () => number = Math.random,
): { hits: number; crits: number; focuses: number } {
  let hits = 0;
  let crits = 0;
  let focuses = 0;

  for (let i = 0; i < numDice; i++) {
    const roll = rng();
    if (roll < 0.125) {
      crits++; // 1/8 chance crit
    } else if (roll < 0.375) {
      hits++; // 2/8 chance hit
    } else if (roll < 0.625) {
      focuses++; // 2/8 chance focus (convertible)
    }
    // 3/8 chance blank
  }

  return { hits, crits, focuses };
}

/**
 * Roll defense dice for turn-based mode.
 *
 * @param numDice - Number of defense dice to roll.
 * @param rng - Optional seeded RNG. Defaults to Math.random (single-player).
 * @returns Evade and focus counts.
 */
export function rollDefenseDice(
  numDice: number,
  rng: () => number = Math.random,
): { evades: number; focuses: number } {
  let evades = 0;
  let focuses = 0;

  for (let i = 0; i < numDice; i++) {
    const roll = rng();
    if (roll < 0.375) {
      evades++; // 3/8 chance evade
    } else if (roll < 0.625) {
      focuses++; // 2/8 chance focus
    }
    // 3/8 chance blank
  }

  return { evades, focuses };
}

/** Result of a resolved turn-based attack. */
export interface AttackResult {
  hitsLanded: number;
  critsLanded: number;
  shieldsDamaged: number;
  hullDamaged: number;
  wasDestroyed: boolean;
}

/**
 * Resolve a turn-based attack.
 *
 * @param attackDice - Number of attack dice.
 * @param defenseDice - Number of defense dice.
 * @param targetShields - Target's current shield count.
 * @param targetHull - Target's current hull count.
 * @param attackerHasFocus - Whether attacker has a focus token.
 * @param defenderHasFocus - Whether defender has a focus token.
 * @param defenderHasEvade - Whether defender has an evade token.
 * @param rng - Optional seeded RNG for deterministic multiplayer resolution.
 * @returns Attack resolution result.
 */
export function resolveTurnBasedAttack(
  attackDice: number,
  defenseDice: number,
  targetShields: number,
  targetHull: number,
  attackerHasFocus: boolean,
  defenderHasFocus: boolean,
  defenderHasEvade: boolean,
  rng: () => number = Math.random,
): AttackResult {
  // Roll attack
  const attack = rollAttackDice(attackDice, rng);
  let totalHits = attack.hits + attack.crits;

  // Convert focus results if attacker has focus token
  if (attackerHasFocus) {
    totalHits += attack.focuses;
  }

  // Roll defense
  const defense = rollDefenseDice(defenseDice, rng);
  let totalEvades = defense.evades;

  // Convert focus results if defender has focus token
  if (defenderHasFocus) {
    totalEvades += defense.focuses;
  }

  // Add evade token bonus
  if (defenderHasEvade) {
    totalEvades += 1;
  }

  // Calculate damage
  const netHits = Math.max(0, totalHits - totalEvades);
  const netCrits = Math.min(attack.crits, netHits); // Crits that got through

  // Apply damage: shields first, then hull
  let remainingDamage = netHits;
  let shieldsDamaged = 0;
  let hullDamaged = 0;

  if (targetShields > 0) {
    shieldsDamaged = Math.min(targetShields, remainingDamage);
    remainingDamage -= shieldsDamaged;
  }

  hullDamaged = remainingDamage;
  const newHull = targetHull - hullDamaged;

  return {
    hitsLanded: netHits,
    critsLanded: netCrits,
    shieldsDamaged,
    hullDamaged,
    wasDestroyed: newHull <= 0,
  };
}

/**
 * Ship archetype descriptions for UI
 */
export const ARCHETYPE_DESCRIPTIONS: Record<
  string,
  { name: string; strengths: string; weaknesses: string }
> = {
  light_fighter: {
    name: "Light Fighter",
    strengths: "High agility, fast firing, cheap",
    weaknesses: "Low durability, weak damage",
  },
  interceptor: {
    name: "Interceptor",
    strengths: "Fastest ships, excellent evasion, rapid fire",
    weaknesses: "Fragile, short range, narrow arc",
  },
  heavy_fighter: {
    name: "Heavy Fighter",
    strengths: "Balanced stats, versatile",
    weaknesses: "No particular specialty",
  },
  bomber: {
    name: "Bomber",
    strengths: "High durability, ordnance capability",
    weaknesses: "Slow, poor agility, slow firing",
  },
  gunship: {
    name: "Gunship",
    strengths: "Highest damage, wide arcs, tanky",
    weaknesses: "Very slow, easy to outmaneuver",
  },
  support: {
    name: "Support",
    strengths: "Team buffs, high shields, 360° coverage",
    weaknesses: "Minimal offense, sitting duck if alone",
  },
};

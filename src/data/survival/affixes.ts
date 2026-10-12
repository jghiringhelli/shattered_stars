/**
 * Survival roguelite — elite affixes (pure data + seeded roll). Elites in
 * elite and boss nodes roll one affix (two at ascension 7+). Affixes are
 * shown on the HUD above the ship and announced when the wave arrives.
 */

import type { RealtimeEffect } from "../../core/CombatModifiers";
import type { RandomGenerator } from "../../utils/random";

/** One elite affix and its stat / behaviour changes. */
export interface EliteAffix {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly shieldMultiplier?: number;
  readonly hullMultiplier?: number;
  readonly attackDiceBonus?: number;
  readonly effect?: RealtimeEffect;
  /** Its pilot flies one AI tier higher (capped at expert). */
  readonly tierBoost?: boolean;
}

/** Every elite affix. */
export const ELITE_AFFIXES: readonly EliteAffix[] = [
  {
    id: "shielded",
    name: "Shielded",
    icon: "🛡",
    description: "Double shields",
    shieldMultiplier: 2,
  },
  {
    id: "swift",
    name: "Swift",
    icon: "💨",
    description: "+1 top speed, boost recharges twice as fast",
    effect: { maxSpeedBonus: 1, boostCooldownMultiplier: 0.5 },
  },
  {
    id: "ace",
    name: "Ace",
    icon: "★",
    description: "Ace pilot: flies a tier higher, +2 damage from your rear arc",
    tierBoost: true,
    effect: { rearArcLaserBonus: 2 },
  },
  {
    id: "regenerating",
    name: "Regenerating",
    icon: "♻",
    description: "Regenerates 2 shield HP/s",
    effect: { shieldRegenPerSecond: 2 },
  },
  {
    id: "volatile",
    name: "Volatile",
    icon: "💥",
    description: "Explodes on death, damaging nearby ships",
    // Miniature 2.2 = 22 HP (x ORDNANCE_DAMAGE_SCALE): a real threat (more
    // than a pilot's Self-Destruct, 20 HP) that never one-shots a full-health
    // light fighter — the frailest, synth_scout_drone, has 24 HP in Survival
    // (the ~30 HP first aimed for would). 10 (100 HP) erased any fighter.
    effect: { deathBlastDamage: 2.2 },
  },
  {
    id: "marksman",
    name: "Marksman",
    icon: "🎯",
    description: "+1 attack die",
    attackDiceBonus: 1,
  },
  {
    id: "juggernaut",
    name: "Juggernaut",
    icon: "🪨",
    description: "+40% hull",
    hullMultiplier: 1.4,
  },
];

/**
 * @param rng - Seeded RNG for this ship.
 * @param count - Affixes to roll.
 * @returns `count` distinct affixes.
 */
export function rollAffixes(rng: RandomGenerator, count: number): EliteAffix[] {
  return rng.shuffle([...ELITE_AFFIXES]).slice(0, Math.max(0, count));
}

/**
 * @param id - An affix id.
 * @returns The affix, or undefined.
 */
export function getAffix(id: string): EliteAffix | undefined {
  return ELITE_AFFIXES.find((a) => a.id === id);
}

/**
 * @param affixes - A ship's affixes.
 * @returns Its HUD label, e.g. "🛡 Shielded · 💨 Swift".
 */
export function affixLabel(affixes: readonly EliteAffix[]): string {
  return affixes.map((a) => `${a.icon} ${a.name}`).join(" · ");
}

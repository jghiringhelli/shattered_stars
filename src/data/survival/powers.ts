/**
 * Survival roguelite — power catalog + draft/apply (pure, seedable, no I/O).
 * See docs/adr/ADR-0003-survival-roguelite-leveling.md.
 */

import type { RandomGenerator } from "../../utils/random";
import {
  type Branch,
  type StatBonuses,
  type SurvivalRunState,
  CAPSTONE_THRESHOLD,
  CROSS_THRESHOLD,
  HULL_AMP_MULTIPLIER,
  isBranchAmplified,
} from "./model";
import { MAX_ESCORTS } from "./escorts";

export type PowerTier = "atom" | "capstone" | "cross";

export interface Power {
  id: string;
  branch: Branch;
  tier: PowerTier;
  /** Second branch for a cross power; both must reach CROSS_THRESHOLD. */
  crossWith?: Branch;
  name: string;
  description: string;
  icon: string;
  /** Amplifiable stat delta (scaled when the branch is hull-amplified). */
  stat?: keyof StatBonuses;
  amount?: number;
  /** Non-stat effect for specials (escort, reroll). Never amplified. */
  effect?: (bonuses: StatBonuses, state: SurvivalRunState) => void;
}

function atom(
  id: string,
  branch: Branch,
  name: string,
  description: string,
  icon: string,
  stat: keyof StatBonuses,
  amount: number,
): Power {
  return { id, branch, tier: "atom", name, description, icon, stat, amount };
}

function capstone(
  id: string,
  branch: Branch,
  name: string,
  description: string,
  icon: string,
  stat: keyof StatBonuses,
  amount: number,
): Power {
  return {
    id,
    branch,
    tier: "capstone",
    name,
    description,
    icon,
    stat,
    amount,
  };
}

function cross(
  id: string,
  branch: Branch,
  crossWith: Branch,
  name: string,
  description: string,
  icon: string,
  effect: (bonuses: StatBonuses, state: SurvivalRunState) => void,
): Power {
  return {
    id,
    branch,
    tier: "cross",
    crossWith,
    name,
    description,
    icon,
    effect,
  };
}

/** An atom whose payoff is a non-stat effect (escort, reroll) rather than a stat. */
function specialAtom(
  id: string,
  branch: Branch,
  name: string,
  description: string,
  icon: string,
  effect: (bonuses: StatBonuses, state: SurvivalRunState) => void,
): Power {
  return { id, branch, tier: "atom", name, description, icon, effect };
}

/** Regular-level atoms, roughly equal individual power (balance: even atoms). */
export const ATOMS: readonly Power[] = [
  atom(
    "gun_damage",
    "gunnery",
    "Cannon Calibration",
    "+1 primary damage",
    "⚔️",
    "damage",
    1,
  ),
  atom(
    "gun_crit",
    "gunnery",
    "Targeting Optics",
    "+5% crit chance",
    "🎯",
    "critChance",
    0.05,
  ),
  atom(
    "gun_range",
    "gunnery",
    "Extended Barrels",
    "+1 weapon range",
    "📏",
    "range",
    1,
  ),
  atom(
    "gun_rof",
    "gunnery",
    "Autoloader",
    "+10% fire rate",
    "🔁",
    "fireRate",
    0.1,
  ),
  atom(
    "ord_dmg",
    "ordnance",
    "Warhead Yield",
    "+1 primary damage",
    "💥",
    "damage",
    1,
  ),
  atom(
    "ord_range",
    "ordnance",
    "Homing Package",
    "+1 primary weapon range",
    "📡",
    "range",
    1,
  ),
  atom(
    "ord_rof",
    "ordnance",
    "Rapid Reload",
    "+10% primary fire rate",
    "🧨",
    "fireRate",
    0.1,
  ),
  atom(
    "ord_crit",
    "ordnance",
    "Shaped Charges",
    "+5% crit chance",
    "🔺",
    "critChance",
    0.05,
  ),
  atom(
    "auto_rof",
    "automation",
    "Servo Turrets",
    "+10% fire rate",
    "🛰️",
    "fireRate",
    0.1,
  ),
  atom(
    "auto_range",
    "automation",
    "Drone Uplink",
    "+1 range",
    "🤖",
    "range",
    1,
  ),
  atom(
    "auto_dmg",
    "automation",
    "Remote Batteries",
    "+1 damage",
    "⚙️",
    "damage",
    1,
  ),
  atom(
    "auto_evade",
    "automation",
    "Point Defense",
    "+1 evasion",
    "🛑",
    "evasion",
    1,
  ),
  atom(
    "fleet_speed",
    "fleet",
    "Formation Drills",
    "+1 drive (fleet): 1st = top-speed notch, then faster boost",
    "🕊️",
    "speed",
    1,
  ),
  atom(
    "fleet_evade",
    "fleet",
    "Screening Wing",
    "+1 evasion",
    "🪶",
    "evasion",
    1,
  ),
  atom(
    "fleet_hull",
    "fleet",
    "Shared Logistics",
    "+2 max hull",
    "🔧",
    "maxHull",
    2,
  ),
  atom(
    "bul_hull",
    "bulwark",
    "Hull Plating",
    "+2 max hull",
    "🛡️",
    "maxHull",
    2,
  ),
  atom(
    "bul_shield",
    "bulwark",
    "Shield Capacitor",
    "+1 max shields",
    "🔵",
    "maxShields",
    1,
  ),
  atom(
    "bul_regen",
    "bulwark",
    "Regen Coils",
    "+0.12 shield HP/s regen",
    "💠",
    "shieldRegen",
    0.12,
  ),
  atom(
    "bul_evade",
    "bulwark",
    "Ablative Coating",
    "+1 evasion",
    "🧱",
    "evasion",
    1,
  ),
  atom(
    "drv_speed",
    "drive",
    "Thruster Tuning",
    "+1 drive (fleet): 1st = top-speed notch, then faster boost",
    "🚀",
    "speed",
    1,
  ),
  atom(
    "drv_evade",
    "drive",
    "Inertial Dampers",
    "+1 evasion",
    "🌀",
    "evasion",
    1,
  ),
  atom(
    "drv_rof",
    "drive",
    "Overcharged Capacitors",
    "+10% fire rate",
    "⚡",
    "fireRate",
    0.1,
  ),
  specialAtom(
    "drv_reroll",
    "drive",
    "Nav Computer",
    "Gain a reroll charge",
    "🎲",
    (_b, s) => {
      s.rerolls += 1;
    },
  ),
];

/** Single-branch capstones (surface once a branch reaches CAPSTONE_THRESHOLD). */
export const CAPSTONES: readonly Power[] = [
  capstone(
    "cap_gunnery",
    "gunnery",
    "Marksman's Focus",
    "+3 primary damage",
    "🏆",
    "damage",
    3,
  ),
  capstone(
    "cap_ordnance",
    "ordnance",
    "Barrage Doctrine",
    "+3 primary damage",
    "🏆",
    "damage",
    3,
  ),
  capstone(
    "cap_automation",
    "automation",
    "Swarm Logic",
    "+30% fire rate",
    "🏆",
    "fireRate",
    0.3,
  ),
  capstone(
    "cap_fleet",
    "fleet",
    "Admiral's Command",
    "+3 evasion (fleet)",
    "🏆",
    "evasion",
    3,
  ),
  capstone(
    "cap_bulwark",
    "bulwark",
    "Fortress Hull",
    "+6 max hull",
    "🏆",
    "maxHull",
    6,
  ),
  capstone(
    "cap_drive",
    "drive",
    "Afterburners",
    "+3 drive (fleet): top-speed notch + faster boost",
    "🏆",
    "speed",
    3,
  ),
];

/** Cross powers reward split builds (two branches at CROSS_THRESHOLD). */
export const CROSS_POWERS: readonly Power[] = [
  cross(
    "x_saturation",
    "ordnance",
    "automation",
    "Saturation Barrage",
    "Ordnance + automation: +2 primary dmg, +15% fire rate",
    "🌟",
    (b) => {
      b.damage += 2;
      b.fireRate += 0.15;
    },
  ),
  cross(
    "x_wingcmd",
    "fleet",
    "gunnery",
    "Wing Commander",
    "Fleet + guns: +1 escort (wing cap 5), +2 dmg",
    "🌟",
    (b, s) => {
      s.escorts = Math.min(MAX_ESCORTS, s.escorts + 1);
      b.damage += 2;
    },
  ),
  cross(
    "x_phase",
    "bulwark",
    "drive",
    "Phase Runner",
    "Tank + mobility: +4 hull, +2 evasion",
    "🌟",
    (b) => {
      b.maxHull += 4;
      b.evasion += 2;
    },
  ),
  cross(
    "x_alpha",
    "gunnery",
    "ordnance",
    "Alpha Strike",
    "Guns + ordnance: +2 dmg, +10% crit",
    "🌟",
    (b) => {
      b.damage += 2;
      b.critChance += 0.1;
    },
  ),
];

export const POWER_CATALOG: readonly Power[] = [
  ...ATOMS,
  ...CAPSTONES,
  ...CROSS_POWERS,
];

/** True when a power may currently be offered given branch thresholds / uniqueness. */
export function isPowerEligible(
  power: Power,
  state: SurvivalRunState,
): boolean {
  if (power.tier === "atom") return true;
  if (state.taken.includes(power.id)) return false;
  if (power.tier === "capstone") {
    return state.branch[power.branch] >= CAPSTONE_THRESHOLD;
  }
  return (
    state.branch[power.branch] >= CROSS_THRESHOLD &&
    state.branch[power.crossWith as Branch] >= CROSS_THRESHOLD
  );
}

/** Draws up to `size` distinct eligible powers using the seeded RNG. */
export function drawPowers(
  state: SurvivalRunState,
  size: number,
  rng: RandomGenerator,
  pool: readonly Power[] = POWER_CATALOG,
): Power[] {
  const eligible = pool.filter((p) => isPowerEligible(p, state));
  return rng.shuffle([...eligible]).slice(0, size);
}

/** Applies a chosen power to the run state, mutating and returning it. */
export function applyPower(
  state: SurvivalRunState,
  power: Power,
): SurvivalRunState {
  if (power.tier === "atom") {
    state.branch[power.branch] += 1;
  } else {
    state.taken.push(power.id);
  }
  if (power.stat !== undefined && power.amount !== undefined) {
    const amp = isBranchAmplified(state.hull, power.branch)
      ? HULL_AMP_MULTIPLIER
      : 1;
    state.bonuses[power.stat] += power.amount * amp;
  }
  power.effect?.(state.bonuses, state);
  return state;
}

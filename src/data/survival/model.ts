/**
 * Survival roguelite — core model (pure, no Phaser, no I/O).
 *
 * See docs/adr/ADR-0003-survival-roguelite-leveling.md. Leveling is choice-based:
 * one draft per wave, powers organised into orthogonal branches, hull graduation
 * biases branches, and two-branch thresholds unlock cross powers.
 */

/** Orthogonal power axes. Builds and archetypes emerge from how a run invests. */
export type Branch =
  "gunnery" | "ordnance" | "automation" | "fleet" | "bulwark" | "drive";

export const BRANCHES: readonly Branch[] = [
  "gunnery",
  "ordnance",
  "automation",
  "fleet",
  "bulwark",
  "drive",
];

/** Flagship hull classes reachable by graduating ("saltar"). */
export type HullClass = "workhorse" | "ace" | "gunboat" | "carrier" | "capital";

/**
 * Each hull amplifies two branches — the ship is the multiplier, the powers are
 * the build. Graduating re-picks which branches are amplified.
 */
export const HULL_BRANCH_BIAS: Readonly<
  Record<HullClass, readonly [Branch, Branch]>
> = {
  workhorse: ["automation", "bulwark"],
  ace: ["gunnery", "drive"],
  gunboat: ["ordnance", "automation"],
  carrier: ["fleet", "bulwark"],
  capital: ["fleet", "gunnery"],
};

/** Flat, additive stat deltas the scene reads to build effective ship stats. */
export interface StatBonuses {
  damage: number;
  critChance: number;
  range: number;
  fireRate: number;
  maxHull: number;
  maxShields: number;
  shieldRegen: number;
  evasion: number;
  speed: number;
}

/** Serializable run state accumulated across a survival run. */
export interface SurvivalRunState {
  level: number;
  hull: HullClass;
  branch: Record<Branch, number>;
  escorts: number;
  rerolls: number;
  taken: string[];
  bonuses: StatBonuses;
}

/** Branch depth required for a single-branch capstone to appear. */
export const CAPSTONE_THRESHOLD = 5;

/** Depth required in EACH of two branches for their cross power to appear. */
export const CROSS_THRESHOLD = 3;

/** Multiplier applied to a stat delta when the power's branch is hull-amplified. */
export const HULL_AMP_MULTIPLIER = 1.5;

/** A milestone level is every 5th (the boss wave): it opens the Hangar. */
export function isMilestoneLevel(level: number): boolean {
  return level > 0 && level % 5 === 0;
}

/** True when the given branch is amplified by the current hull. */
export function isBranchAmplified(hull: HullClass, branch: Branch): boolean {
  return HULL_BRANCH_BIAS[hull].includes(branch);
}

/** Returns a fresh zeroed stat block. */
export function emptyBonuses(): StatBonuses {
  return {
    damage: 0,
    critChance: 0,
    range: 0,
    fireRate: 0,
    maxHull: 0,
    maxShields: 0,
    shieldRegen: 0,
    evasion: 0,
    speed: 0,
  };
}

/** Returns a fresh run state for a new survival run. */
export function createRunState(
  hull: HullClass = "workhorse",
): SurvivalRunState {
  return {
    level: 0,
    hull,
    branch: {
      gunnery: 0,
      ordnance: 0,
      automation: 0,
      fleet: 0,
      bulwark: 0,
      drive: 0,
    },
    escorts: 0,
    rerolls: 0,
    taken: [],
    bonuses: emptyBonuses(),
  };
}

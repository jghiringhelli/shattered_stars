/**
 * ArcadeStress — Pilot stress system driven by ship maneuver dials.
 *
 * Each ship's dial (from ShipDefinitions) encodes per-speed/direction difficulty:
 * green = easy, white = neutral, red = stressful. Arcade inputs are classified
 * into the nearest dial template each frame; sustained red-difficulty flying
 * accumulates stress; non-red flying drains it passively (green faster), so a
 * stressed pilot — blocked from red maneuvers and actions — clears by itself.
 * This mirrors the tabletop rule set in real-time.
 */

import type { ManeuverDefinition, ManeuverDifficulty } from "../core/types";

// ============================================
// State
// ============================================

export interface StressState {
  /** 0.0–1.0 continuous stress level */
  readonly level: number;
  /**
   * True once level crosses STRESS_HIGH; stays true until level drops to STRESS_LOW.
   * Hysteresis prevents rapid flipping.
   */
  readonly isStressed: boolean;
}

export const INITIAL_STRESS: StressState = { level: 0, isStressed: false };

// ============================================
// Tuning constants
// ============================================

/**
 * Passive stress drain (fraction of the full bar per second) of every non-red
 * maneuver: stress clears by itself, no recovery action is required. From a
 * full bar a stressed pilot is clear (STRESS_LOW) in 0.85 / 0.2 = 4.25 s.
 */
export const STRESS_PASSIVE_DRAIN_PER_SECOND = 0.2;

/** Extra drain per second on top of the passive one while flying a green maneuver. */
export const STRESS_GREEN_BONUS_DRAIN_PER_SECOND = 0.15;

/** Stress change rate (fraction of full bar) per second for each difficulty. */
export const STRESS_RATES: Record<ManeuverDifficulty, number> = {
  // total -0.35: a full bar clears in ~2.5 s of green flying
  green: -(
    STRESS_PASSIVE_DRAIN_PER_SECOND + STRESS_GREEN_BONUS_DRAIN_PER_SECOND
  ),
  white: -STRESS_PASSIVE_DRAIN_PER_SECOND, // clears in ~4.5 s, whatever the maneuver
  red: 0.28, // full bar fills in ~3.5 s of sustained red maneuver (no passive drain)
};

/** stress.level threshold to enter the stressed state. */
export const STRESS_HIGH = 0.7;
/** stress.level threshold to leave the stressed state (hysteresis gap). */
export const STRESS_LOW = 0.15;

/**
 * Maximum deflection ratio (|angVel| / maxAngVel) allowed when stressed.
 * 0.64 is just below the 0.65 threshold that classifies a maneuver as 'turn',
 * so stressed ships are limited to bank-level turning — matching tabletop's rule
 * that a stressed pilot cannot choose a red maneuver.
 */
export const STRESSED_MAX_DEFLECTION = 0.64;

/**
 * Instant stress applied to the pilot when executing a Snap turn.
 * Snap turns are always red; this ensures even a relaxed pilot feels the cost.
 */
export const KTURN_STRESS_INSTANT = 0.5;

/**
 * Instant stress applied when using a boost action.
 * Boost is an action token cost but also a mild taxing manoeuvre.
 */
export const BOOST_STRESS_INSTANT = 0.15;

// ============================================
// Classification
// ============================================

/**
 * Maps a continuous arcade deflection ratio to the closest dial direction.
 *
 * @param deflectionRatio - |playerAngularVelocity| / maxAngularVelocity, 0–1
 * @param speed           - current speed setting (1–5)
 * @returns the dial direction and speed to look up
 */
export function classifyManeuver(
  deflectionRatio: number,
  speed: number,
): {
  readonly direction: "straight" | "bank_left" | "turn_left";
  readonly speed: number;
} {
  if (deflectionRatio < 0.25) return { direction: "straight", speed };
  if (deflectionRatio < 0.65) return { direction: "bank_left", speed };
  return { direction: "turn_left", speed };
}

// ============================================
// Dial lookup
// ============================================

/**
 * Returns the difficulty of the given maneuver from the ship's dial.
 * Returns 'red' if the entry is absent — the ship is being pushed past its limits.
 *
 * @param direction - canonical direction (left/right symmetry collapsed to left)
 * @param speed     - speed setting at time of classification
 * @param dial      - this ship's maneuver dial from ShipDefinitions
 */
export function lookupDialDifficulty(
  direction: "straight" | "bank_left" | "turn_left",
  speed: number,
  dial: readonly ManeuverDefinition[],
): ManeuverDifficulty {
  const entry = dial.find(
    (m) => m.direction === direction && m.speed === speed,
  );
  return entry?.difficulty ?? "red";
}

// ============================================
// State updates
// ============================================

/**
 * Advances stress state by one frame.
 *
 * @param state      - previous stress state (immutable input)
 * @param difficulty - current maneuver difficulty (drives rate)
 * @param deltaMs    - elapsed frame time in milliseconds
 * @returns new stress state
 */
export function updateStress(
  state: StressState,
  difficulty: ManeuverDifficulty,
  deltaMs: number,
): StressState {
  const rate = STRESS_RATES[difficulty];
  const newLevel = Math.max(
    0,
    Math.min(1, state.level + rate * (deltaMs / 1000)),
  );

  // Hysteresis: flip isStressed only at the defined thresholds.
  let isStressed = state.isStressed;
  if (newLevel >= STRESS_HIGH) isStressed = true;
  if (newLevel <= STRESS_LOW) isStressed = false;

  return { level: newLevel, isStressed };
}

/**
 * Applies an instant stress spike of any size (Snap turns, boosts, ion hits).
 *
 * @param state - current stress state
 * @param amount - stress to add on the 0–1 scale
 * @returns new state with stress elevated and the stressed flag latched
 */
export function applyInstantStress(
  state: StressState,
  amount: number,
): StressState {
  if (amount <= 0) return state;
  const newLevel = Math.min(1, state.level + amount);
  return {
    level: newLevel,
    isStressed: newLevel >= STRESS_HIGH || state.isStressed,
  };
}

/**
 * Scales the stress a maneuver just added (pilot upgrades make stress build
 * faster or slower). Stress recovery (a falling level) is never scaled.
 *
 * @param previous - stress state before the update
 * @param next - stress state after the unscaled update
 * @param multiplier - gain multiplier (<1 = calmer pilot)
 * @returns state with the gain scaled and hysteresis re-evaluated
 */
export function scaleStressGain(
  previous: StressState,
  next: StressState,
  multiplier: number,
): StressState {
  const gain = next.level - previous.level;
  if (gain <= 0 || multiplier === 1) return next;
  const level = Math.max(0, Math.min(1, previous.level + gain * multiplier));
  let isStressed = previous.isStressed;
  if (level >= STRESS_HIGH) isStressed = true;
  if (level <= STRESS_LOW) isStressed = false;
  return { level, isStressed };
}

/**
 * Applies the instant stress spike from a Snap turn.
 * Called once when the player triggers the Snap turn action.
 *
 * @param state - current stress state
 * @returns new state with stress elevated by KTURN_STRESS_INSTANT
 */
export function applyKturnStress(state: StressState): StressState {
  return applyInstantStress(state, KTURN_STRESS_INSTANT);
}

/**
 * Applies the instant stress spike from a boost action.
 * Called once when the player or AI triggers boost.
 *
 * @param state - current stress state
 * @returns new state with stress elevated by BOOST_STRESS_INSTANT
 */
export function applyBoostStress(state: StressState): StressState {
  return applyInstantStress(state, BOOST_STRESS_INSTANT);
}

// ============================================
// Discrete maneuver helpers
// ============================================

/**
 * Finds the best speed for executing a discrete sharp turn (Q/E keys).
 * Prefers currentSpeed; if that speed is absent or blocked by stress, searches
 * outward for the nearest valid dial entry — auto-adjusting speed to match tabletop
 * template rules (a ship always has *some* speed where it can hard-turn).
 *
 * @param dial         - Ship's maneuver dial from ShipDefinitions.
 * @param currentSpeed - Ship's current speed setting.
 * @param minSpeed     - Lower bound (from ShipControlState.minSpeed).
 * @param maxSpeed     - Upper bound (from ShipControlState.maxSpeed).
 * @param isStressed   - True when pilot is in the stressed state.
 * @returns Best speed to use, or null when no turn entry exists at any speed.
 */
export function findBestTurnSpeed(
  dial: readonly ManeuverDefinition[],
  currentSpeed: number,
  minSpeed: number,
  maxSpeed: number,
  isStressed: boolean,
): number | null {
  const entries: Array<{ speed: number; difficulty: ManeuverDifficulty }> = [];
  for (let s = minSpeed; s <= maxSpeed; s++) {
    const entry = dial.find(
      (m) =>
        (m.direction === "turn_left" || m.direction === "turn_right") &&
        m.speed === s,
    );
    if (entry) entries.push({ speed: s, difficulty: entry.difficulty });
  }
  if (entries.length === 0) return null;

  const nonRed = entries.filter((e) => e.difficulty !== "red");
  const candidates = isStressed && nonRed.length > 0 ? nonRed : entries;

  return candidates.reduce((best, cur) =>
    Math.abs(cur.speed - currentSpeed) < Math.abs(best.speed - currentSpeed)
      ? cur
      : best,
  ).speed;
}

// ============================================
// Cycle stress accrual (shared by every cycle-engine scene)
// ============================================

/** Maneuver difficulty ordered from most to least stressful. */
const DIFFICULTY_ORDER: readonly ManeuverDifficulty[] = [
  "red",
  "white",
  "green",
];

/**
 * Ease a maneuver difficulty toward "green" by a number of tiers.
 * @param difficulty - The base maneuver difficulty.
 * @param tiers - How many tiers to relax (0 = unchanged).
 * @returns The eased difficulty.
 */
export function easeDifficulty(
  difficulty: ManeuverDifficulty,
  tiers: number,
): ManeuverDifficulty {
  if (tiers <= 0) return difficulty;
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  const eased = Math.min(
    DIFFICULTY_ORDER.length - 1,
    index + Math.floor(tiers),
  );
  return DIFFICULTY_ORDER[eased]!;
}

/** Inputs for {@link accrueCycleStress}. */
export interface CycleStressInput {
  readonly stress: StressState;
  /** The maneuver that just completed. */
  readonly direction: string;
  readonly speed: number;
  readonly dial: readonly ManeuverDefinition[];
  /** Difficulty tiers eased by auras and upgrades. */
  readonly reliefTiers: number;
  /** Upgrade multiplier on stress gained (1 = unchanged). */
  readonly rateMultiplier: number;
  readonly cycleMs: number;
}

/**
 * Stress after a maneuver cycle completes: classify the maneuver against the
 * ship's dial, ease it by relief tiers, accrue for the cycle, scale the gain.
 *
 * @param input - The completed cycle and the ship's stress modifiers.
 * @returns The new stress state.
 */
export function accrueCycleStress(input: CycleStressInput): StressState {
  const dir = input.direction;
  const dialDir = dir.includes("turn")
    ? "turn_left"
    : dir.includes("bank")
      ? "bank_left"
      : "straight";
  const difficulty = lookupDialDifficulty(dialDir, input.speed, input.dial);
  const eased = easeDifficulty(difficulty, input.reliefTiers);
  return scaleStressGain(
    input.stress,
    updateStress(input.stress, eased, input.cycleMs),
    input.rateMultiplier,
  );
}

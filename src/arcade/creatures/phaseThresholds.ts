/**
 * phaseThresholds — the hull fractions at which each next phase of a boss
 * fight starts, by phase count (shared by Survival's plan and the creature
 * encounters, so both agree on when a phase begins). Pure.
 */

/** Boss hull fractions at which each extra phase triggers, by phase count. */
export const BOSS_PHASE_THRESHOLDS: Readonly<
  Record<number, readonly number[]>
> = {
  1: [],
  2: [0.5],
  3: [0.66, 0.33],
  4: [0.75, 0.5, 0.25],
};

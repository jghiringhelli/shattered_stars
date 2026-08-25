/**
 * EpicBossRules — pure, framework-free rules for the Epic capital-assault boss.
 *
 * Extracted from EpicBattleScene so the boss's phase/section/damage rules are
 * unit-testable without Phaser. The scene owns rendering and mutable boss state;
 * these functions own the numbers that drive the fight (phase thresholds, phase-
 * scaled damage, reinforcement counts, and section-hull aggregation).
 */

/** Boss combat phase: 1 = full strength, 2 = shields failing, 3 = critical. */
export type BossPhase = 1 | 2 | 3;

/** Hull ratio at/under which the boss enters the critical phase. */
export const BOSS_PHASE_3_HULL_RATIO = 0.3;

/** Hull ratio at/under which the boss enters the shields-failing phase. */
export const BOSS_PHASE_2_HULL_RATIO = 0.6;

/** A minimal read-only view of a boss section for hull aggregation. */
export interface BossSectionHull {
  readonly hull: number;
}

/**
 * The phase a boss should be in for a given total-hull ratio (0..1).
 * Phases only ever escalate in-scene; this returns the phase the ratio implies.
 */
export function bossPhaseForHullRatio(hullRatio: number): BossPhase {
  if (hullRatio <= BOSS_PHASE_3_HULL_RATIO) return 3;
  if (hullRatio <= BOSS_PHASE_2_HULL_RATIO) return 2;
  return 1;
}

/** Damage dealt by the boss broadside ability, scaled by phase (2 / 3 / 4). */
export function bossBroadsideDamage(phase: BossPhase): number {
  if (phase === 3) return 4;
  if (phase === 2) return 3;
  return 2;
}

/** Number of escorts launched by the boss, scaled by phase (2, or 3 when critical). */
export function bossReinforcementCount(phase: BossPhase): number {
  return phase === 3 ? 3 : 2;
}

/** Total remaining hull across all boss sections. */
export function sumSectionHull(
  sections: ReadonlyArray<BossSectionHull>,
): number {
  return sections.reduce((sum, section) => sum + section.hull, 0);
}

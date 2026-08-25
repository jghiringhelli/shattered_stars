/**
 * Survival roguelite — threat scaling (pure). Difficulty tracks the player's
 * fleet power, not the wave number (HotAC model). See ADR-0003.
 */

import { type SurvivalRunState, BRANCHES } from "./model";

/** Coefficients for the threat curve (tuned later via headless sim). */
export const THREAT_BASE = 3;
export const THREAT_PER_LEVEL = 1.2;
export const THREAT_PER_INVESTMENT = 0.6;
export const THREAT_PER_ESCORT = 2;
export const THREAT_PER_SHIP = 1.5;

/** Enemies per threat point, and threat per elite spawn. */
export const THREAT_PER_ENEMY = 2.5;
export const THREAT_PER_ELITE = 12;
export const MAX_ENEMIES = 40;

export interface WaveSize {
  enemyCount: number;
  eliteCount: number;
}

/** Sum of all branch investment counts. */
export function totalInvestment(state: SurvivalRunState): number {
  return BRANCHES.reduce((sum, b) => sum + state.branch[b], 0);
}

/**
 * Threat score from the current fleet. Bigger, deeper, more numerous fleets
 * produce proportionally harder waves.
 */
export function computeThreat(
  state: SurvivalRunState,
  playerShipCount: number,
): number {
  return (
    THREAT_BASE +
    state.level * THREAT_PER_LEVEL +
    totalInvestment(state) * THREAT_PER_INVESTMENT +
    state.escorts * THREAT_PER_ESCORT +
    Math.max(0, playerShipCount) * THREAT_PER_SHIP
  );
}

/** Converts a threat score into an enemy wave composition. */
export function sizeWave(threat: number, isBossWave = false): WaveSize {
  const raw = Math.round(threat / THREAT_PER_ENEMY);
  const enemyCount = Math.max(1, Math.min(MAX_ENEMIES, raw));
  let eliteCount = Math.floor(threat / THREAT_PER_ELITE);
  if (isBossWave) eliteCount += 1;
  return { enemyCount, eliteCount };
}

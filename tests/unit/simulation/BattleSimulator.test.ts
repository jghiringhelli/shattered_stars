/**
 * Tests for BattleSimulator determinism via seeded RNG
 */

import { describe, it, expect } from 'vitest';
import { BattleSimulator } from '../../../src/simulation/BattleSimulator';

const TEAM_1 = ['terran_gladius', 'terran_viper'];
const TEAM_2 = ['confed_falcon', 'confed_sparrow'];
const FIXED_SEED = 42;

describe('BattleSimulator — deterministic RNG', () => {
  it('produces identical outcomes when run twice with the same seed', () => {
    const sim1 = new BattleSimulator({ seed: FIXED_SEED });
    const sim2 = new BattleSimulator({ seed: FIXED_SEED });

    const result1 = sim1.runBattle(TEAM_1, TEAM_2);
    const result2 = sim2.runBattle(TEAM_1, TEAM_2);

    expect(result1.winner).toBe(result2.winner);
    expect(result1.turnsElapsed).toBe(result2.turnsElapsed);
    expect(result1.team1ShipsRemaining).toBe(result2.team1ShipsRemaining);
    expect(result1.team2ShipsRemaining).toBe(result2.team2ShipsRemaining);
    expect(result1.team1TotalDamageDealt).toBe(result2.team1TotalDamageDealt);
    expect(result1.team2TotalDamageDealt).toBe(result2.team2TotalDamageDealt);
  });

  it('produces the same outcome across multiple runs of the same seed', () => {
    const referenceResult = new BattleSimulator({ seed: FIXED_SEED }).runBattle(TEAM_1, TEAM_2);

    for (let i = 0; i < 5; i++) {
      const result = new BattleSimulator({ seed: FIXED_SEED }).runBattle(TEAM_1, TEAM_2);
      expect(result.winner).toBe(referenceResult.winner);
      expect(result.turnsElapsed).toBe(referenceResult.turnsElapsed);
    }
  });

  it('different seeds can produce different outcomes', () => {
    // Run enough seeds to find at least one different outcome
    const reference = new BattleSimulator({ seed: 1 }).runBattle(TEAM_1, TEAM_2);
    let foundDifference = false;

    for (let seed = 2; seed <= 100; seed++) {
      const result = new BattleSimulator({ seed }).runBattle(TEAM_1, TEAM_2);
      if (
        result.turnsElapsed !== reference.turnsElapsed ||
        result.team1TotalDamageDealt !== reference.team1TotalDamageDealt
      ) {
        foundDifference = true;
        break;
      }
    }

    expect(foundDifference).toBe(true);
  });

  it('unseeded battle uses random RNG (results may vary)', () => {
    // Just verify it runs without error and produces a valid result
    const result = new BattleSimulator().runBattle(TEAM_1, TEAM_2);
    expect(['team1', 'team2', 'draw']).toContain(result.winner);
    expect(result.turnsElapsed).toBeGreaterThan(0);
  });

  it('seeded batch simulation is deterministic', () => {
    const sim1 = new BattleSimulator({ seed: FIXED_SEED });
    const sim2 = new BattleSimulator({ seed: FIXED_SEED });

    const stats1 = sim1.runBatchSimulation(TEAM_1, TEAM_2, 3);
    const stats2 = sim2.runBatchSimulation(TEAM_1, TEAM_2, 3);

    expect(stats1.team1Wins).toBe(stats2.team1Wins);
    expect(stats1.team2Wins).toBe(stats2.team2Wins);
    expect(stats1.draws).toBe(stats2.draws);
    expect(stats1.averageTurns).toBe(stats2.averageTurns);
  });
});

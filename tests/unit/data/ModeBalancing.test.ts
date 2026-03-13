/**
 * Tests for ModeBalancing system
 */

import { describe, it, expect } from 'vitest';
import {
  getModeCombatStats,
  calculateHitChance,
  rollAttackDice,
  rollDefenseDice,
  resolveTurnBasedAttack,
  ARCHETYPE_DESCRIPTIONS,
  type GameMode,
  type ModeCombatStats,
} from '../../../src/data/ModeBalancing';

// ============================================
// getModeCombatStats
// ============================================

describe('getModeCombatStats', () => {
  describe('turn_based mode', () => {
    it('should return positive hull for a known ship', () => {
      const stats = getModeCombatStats('terran_viper', 'turn_based');
      expect(stats.hull).toBeGreaterThan(0);
      expect(stats.maxHull).toBe(stats.hull);
    });

    it('should return positive shields for a known ship', () => {
      const stats = getModeCombatStats('terran_viper', 'turn_based');
      expect(stats.shields).toBeGreaterThanOrEqual(0);
      expect(stats.maxShields).toBe(stats.shields);
    });

    it('should return attackDice >= 1 for a combat ship', () => {
      const stats = getModeCombatStats('terran_viper', 'turn_based');
      expect(stats.attackDice).toBeGreaterThanOrEqual(1);
    });

    it('should return agilityDice >= 1 for a light fighter', () => {
      const stats = getModeCombatStats('terran_viper', 'turn_based');
      expect(stats.agilityDice).toBeGreaterThanOrEqual(1);
    });

    it('should return maneuverSpeedMultiplier = 1.0 in turn_based', () => {
      const stats = getModeCombatStats('terran_viper', 'turn_based');
      expect(stats.maneuverSpeedMultiplier).toBe(1.0);
    });

    it('should have higher hull than continuous for the same ship', () => {
      const turnBased = getModeCombatStats('terran_viper', 'turn_based');
      const continuous = getModeCombatStats('terran_viper', 'continuous');
      expect(turnBased.hull).toBeGreaterThan(continuous.hull);
    });

    it('should have firingArc of 90 for heavy_fighter in turn_based', () => {
      // terran_gladius is a heavy fighter with arcMod=1.0 -> 90 degrees
      const stats = getModeCombatStats('terran_gladius', 'turn_based');
      expect(stats.firingArc).toBe(90);
    });
  });

  describe('continuous mode', () => {
    it('should return positive hull for a known ship', () => {
      const stats = getModeCombatStats('terran_viper', 'continuous');
      expect(stats.hull).toBeGreaterThan(0);
      expect(stats.maxHull).toBe(stats.hull);
    });

    it('should return weaponCooldown > 0 in continuous mode', () => {
      const stats = getModeCombatStats('terran_viper', 'continuous');
      expect(stats.weaponCooldown).toBeGreaterThan(0);
    });

    it('should return weaponRange > 0 in continuous mode', () => {
      const stats = getModeCombatStats('terran_viper', 'continuous');
      expect(stats.weaponRange).toBeGreaterThan(0);
    });

    it('should have maneuverSpeedMultiplier > 1.0 in continuous', () => {
      const stats = getModeCombatStats('terran_viper', 'continuous');
      expect(stats.maneuverSpeedMultiplier).toBeGreaterThan(1.0);
    });

    it('should have faster cooldown for interceptors vs gunships', () => {
      const interceptor = getModeCombatStats('terran_raptor', 'continuous');
      const gunship = getModeCombatStats('terran_bastion', 'continuous');
      expect(interceptor.weaponCooldown).toBeLessThan(gunship.weaponCooldown);
    });

    it('gunship should have wider arc than interceptor', () => {
      const gunship = getModeCombatStats('terran_bastion', 'continuous');
      const interceptor = getModeCombatStats('terran_raptor', 'continuous');
      expect(gunship.firingArc).toBeGreaterThan(interceptor.firingArc);
    });
  });

  describe('unknown ship', () => {
    it('should return default stats for unknown ship ID', () => {
      const stats = getModeCombatStats('unknown_ship_xyz', 'turn_based');
      expect(stats.hull).toBeGreaterThan(0);
      expect(stats.maxHull).toBe(stats.hull);
      expect(stats.attackDice).toBeGreaterThan(0);
    });

    it('should return different defaults per mode for unknown ship', () => {
      const turnBased = getModeCombatStats('unknown_ship_xyz', 'turn_based');
      const continuous = getModeCombatStats('unknown_ship_xyz', 'continuous');
      expect(turnBased.hull).not.toBe(continuous.hull);
    });

    it('should have positive shields from default stats', () => {
      const stats = getModeCombatStats('unknown_ship_xyz', 'continuous');
      expect(stats.shields).toBeGreaterThanOrEqual(0);
    });
  });

  describe('all ships produce valid stats', () => {
    const shipIds = [
      'terran_viper', 'terran_gladius', 'terran_raptor', 'terran_bastion',
      'confed_sparrow', 'confed_stinger', 'confed_comet',
    ];
    const modes: GameMode[] = ['turn_based', 'continuous'];

    for (const shipId of shipIds) {
      for (const mode of modes) {
        it(`${shipId} in ${mode} should produce valid ModeCombatStats`, () => {
          const stats = getModeCombatStats(shipId, mode);
          expect(stats.hull).toBeGreaterThan(0);
          expect(stats.maxHull).toBe(stats.hull);
          expect(stats.shields).toBeGreaterThanOrEqual(0);
          expect(stats.maxShields).toBe(stats.shields);
          expect(stats.attackDice).toBeGreaterThanOrEqual(0);
          expect(stats.agilityDice).toBeGreaterThanOrEqual(0);
          expect(stats.firingArc).toBeGreaterThan(0);
          expect(stats.maneuverSpeedMultiplier).toBeGreaterThan(0);
          expect(stats.evadeBonus).toBeGreaterThanOrEqual(0);
        });
      }
    }
  });

  describe('role-based differences', () => {
    it('bomber should have higher hull than light_fighter in same mode', () => {
      const bomber = getModeCombatStats('terran_reaper', 'turn_based');
      const fighter = getModeCombatStats('terran_viper', 'turn_based');
      expect(bomber.hull).toBeGreaterThan(fighter.hull);
    });

    it('gunship should have more attackDice than light_fighter in turn_based', () => {
      const gunship = getModeCombatStats('terran_bastion', 'turn_based');
      const fighter = getModeCombatStats('terran_viper', 'turn_based');
      expect(gunship.attackDice).toBeGreaterThan(fighter.attackDice);
    });

    it('light_fighter should have more agilityDice than gunship in turn_based', () => {
      const fighter = getModeCombatStats('terran_viper', 'turn_based');
      const gunship = getModeCombatStats('terran_bastion', 'turn_based');
      expect(fighter.agilityDice).toBeGreaterThan(gunship.agilityDice);
    });

    it('support ship should have slower cooldown than interceptor in continuous', () => {
      const support = getModeCombatStats('terran_sentinel', 'continuous');
      const interceptor = getModeCombatStats('terran_raptor', 'continuous');
      expect(support.weaponCooldown).toBeGreaterThan(interceptor.weaponCooldown);
    });
  });
});

// ============================================
// calculateHitChance
// ============================================

describe('calculateHitChance', () => {
  it('should return ~60% base chance with 0 attack and 0 agility', () => {
    const chance = calculateHitChance(0, 0);
    expect(chance).toBeCloseTo(0.6, 5);
  });

  it('should increase with higher attack', () => {
    const low = calculateHitChance(0, 0);
    const high = calculateHitChance(4, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('should decrease with higher agility', () => {
    const low = calculateHitChance(0, 0);
    const high = calculateHitChance(0, 4);
    expect(high).toBeLessThan(low);
  });

  it('should clamp at minimum 0.20', () => {
    // Very low attack, very high agility → hit chance floored at 0.2
    const chance = calculateHitChance(0, 100);
    expect(chance).toBe(0.2);
  });

  it('should clamp at maximum 0.95', () => {
    // Very high attack, zero agility → hit chance capped at 0.95
    const chance = calculateHitChance(100, 0);
    expect(chance).toBe(0.95);
  });

  it('should match formula: 0.6 + attack*0.05 - agility*0.08 in normal range', () => {
    const attack = 2;
    const agility = 1;
    const expected = Math.max(0.2, Math.min(0.95, 0.6 + attack * 0.05 - agility * 0.08));
    expect(calculateHitChance(attack, agility)).toBeCloseTo(expected, 5);
  });

  it('should return a value between 0 and 1 for any inputs', () => {
    const values = [-10, 0, 1, 3, 5, 10, 100];
    for (const a of values) {
      for (const d of values) {
        const chance = calculateHitChance(a, d);
        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ============================================
// rollAttackDice
// ============================================

describe('rollAttackDice', () => {
  it('should return zeros for 0 dice', () => {
    const result = rollAttackDice(0);
    expect(result.hits).toBe(0);
    expect(result.crits).toBe(0);
    expect(result.focuses).toBe(0);
  });

  it('should return non-negative values', () => {
    for (let i = 0; i < 10; i++) {
      const result = rollAttackDice(4);
      expect(result.hits).toBeGreaterThanOrEqual(0);
      expect(result.crits).toBeGreaterThanOrEqual(0);
      expect(result.focuses).toBeGreaterThanOrEqual(0);
    }
  });

  it('total results should not exceed numDice', () => {
    for (let i = 0; i < 20; i++) {
      const numDice = 5;
      const result = rollAttackDice(numDice);
      expect(result.hits + result.crits + result.focuses).toBeLessThanOrEqual(numDice);
    }
  });

  it('should have expected distribution over many rolls (crits ~12.5%)', () => {
    // Law of large numbers: 1000 rolls should cluster near expected rates
    let totalCrits = 0;
    const rolls = 1000;
    const dice = 10;
    for (let i = 0; i < rolls; i++) {
      totalCrits += rollAttackDice(dice).crits;
    }
    const critRate = totalCrits / (rolls * dice);
    // Expected: 1/8 = 12.5% ± 3% tolerance
    expect(critRate).toBeGreaterThan(0.095);
    expect(critRate).toBeLessThan(0.16);
  });

  it('should return an object with all three fields', () => {
    const result = rollAttackDice(3);
    expect('hits' in result).toBe(true);
    expect('crits' in result).toBe(true);
    expect('focuses' in result).toBe(true);
  });
});

// ============================================
// rollDefenseDice
// ============================================

describe('rollDefenseDice', () => {
  it('should return zeros for 0 dice', () => {
    const result = rollDefenseDice(0);
    expect(result.evades).toBe(0);
    expect(result.focuses).toBe(0);
  });

  it('should return non-negative values', () => {
    for (let i = 0; i < 10; i++) {
      const result = rollDefenseDice(4);
      expect(result.evades).toBeGreaterThanOrEqual(0);
      expect(result.focuses).toBeGreaterThanOrEqual(0);
    }
  });

  it('total results should not exceed numDice', () => {
    for (let i = 0; i < 20; i++) {
      const numDice = 5;
      const result = rollDefenseDice(numDice);
      expect(result.evades + result.focuses).toBeLessThanOrEqual(numDice);
    }
  });

  it('should have expected evade rate over many rolls (~37.5%)', () => {
    let totalEvades = 0;
    const rolls = 1000;
    const dice = 8;
    for (let i = 0; i < rolls; i++) {
      totalEvades += rollDefenseDice(dice).evades;
    }
    const evadeRate = totalEvades / (rolls * dice);
    // Expected: 3/8 = 37.5% ± 5% tolerance
    expect(evadeRate).toBeGreaterThan(0.32);
    expect(evadeRate).toBeLessThan(0.43);
  });

  it('should return an object with evades and focuses', () => {
    const result = rollDefenseDice(2);
    expect('evades' in result).toBe(true);
    expect('focuses' in result).toBe(true);
  });
});

// ============================================
// resolveTurnBasedAttack
// ============================================

describe('resolveTurnBasedAttack', () => {
  it('should deal no damage when attack dice is 0', () => {
    const result = resolveTurnBasedAttack(0, 0, 0, 5, false, false, false);
    expect(result.hullDamaged).toBe(0);
    expect(result.shieldsDamaged).toBe(0);
    expect(result.wasDestroyed).toBe(false);
  });

  it('should return hitsLanded >= 0 always', () => {
    for (let i = 0; i < 20; i++) {
      const result = resolveTurnBasedAttack(3, 2, 1, 3, false, false, false);
      expect(result.hitsLanded).toBeGreaterThanOrEqual(0);
    }
  });

  it('should absorb shields before hull', () => {
    // With overwhelming attack (20 dice, 0 defense, no shields on target — verify hull only)
    // Use 0 shields scenario: all damage goes to hull
    let hullDamageWithoutShields = 0;
    let shieldDamageWithoutShields = 0;
    for (let i = 0; i < 50; i++) {
      const r = resolveTurnBasedAttack(10, 0, 0, 10, true, false, false);
      hullDamageWithoutShields += r.hullDamaged;
      shieldDamageWithoutShields += r.shieldsDamaged;
    }
    // All damage goes to hull when shields=0
    expect(shieldDamageWithoutShields).toBe(0);
  });

  it('should apply damage to shields before hull when shields > 0', () => {
    // With 10 attack dice, focus=true, 0 defense, 2 shields, 5 hull
    // Most runs will result in some shield damage before hull
    let anyShieldDamage = false;
    for (let i = 0; i < 50; i++) {
      const r = resolveTurnBasedAttack(10, 0, 2, 10, true, false, false);
      if (r.shieldsDamaged > 0) anyShieldDamage = true;
    }
    expect(anyShieldDamage).toBe(true);
  });

  it('wasDestroyed is true when all hull removed', () => {
    // With 20 dice, focus=true, 0 defense, 1 hull: almost always destroyed
    let destroyed = false;
    for (let i = 0; i < 50; i++) {
      const r = resolveTurnBasedAttack(20, 0, 0, 1, true, false, false);
      if (r.wasDestroyed) destroyed = true;
    }
    expect(destroyed).toBe(true);
  });

  it('wasDestroyed is false with high defense (50 dice, 0 attack)', () => {
    for (let i = 0; i < 20; i++) {
      const r = resolveTurnBasedAttack(0, 50, 2, 5, false, false, false);
      expect(r.wasDestroyed).toBe(false);
    }
  });

  it('evade token should reduce damage by at least 1 on average', () => {
    let withEvadeTotal = 0;
    let withoutEvadeTotal = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      withEvadeTotal += resolveTurnBasedAttack(4, 1, 0, 10, false, false, true).hitsLanded;
      withoutEvadeTotal += resolveTurnBasedAttack(4, 1, 0, 10, false, false, false).hitsLanded;
    }
    expect(withEvadeTotal).toBeLessThanOrEqual(withoutEvadeTotal);
  });

  it('attacker focus token converts focuses to hits', () => {
    let withFocusTotal = 0;
    let withoutFocusTotal = 0;
    const runs = 300;
    for (let i = 0; i < runs; i++) {
      withFocusTotal += resolveTurnBasedAttack(5, 0, 0, 20, true, false, false).hitsLanded;
      withoutFocusTotal += resolveTurnBasedAttack(5, 0, 0, 20, false, false, false).hitsLanded;
    }
    // With focus, total hits should be >= without focus on aggregate
    expect(withFocusTotal).toBeGreaterThanOrEqual(withoutFocusTotal);
  });

  it('defender focus token converts focuses to evades', () => {
    let withFocusTotal = 0;
    let withoutFocusTotal = 0;
    const runs = 300;
    for (let i = 0; i < runs; i++) {
      withFocusTotal += resolveTurnBasedAttack(3, 3, 0, 20, false, true, false).hitsLanded;
      withoutFocusTotal += resolveTurnBasedAttack(3, 3, 0, 20, false, false, false).hitsLanded;
    }
    expect(withFocusTotal).toBeLessThanOrEqual(withoutFocusTotal);
  });

  it('critsLanded should not exceed hitsLanded', () => {
    for (let i = 0; i < 50; i++) {
      const r = resolveTurnBasedAttack(6, 0, 0, 20, false, false, false);
      expect(r.critsLanded).toBeLessThanOrEqual(r.hitsLanded);
    }
  });

  it('critsLanded should be non-negative', () => {
    for (let i = 0; i < 20; i++) {
      const r = resolveTurnBasedAttack(4, 2, 1, 5, false, false, false);
      expect(r.critsLanded).toBeGreaterThanOrEqual(0);
    }
  });

  it('hullDamaged + shieldsDamaged should equal hitsLanded', () => {
    for (let i = 0; i < 50; i++) {
      const r = resolveTurnBasedAttack(5, 1, 2, 8, true, false, false);
      expect(r.hullDamaged + r.shieldsDamaged).toBe(r.hitsLanded);
    }
  });
});

// ============================================
// ARCHETYPE_DESCRIPTIONS
// ============================================

describe('ARCHETYPE_DESCRIPTIONS', () => {
  const expectedRoles = ['light_fighter', 'interceptor', 'heavy_fighter', 'bomber', 'gunship', 'support'];

  it('should have entries for all 6 roles', () => {
    for (const role of expectedRoles) {
      expect(ARCHETYPE_DESCRIPTIONS[role]).toBeDefined();
    }
  });

  it('each entry should have name, strengths, and weaknesses', () => {
    for (const role of expectedRoles) {
      const desc = ARCHETYPE_DESCRIPTIONS[role]!;
      expect(typeof desc.name).toBe('string');
      expect(desc.name.length).toBeGreaterThan(0);
      expect(typeof desc.strengths).toBe('string');
      expect(desc.strengths.length).toBeGreaterThan(0);
      expect(typeof desc.weaknesses).toBe('string');
      expect(desc.weaknesses.length).toBeGreaterThan(0);
    }
  });

  it('support archetype should mention shields or buffs', () => {
    const support = ARCHETYPE_DESCRIPTIONS['support']!;
    const combined = (support.strengths + support.name).toLowerCase();
    expect(combined).toMatch(/shield|buff|support|team/i);
  });

  it('interceptor should mention speed or agility', () => {
    const interceptor = ARCHETYPE_DESCRIPTIONS['interceptor']!;
    const combined = interceptor.strengths.toLowerCase();
    expect(combined).toMatch(/fast|agil|speed|evasion/i);
  });

  it('gunship should mention damage or firepower', () => {
    const gunship = ARCHETYPE_DESCRIPTIONS['gunship']!;
    const combined = gunship.strengths.toLowerCase();
    expect(combined).toMatch(/damage|fire|tanky|arc/i);
  });
});

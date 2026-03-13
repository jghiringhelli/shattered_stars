/**
 * Space Monsters Tests
 *
 * Tests for monster definitions, spawning, and encounters.
 */

import { describe, it, expect } from 'vitest';
import {
  MONSTER_DEFINITIONS,
  MONSTER_SIZES,
  MONSTER_SPAWN_TABLE,
  PRESET_ENCOUNTERS,
  getMonsterDefinition,
  getMonstersByCategory,
  getBossMonsters,
  getAvailableMonsters,
  selectRandomMonster,
  getMonsterSizePixels,
  getMonsterEffectiveHealth,
  type MonsterCategory,
} from '../../../src/data/SpaceMonsters';

describe('Monster Definitions', () => {
  it('should have monster definitions', () => {
    const monsters = Object.values(MONSTER_DEFINITIONS);
    expect(monsters.length).toBeGreaterThan(0);
  });

  it('should have all required fields for each monster', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      expect(monster.id).toBeTruthy();
      expect(monster.name).toBeTruthy();
      expect(monster.category).toBeTruthy();
      expect(monster.size).toBeTruthy();
      expect(monster.description).toBeTruthy();
      expect(monster.hull).toBeGreaterThan(0);
      expect(monster.abilities.length).toBeGreaterThan(0);
      expect(typeof monster.aggression).toBe('number');
      expect(typeof monster.pointValue).toBe('number');
    }
  });

  it('should have unique IDs for all monsters', () => {
    const ids = Object.keys(MONSTER_DEFINITIONS);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should have valid categories', () => {
    const validCategories: MonsterCategory[] = ['swarm', 'leviathan', 'parasite', 'void_entity', 'hive_mind'];
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      expect(validCategories).toContain(monster.category);
    }
  });

  it('should have valid sizes', () => {
    const validSizes = Object.keys(MONSTER_SIZES);
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      expect(validSizes).toContain(monster.size);
    }
  });

  it('should have abilities with valid cooldowns', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      for (const ability of monster.abilities) {
        expect(ability.cooldown).toBeGreaterThanOrEqual(0);
        expect(ability.id).toBeTruthy();
        expect(ability.name).toBeTruthy();
      }
    }
  });
});

describe('Monster Categories', () => {
  it('should have swarm monsters', () => {
    const swarm = getMonstersByCategory('swarm');
    expect(swarm.length).toBeGreaterThan(0);
    expect(swarm.every(m => m.category === 'swarm')).toBe(true);
  });

  it('should have leviathan monsters', () => {
    const leviathans = getMonstersByCategory('leviathan');
    expect(leviathans.length).toBeGreaterThan(0);
    expect(leviathans.every(m => m.category === 'leviathan')).toBe(true);
  });

  it('should have parasite monsters', () => {
    const parasites = getMonstersByCategory('parasite');
    expect(parasites.length).toBeGreaterThan(0);
    expect(parasites.every(m => m.category === 'parasite')).toBe(true);
  });

  it('should have void entity monsters', () => {
    const entities = getMonstersByCategory('void_entity');
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every(m => m.category === 'void_entity')).toBe(true);
  });

  it('should have hive mind monsters', () => {
    const hiveMinds = getMonstersByCategory('hive_mind');
    expect(hiveMinds.length).toBeGreaterThan(0);
    expect(hiveMinds.every(m => m.category === 'hive_mind')).toBe(true);
  });

  it('should have boss monsters', () => {
    const bosses = getBossMonsters();
    expect(bosses.length).toBeGreaterThan(0);
    expect(bosses.every(m => m.isBoss)).toBe(true);
  });

  it('should have non-boss monsters', () => {
    const nonBosses = Object.values(MONSTER_DEFINITIONS).filter(m => !m.isBoss);
    expect(nonBosses.length).toBeGreaterThan(0);
  });
});

describe('Monster Stats', () => {
  it('should have swarm monsters with low stats', () => {
    const swarm = getMonstersByCategory('swarm');
    for (const monster of swarm) {
      expect(monster.hull).toBeLessThanOrEqual(5);
      expect(monster.size).toMatch(/tiny|small/);
    }
  });

  it('should have leviathans with high stats', () => {
    const leviathans = getMonstersByCategory('leviathan');
    for (const monster of leviathans) {
      expect(monster.hull).toBeGreaterThanOrEqual(50);
      expect(['colossal', 'titan']).toContain(monster.size);
    }
  });

  it('should have bosses with multiple abilities', () => {
    const bosses = getBossMonsters();
    for (const boss of bosses) {
      expect(boss.abilities.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should have larger monsters with more point value', () => {
    const monsters = Object.values(MONSTER_DEFINITIONS);
    const sorted = monsters.sort((a, b) => getMonsterSizePixels(a) - getMonsterSizePixels(b));

    // Generally, larger monsters should be worth more
    const smallAvg = sorted.slice(0, 5).reduce((sum, m) => sum + m.pointValue, 0) / 5;
    const largeAvg = sorted.slice(-3).reduce((sum, m) => sum + m.pointValue, 0) / 3;

    expect(largeAvg).toBeGreaterThan(smallAvg);
  });
});

describe('Monster Spawning', () => {
  it('should have spawn rules in spawn table', () => {
    expect(MONSTER_SPAWN_TABLE.length).toBeGreaterThan(0);
  });

  it('should have valid monster IDs in spawn table', () => {
    for (const rule of MONSTER_SPAWN_TABLE) {
      const monster = getMonsterDefinition(rule.monsterId);
      expect(monster).toBeDefined();
      expect(monster?.id).toBe(rule.monsterId);
    }
  });

  it('should return monsters for difficulty 0', () => {
    const available = getAvailableMonsters(0);
    expect(available.length).toBeGreaterThan(0);
  });

  it('should return more monsters at higher difficulty', () => {
    const lowDiff = getAvailableMonsters(0);
    const highDiff = getAvailableMonsters(20);
    expect(highDiff.length).toBeGreaterThan(lowDiff.length);
  });

  it('should select random monster based on difficulty', () => {
    const monster = selectRandomMonster(10);
    expect(monster).not.toBeNull();
    expect(monster?.id).toBeTruthy();
  });

  it('should respect minDifficulty in spawn rules', () => {
    const available = getAvailableMonsters(5);
    for (const rule of available) {
      expect(rule.minDifficulty).toBeLessThanOrEqual(5);
    }
  });
});

describe('Monster Sizing', () => {
  it('should have ascending sizes', () => {
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'colossal', 'titan'] as const;
    for (let i = 1; i < sizes.length; i++) {
      expect(MONSTER_SIZES[sizes[i]]).toBeGreaterThan(MONSTER_SIZES[sizes[i - 1]!]!);
    }
  });

  it('should return correct size in pixels', () => {
    const monster = getMonsterDefinition('void_mite');
    expect(monster).toBeDefined();
    expect(getMonsterSizePixels(monster!)).toBe(MONSTER_SIZES.tiny);
  });

  it('should calculate effective health correctly', () => {
    const monster = getMonsterDefinition('kraken_prime');
    expect(monster).toBeDefined();

    // kraken_prime: hull 100, shields 30, armor 4
    // With 10 expected hits: 100 + 30 + (4 * 10) = 170
    const effectiveHealth = getMonsterEffectiveHealth(monster!, 10);
    expect(effectiveHealth).toBe(100 + 30 + (4 * 10));
  });
});

describe('Preset Encounters', () => {
  it('should have preset encounters', () => {
    expect(PRESET_ENCOUNTERS.length).toBeGreaterThan(0);
  });

  it('should have valid monster IDs in encounters', () => {
    for (const encounter of PRESET_ENCOUNTERS) {
      for (const spawn of encounter.monsters) {
        const monster = getMonsterDefinition(spawn.monsterId);
        expect(monster).toBeDefined();
      }
    }
  });

  it('should have increasing difficulty across encounters', () => {
    const sorted = [...PRESET_ENCOUNTERS].sort((a, b) => a.difficulty - b.difficulty);
    // Check that difficulty values make sense
    expect(sorted[0]!.difficulty).toBeLessThan(sorted[sorted.length - 1]!.difficulty);
  });

  it('should have rewards that scale with difficulty', () => {
    const sorted = [...PRESET_ENCOUNTERS].sort((a, b) => a.difficulty - b.difficulty);
    const easiest = sorted[0]!;
    const hardest = sorted[sorted.length - 1]!;

    expect(hardest.rewards.points).toBeGreaterThan(easiest.rewards.points);
  });

  it('should have all encounter fields', () => {
    for (const encounter of PRESET_ENCOUNTERS) {
      expect(encounter.id).toBeTruthy();
      expect(encounter.name).toBeTruthy();
      expect(encounter.description).toBeTruthy();
      expect(encounter.monsters.length).toBeGreaterThan(0);
      expect(encounter.difficulty).toBeGreaterThan(0);
      expect(encounter.rewards.points).toBeGreaterThan(0);
    }
  });
});

describe('Monster Abilities', () => {
  it('should have valid effect types', () => {
    const validEffects = [
      'damage_aoe', 'disable_weapons', 'disable_shields', 'pull', 'push',
      'spawn_minions', 'regenerate', 'phaseshift', 'corruption', 'devour',
      'swarm_buff', 'emp', 'gravity_well', 'void_rift', 'psionic_blast', 'bio_acid'
    ];

    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      for (const ability of monster.abilities) {
        expect(validEffects).toContain(ability.effect);
      }
    }
  });

  it('should have spawn_minions abilities with spawnCount', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      for (const ability of monster.abilities) {
        if (ability.effect === 'spawn_minions') {
          expect(ability.spawnCount).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should have damage abilities with damage value', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      for (const ability of monster.abilities) {
        if (ability.effect === 'damage_aoe' || ability.effect === 'psionic_blast') {
          expect(ability.damage).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should have range for AoE abilities', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      for (const ability of monster.abilities) {
        if (['damage_aoe', 'gravity_well', 'emp', 'psionic_blast'].includes(ability.effect)) {
          expect(ability.range).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Monster Sections (Multi-part Bosses)', () => {
  it('should have bosses with sections', () => {
    const bossesWithSections = Object.values(MONSTER_DEFINITIONS)
      .filter(m => m.sections && m.sections.length > 0);
    expect(bossesWithSections.length).toBeGreaterThan(0);
  });

  it('should have section hull summing to total hull', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      if (monster.sections && monster.sections.length > 0) {
        const sectionHull = monster.sections.reduce((sum, s) => sum + s.hull, 0);
        expect(sectionHull).toBe(monster.hull);
      }
    }
  });

  it('should have valid section abilities', () => {
    for (const monster of Object.values(MONSTER_DEFINITIONS)) {
      if (monster.sections) {
        const abilityIds = monster.abilities.map(a => a.id);
        for (const section of monster.sections) {
          for (const abilityId of section.abilities) {
            expect(abilityIds).toContain(abilityId);
          }
        }
      }
    }
  });
});

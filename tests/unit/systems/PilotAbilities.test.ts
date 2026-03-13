/**
 * Tests for PilotAbilities system
 */

import { describe, it, expect } from 'vitest';
import {
  PILOT_ABILITIES,
  canEquipAbility,
  getUnlockableAbilities,
  calculateAbilitiesCost,
  getAbilitiesForTrigger,
  isAbilityConditionMet,
  applyPassiveAbilities,
} from '../../../src/systems/PilotAbilities';
import type { ShipState } from '../../../src/core/types';

// ============================================
// Helpers
// ============================================

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'ship_1',
    definitionId: 'terran_viper',
    faction: 'terran_hegemony',
    owner: 'player',
    x: 0,
    y: 0,
    angle: 0,
    hull: 5,
    maxHull: 5,
    shields: 2,
    maxShields: 2,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: 'front',
    charges: 0,
    maxCharges: 0,
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('PilotAbilities', () => {
  describe('PILOT_ABILITIES', () => {
    it('should define multiple abilities', () => {
      const abilities = Object.values(PILOT_ABILITIES);
      expect(abilities.length).toBeGreaterThan(10);
    });

    it('each ability should have required fields', () => {
      for (const ability of Object.values(PILOT_ABILITIES)) {
        expect(ability.id).toBeTruthy();
        expect(ability.name).toBeTruthy();
        expect(typeof ability.pointCost).toBe('number');
        expect(typeof ability.xpCost).toBe('number');
        expect(ability.effects).toBeDefined();
      }
    });

    it('should have abilities from multiple categories', () => {
      const categories = new Set(Object.values(PILOT_ABILITIES).map(a => a.category));
      expect(categories.size).toBeGreaterThan(2);
    });

    it('should have abilities with different triggers', () => {
      const triggers = new Set(Object.values(PILOT_ABILITIES).map(a => a.trigger));
      expect(triggers.size).toBeGreaterThan(2);
    });

    it('hull_upgrade should exist', () => {
      expect(PILOT_ABILITIES['hull_upgrade']).toBeDefined();
    });

    it('shield_upgrade should exist', () => {
      expect(PILOT_ABILITIES['shield_upgrade']).toBeDefined();
    });
  });

  describe('canEquipAbility', () => {
    const generalAbility = PILOT_ABILITIES['marksmanship']!;
    const voidCorsairAbility = Object.values(PILOT_ABILITIES).find(a => a.requiredFaction === 'void_corsairs')!;
    const highSkillAbility = Object.values(PILOT_ABILITIES).find(a => a.minPilotSkill !== undefined)!;

    it('should allow equipping a valid ability', () => {
      const ship = { faction: 'terran_hegemony' as const, role: 'light_fighter', pilotSkill: 5 };
      const result = canEquipAbility(generalAbility, ship, []);
      expect(result.valid).toBe(true);
    });

    it('should reject if faction does not match', () => {
      if (!voidCorsairAbility) return;
      const ship = { faction: 'terran_hegemony' as const, role: 'light_fighter', pilotSkill: 5 };
      const result = canEquipAbility(voidCorsairAbility, ship, []);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('void_corsairs');
    });

    it('should allow if faction matches', () => {
      if (!voidCorsairAbility) return;
      const ship = { faction: 'void_corsairs' as const, role: 'light_fighter', pilotSkill: 5 };
      const result = canEquipAbility(voidCorsairAbility, ship, []);
      expect(result.valid).toBe(true);
    });

    it('should reject if pilot skill is too low', () => {
      if (!highSkillAbility || !highSkillAbility.minPilotSkill) return;
      const ship = {
        faction: (highSkillAbility.requiredFaction ?? 'terran_hegemony') as 'terran_hegemony',
        role: 'light_fighter',
        pilotSkill: highSkillAbility.minPilotSkill - 1,
      };
      const result = canEquipAbility(highSkillAbility, ship, []);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('pilot skill');
    });

    it('should reject if ability already equipped', () => {
      const ship = { faction: 'terran_hegemony' as const, role: 'light_fighter', pilotSkill: 5 };
      const result = canEquipAbility(generalAbility, ship, [generalAbility.id]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Already equipped');
    });
  });

  describe('getUnlockableAbilities', () => {
    it('should return abilities within XP budget', () => {
      const abilities = getUnlockableAbilities('terran_hegemony', 100, []);
      // Only return abilities costing <= 100 XP
      for (const ability of abilities) {
        expect(ability.xpCost).toBeLessThanOrEqual(100);
      }
    });

    it('should not return already unlocked abilities', () => {
      const allAbilities = getUnlockableAbilities('terran_hegemony', 10000, []);
      const firstId = allAbilities[0]?.id;
      if (!firstId) return;

      const withUnlocked = getUnlockableAbilities('terran_hegemony', 10000, [firstId]);
      expect(withUnlocked.some(a => a.id === firstId)).toBe(false);
    });

    it('should exclude faction-specific abilities from wrong faction', () => {
      const corsairAbilities = Object.values(PILOT_ABILITIES)
        .filter(a => a.requiredFaction === 'void_corsairs')
        .map(a => a.id);

      if (corsairAbilities.length === 0) return;

      const abilities = getUnlockableAbilities('terran_hegemony', 10000, []);
      for (const ability of abilities) {
        expect(corsairAbilities).not.toContain(ability.id);
      }
    });

    it('should include faction-specific abilities for correct faction', () => {
      const corsairAbilities = Object.values(PILOT_ABILITIES)
        .filter(a => a.requiredFaction === 'void_corsairs');

      if (corsairAbilities.length === 0) return;

      const abilities = getUnlockableAbilities('void_corsairs', 10000, []);
      const ids = abilities.map(a => a.id);

      for (const corsairAbility of corsairAbilities) {
        expect(ids).toContain(corsairAbility.id);
      }
    });

    it('should return results sorted by xpCost ascending', () => {
      const abilities = getUnlockableAbilities('terran_hegemony', 10000, []);
      for (let i = 1; i < abilities.length; i++) {
        expect(abilities[i]!.xpCost).toBeGreaterThanOrEqual(abilities[i - 1]!.xpCost);
      }
    });

    it('should return empty array when no XP', () => {
      const abilities = getUnlockableAbilities('terran_hegemony', 0, []);
      expect(abilities).toHaveLength(0);
    });
  });

  describe('calculateAbilitiesCost', () => {
    it('should return 0 for empty array', () => {
      expect(calculateAbilitiesCost([])).toBe(0);
    });

    it('should sum up point costs of abilities', () => {
      const marksmanship = PILOT_ABILITIES['marksmanship']!;
      const hullUpgrade = PILOT_ABILITIES['hull_upgrade']!;

      const total = calculateAbilitiesCost(['marksmanship', 'hull_upgrade']);
      expect(total).toBe(marksmanship.pointCost + hullUpgrade.pointCost);
    });

    it('should handle unknown ability IDs gracefully', () => {
      const result = calculateAbilitiesCost(['nonexistent_ability']);
      expect(result).toBe(0);
    });
  });

  describe('getAbilitiesForTrigger', () => {
    it('should return only abilities matching the trigger', () => {
      const abilityIds = ['marksmanship', 'hull_upgrade', 'predator'];
      const attackAbilities = getAbilitiesForTrigger(abilityIds, 'on_attack');

      for (const ability of attackAbilities) {
        expect(ability.trigger).toBe('on_attack');
      }
    });

    it('should return empty array if no abilities match trigger', () => {
      const abilities = getAbilitiesForTrigger(['hull_upgrade'], 'on_attack');
      // hull_upgrade is passive, not on_attack
      expect(abilities).toHaveLength(0);
    });

    it('should handle unknown ability IDs gracefully', () => {
      const abilities = getAbilitiesForTrigger(['nonexistent_ability'], 'passive');
      expect(abilities).toHaveLength(0);
    });

    it('should return passive hull_upgrade with passive trigger', () => {
      const abilities = getAbilitiesForTrigger(['hull_upgrade'], 'passive');
      expect(abilities).toHaveLength(1);
      expect(abilities[0]!.id).toBe('hull_upgrade');
    });
  });

  describe('isAbilityConditionMet', () => {
    const attacker = makeShip({ hull: 3, maxHull: 5, isStressed: false });

    it('should return true when condition is undefined', () => {
      expect(isAbilityConditionMet(undefined, { attacker })).toBe(true);
    });

    it('range condition: should return true when range matches', () => {
      expect(isAbilityConditionMet(
        { type: 'range', value: 1 },
        { attacker, range: 1 }
      )).toBe(true);
    });

    it('range condition: should return false when range does not match', () => {
      expect(isAbilityConditionMet(
        { type: 'range', value: 1 },
        { attacker, range: 2 }
      )).toBe(false);
    });

    it('bullseye condition: should return true when inBullseye is true', () => {
      expect(isAbilityConditionMet(
        { type: 'bullseye' },
        { attacker, inBullseye: true }
      )).toBe(true);
    });

    it('bullseye condition: should return false when not in bullseye', () => {
      expect(isAbilityConditionMet(
        { type: 'bullseye' },
        { attacker, inBullseye: false }
      )).toBe(false);
    });

    it('behind_target condition: should return false when no defender provided', () => {
      expect(isAbilityConditionMet(
        { type: 'behind_target' },
        { attacker }
      )).toBe(false);
    });

    it('behind_target condition: true when attacker is directly behind defender', () => {
      // Defender at (0,0) facing up (angle=0). "Behind" = south (y>0)
      const defender = makeShip({ x: 0, y: 0, angle: 0 });
      const behind = makeShip({ x: 0, y: 100 }); // behind in Phaser coords
      expect(isAbilityConditionMet(
        { type: 'behind_target' },
        { attacker: behind, defender }
      )).toBe(true);
    });

    it('behind_target condition: false when attacker is directly in front of defender', () => {
      const defender = makeShip({ x: 0, y: 0, angle: 0 });
      const front = makeShip({ x: 0, y: -100 }); // in front (north)
      expect(isAbilityConditionMet(
        { type: 'behind_target' },
        { attacker: front, defender }
      )).toBe(false);
    });

    it('behind_target condition: true when attacker is within 45° of rear arc', () => {
      // Defender facing up. Rear is south (180°). Attacker at 44° off rear = within arc
      const defender = makeShip({ x: 0, y: 0, angle: 0 });
      // Angle from defender to attacker = 180 + 44 = 224°. sin(224°)*100 ≈ -69, cos(224°)*100 ≈ -72
      const nearRear = makeShip({ x: -69, y: 72 }); // ~224° from defender
      expect(isAbilityConditionMet(
        { type: 'behind_target' },
        { attacker: nearRear, defender }
      )).toBe(true);
    });

    it('behind_target condition: false when attacker is beyond 45° of rear arc', () => {
      // Defender facing up. Rear is south (180°). Attacker at 91° off rear = outside arc
      const defender = makeShip({ x: 0, y: 0, angle: 0 });
      const side = makeShip({ x: 100, y: 0 }); // angle 90° from defender → 90° off rear (180°) = outside ±45°
      expect(isAbilityConditionMet(
        { type: 'behind_target' },
        { attacker: side, defender }
      )).toBe(false);
    });

    it('stressed condition: should return true when attacker is stressed', () => {
      const stressed = makeShip({ isStressed: true });
      expect(isAbilityConditionMet(
        { type: 'stressed' },
        { attacker: stressed }
      )).toBe(true);
    });

    it('stressed condition: should return false when not stressed', () => {
      expect(isAbilityConditionMet(
        { type: 'stressed' },
        { attacker }
      )).toBe(false);
    });

    it('damaged condition: should return true when hull below threshold', () => {
      const damaged = makeShip({ hull: 2, maxHull: 5 }); // hull < maxHull - 1 = 4
      expect(isAbilityConditionMet(
        { type: 'damaged', threshold: 1 },
        { attacker: damaged }
      )).toBe(true);
    });

    it('damaged condition: should return false when hull is above threshold', () => {
      const healthy = makeShip({ hull: 5, maxHull: 5 });
      expect(isAbilityConditionMet(
        { type: 'damaged', threshold: 1 },
        { attacker: healthy }
      )).toBe(false);
    });

    it('outnumbered condition: should return true when no allies', () => {
      expect(isAbilityConditionMet(
        { type: 'outnumbered' },
        { attacker, nearbyAllies: [] }
      )).toBe(true);
    });

    it('outnumbered condition: should return false when allies present', () => {
      const ally = makeShip({ id: 'ally' });
      expect(isAbilityConditionMet(
        { type: 'outnumbered' },
        { attacker, nearbyAllies: [ally] }
      )).toBe(false);
    });

    it('near_ally condition: should return true when ally is within distance', () => {
      const nearAlly = makeShip({ id: 'ally', x: 50, y: 0 });
      expect(isAbilityConditionMet(
        { type: 'near_ally', distance: 100 },
        { attacker, nearbyAllies: [nearAlly] }
      )).toBe(true);
    });

    it('near_ally condition: should return false when ally is too far', () => {
      const farAlly = makeShip({ id: 'ally', x: 200, y: 0 });
      expect(isAbilityConditionMet(
        { type: 'near_ally', distance: 100 },
        { attacker, nearbyAllies: [farAlly] }
      )).toBe(false);
    });

    it('near_ally condition: should return false when no allies', () => {
      expect(isAbilityConditionMet(
        { type: 'near_ally', distance: 100 },
        { attacker }
      )).toBe(false);
    });

    it('should return true for unknown condition type', () => {
      // @ts-expect-error testing unknown condition
      expect(isAbilityConditionMet({ type: 'unknown' }, { attacker })).toBe(true);
    });
  });

  describe('applyPassiveAbilities', () => {
    const ship = makeShip();

    it('should return zero bonuses when no abilities equipped', () => {
      const bonuses = applyPassiveAbilities(ship, []);
      expect(bonuses.hullBonus).toBe(0);
      expect(bonuses.shieldBonus).toBe(0);
      expect(bonuses.agilityBonus).toBe(0);
    });

    it('should add hull bonus from hull_upgrade', () => {
      const bonuses = applyPassiveAbilities(ship, ['hull_upgrade']);
      expect(bonuses.hullBonus).toBe(1);
    });

    it('should add shield bonus from shield_upgrade', () => {
      const bonuses = applyPassiveAbilities(ship, ['shield_upgrade']);
      expect(bonuses.shieldBonus).toBe(1);
    });

    it('should add agility from stealth_device when hull is full', () => {
      const fullHullShip = makeShip({ hull: 5, maxHull: 5 });
      const bonuses = applyPassiveAbilities(fullHullShip, ['stealth_device']);
      expect(bonuses.agilityBonus).toBe(1);
    });

    it('should not add agility from stealth_device when hull is damaged', () => {
      const damagedShip = makeShip({ hull: 3, maxHull: 5 });
      const bonuses = applyPassiveAbilities(damagedShip, ['stealth_device']);
      expect(bonuses.agilityBonus).toBe(0);
    });

    it('should accumulate multiple bonuses', () => {
      const fullHullShip = makeShip({ hull: 5, maxHull: 5 });
      const bonuses = applyPassiveAbilities(fullHullShip, ['hull_upgrade', 'shield_upgrade', 'stealth_device']);
      expect(bonuses.hullBonus).toBe(1);
      expect(bonuses.shieldBonus).toBe(1);
      expect(bonuses.agilityBonus).toBe(1);
    });

    it('should ignore non-passive abilities', () => {
      const bonuses = applyPassiveAbilities(ship, ['marksmanship']); // on_attack trigger
      expect(bonuses.hullBonus).toBe(0);
      expect(bonuses.shieldBonus).toBe(0);
      expect(bonuses.agilityBonus).toBe(0);
    });

    it('should ignore unknown ability IDs', () => {
      const bonuses = applyPassiveAbilities(ship, ['nonexistent_ability']);
      expect(bonuses.hullBonus).toBe(0);
    });
  });

  describe('new abilities coverage', () => {
    // Verify all newly-added ability IDs exist and have correct structure

    const newIds = [
      'fearless', 'dead_eye', 'heavy_gunner', 'marksman', 'bombardier',
      'stalwart', 'phantom_strike', 'prescience',
      'coordinated_assault', 'inspiring_presence', 'shield_transfer',
      'healing_aura', 'force_heal', 'force_guidance', 'networked_aim', 'informant',
      'hive_mind', 'force_push',
    ] as const;

    for (const id of newIds) {
      it(`should define ability "${id}"`, () => {
        const ability = PILOT_ABILITIES[id];
        expect(ability).toBeDefined();
        expect(ability.id).toBe(id);
        expect(ability.name.length).toBeGreaterThan(0);
        expect(ability.pointCost).toBeGreaterThan(0);
        expect(ability.xpCost).toBeGreaterThan(0);
      });
    }

    it('faction-gated: stalwart requires ascendant_empire', () => {
      const ability = PILOT_ABILITIES['stalwart']!;
      expect(ability.requiredFaction).toBe('ascendant_empire');
      const denied = canEquipAbility(ability, { faction: 'void_corsairs', role: 'heavy_fighter', pilotSkill: 6 }, []);
      expect(denied.valid).toBe(false);
      const allowed = canEquipAbility(ability, { faction: 'ascendant_empire', role: 'heavy_fighter', pilotSkill: 6 }, []);
      expect(allowed.valid).toBe(true);
    });

    it('faction-gated: phantom_strike requires void_corsairs', () => {
      expect(PILOT_ABILITIES['phantom_strike']!.requiredFaction).toBe('void_corsairs');
    });

    it('faction-gated: force_* abilities require ascendant_empire', () => {
      expect(PILOT_ABILITIES['force_heal']!.requiredFaction).toBe('ascendant_empire');
      expect(PILOT_ABILITIES['force_guidance']!.requiredFaction).toBe('ascendant_empire');
      expect(PILOT_ABILITIES['force_push']!.requiredFaction).toBe('ascendant_empire');
      expect(PILOT_ABILITIES['healing_aura']!.requiredFaction).toBe('ascendant_empire');
    });

    it('faction-gated: synth abilities require synthetic_collective', () => {
      expect(PILOT_ABILITIES['hive_mind']!.requiredFaction).toBe('synthetic_collective');
      expect(PILOT_ABILITIES['networked_aim']!.requiredFaction).toBe('synthetic_collective');
    });

    it('skill-gated: prescience requires pilotSkill 4', () => {
      const ability = PILOT_ABILITIES['prescience']!;
      const denied = canEquipAbility(ability, { faction: 'ascendant_empire', role: 'heavy_fighter', pilotSkill: 3 }, []);
      expect(denied.valid).toBe(false);
      const allowed = canEquipAbility(ability, { faction: 'ascendant_empire', role: 'heavy_fighter', pilotSkill: 4 }, []);
      expect(allowed.valid).toBe(true);
    });

    it('fearless should have stressed condition', () => {
      expect(PILOT_ABILITIES['fearless']!.effects.condition?.type).toBe('stressed');
    });

    it('dead_eye should have bullseye condition', () => {
      expect(PILOT_ABILITIES['dead_eye']!.effects.condition?.type).toBe('bullseye');
    });

    it('heavy_gunner should have range 1 condition', () => {
      expect(PILOT_ABILITIES['heavy_gunner']!.effects.condition?.type).toBe('range');
    });

    it('marksman should convert focus to hit', () => {
      expect(PILOT_ABILITIES['marksman']!.effects.convertFocusToHit).toBeGreaterThan(0);
    });

    it('informant should have no faction restriction', () => {
      expect(PILOT_ABILITIES['informant']!.requiredFaction).toBeUndefined();
    });

    it('total PILOT_ABILITIES count should include all new entries', () => {
      const allIds = Object.keys(PILOT_ABILITIES);
      for (const id of newIds) {
        expect(allIds).toContain(id);
      }
    });
  });
});

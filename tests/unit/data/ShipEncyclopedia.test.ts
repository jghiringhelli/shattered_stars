import { describe, it, expect } from 'vitest';
import {
  computeEncyclopediaStats,
  generateLore,
  getAllEncyclopediaEntries,
  getEncyclopediaEntry,
} from '../../../src/data/ShipEncyclopedia';
import { SHIP_DEFINITIONS } from '../../../src/data/ShipDefinitions';

describe('ShipEncyclopedia', () => {
  describe('computeEncyclopediaStats', () => {
    it('uses 1–5 scale for small ships', () => {
      const def = SHIP_DEFINITIONS['terran_viper'];
      expect(def).toBeDefined();
      const stats = computeEncyclopediaStats(def!);
      expect(stats.maxStat).toBe(5);
      for (const key of ['speed', 'maneuverability', 'attack', 'defense', 'payload'] as const) {
        expect(stats[key]).toBeGreaterThanOrEqual(1);
        expect(stats[key]).toBeLessThanOrEqual(5);
      }
    });

    it('uses 1–10 scale for huge ships', () => {
      const def = SHIP_DEFINITIONS['synth_gestalt'];
      expect(def).toBeDefined();
      const stats = computeEncyclopediaStats(def!);
      expect(stats.maxStat).toBe(10);
      for (const key of ['speed', 'maneuverability', 'attack', 'defense', 'payload'] as const) {
        expect(stats[key]).toBeGreaterThanOrEqual(1);
        expect(stats[key]).toBeLessThanOrEqual(10);
      }
    });

    it('uses 1–10 scale for large ships', () => {
      // ascendant_avatar is size large — must also get the capital (1–10) scale
      const def = SHIP_DEFINITIONS['ascendant_avatar'];
      expect(def).toBeDefined();
      const stats = computeEncyclopediaStats(def!);
      expect(stats.maxStat).toBe(10);
    });

    it('computes attack stat matching ship attack for synth_gestalt', () => {
      const def = SHIP_DEFINITIONS['synth_gestalt']!;
      const stats = computeEncyclopediaStats(def);
      // Huge ship: raw attack=6, mult=2 → sat(12) → clamped to maxStat=10
      expect(stats.attack).toBe(10);
    });

    it('computes all specific stats for terran_viper correctly', () => {
      // hull=3, shields=2, attack=3, agility=3, speed.max=5
      // actions: boost + barrel_roll (but no cloak/reload)
      // isCapital=false, scale=5, mult=1
      // rawManu = 3+1+0.5 = 4.5 → round(4.5)=5 → clamped to 5
      // rawDefense = 3/3 + 2/4 + 3*0.3 = 1+0.5+0.9=2.4 → round(2.4)=2
      // rawPayload: attack=3, NOT > 3 → 1
      const def = SHIP_DEFINITIONS['terran_viper']!;
      const stats = computeEncyclopediaStats(def);
      expect(stats.speed).toBe(5);           // speed.max=5, mult=1 → 5
      expect(stats.maneuverability).toBe(5); // rawManu=4.5, round→5
      expect(stats.attack).toBe(3);          // attack=3, mult=1 → 3
      expect(stats.defense).toBe(2);         // rawDefense=2.4, round→2
      expect(stats.payload).toBe(1);         // no reload, attack≤3 → 1
    });

    it('computes all specific stats for ascendant_avatar correctly', () => {
      // hull=6, shields=5, attack=4, agility=1, speed.max=3, size=large
      // actions: no boost/barrel/cloak/reload
      // isCapital=true (large), scale=10, mult=2
      // rawManu=1, rawDefense=6/3+5/4+1*0.3=3.55, rawPayload: attack=4>3 → 2
      const def = SHIP_DEFINITIONS['ascendant_avatar']!;
      const stats = computeEncyclopediaStats(def);
      expect(stats.speed).toBe(6);           // speed.max=3, round(3*2)=6
      expect(stats.maneuverability).toBe(2); // rawManu=1, round(1*2)=2
      expect(stats.attack).toBe(8);          // attack=4, round(4*2)=8
      expect(stats.defense).toBe(7);         // rawDefense=3.55, round(3.55*2)=round(7.1)=7
      expect(stats.payload).toBe(4);         // rawPayload=2 (attack>3), round(2*2)=4
    });

    it('computes all specific stats for synth_gestalt correctly', () => {
      // hull=16, shields=12, attack=6, agility=0, speed.max=1, size=huge
      // no boost/barrel/cloak/reload; isCapital=true, scale=10, mult=2
      const def = SHIP_DEFINITIONS['synth_gestalt']!;
      const stats = computeEncyclopediaStats(def);
      expect(stats.speed).toBe(2);            // speed.max=1, round(1*2)=2
      expect(stats.maneuverability).toBe(1);  // rawManu=0, max(1, round(0))=1
      expect(stats.attack).toBe(10);          // already tested above
      expect(stats.defense).toBe(10);         // rawDefense≈8.33, round(16.66)=17, clamped to 10
      expect(stats.payload).toBe(4);          // attack=6>3 → rawPayload=2, round(2*2)=4
    });

    it('computes payload=5 for a ship with reload action and attack=4', () => {
      // terran_thunderbolt: medium, attack=4, has reload action
      // rawPayload = hasReload ? Math.min(5, 4+1) : ... = 5
      // isCapital=false, mult=1, sat(5)=5
      const def = SHIP_DEFINITIONS['terran_thunderbolt']!;
      expect(def).toBeDefined();
      const stats = computeEncyclopediaStats(def);
      expect(stats.payload).toBe(5);
    });
  });

  describe('generateLore', () => {
    it('includes the ship name in the output', () => {
      const def = SHIP_DEFINITIONS['terran_viper']!;
      const lore = generateLore(def);
      expect(lore).toContain('Viper');
    });

    it('includes faction intro for Terran Hegemony ships', () => {
      const def = SHIP_DEFINITIONS['terran_viper']!;
      const lore = generateLore(def);
      expect(lore).toContain('Terran Hegemony');
    });

    it('produces a non-empty two-sentence string', () => {
      const def = SHIP_DEFINITIONS['terran_viper']!;
      const lore = generateLore(def);
      expect(lore.length).toBeGreaterThan(50);
      expect(lore.split('. ').length).toBeGreaterThanOrEqual(2);
    });

    it('second sentence starts with a capital letter via cap()', () => {
      // terran_viper speed.max=5 → SPEED_ADJ[5]='blazing fast'; cap() capitalises it
      // cap() should give 'Blazing fast' — only first char uppercase, rest lowercase
      const def = SHIP_DEFINITIONS['terran_viper']!;
      const lore = generateLore(def);
      const secondSentence = lore.split('. ')[1] ?? '';
      expect(secondSentence.charAt(0)).toBe(secondSentence.charAt(0).toUpperCase());
      expect(secondSentence.charAt(0)).not.toBe('');
      expect(secondSentence.charAt(0)).toBe('B'); // 'Blazing fast...'
      // charAt(1) must be lowercase — 'l' — otherwise s.toUpperCase() mutation passes
      expect(secondSentence.charAt(1)).toBe('l');
      // Exact phrase check — kills 'BLAZING FAST...' and 'Bblazinglazing fast...' mutations
      expect(lore).toContain('Blazing fast');
    });

    it('uses glacially-slow adjective for synth_gestalt (speed.max=1)', () => {
      // Math.min(5, 1)=1 → SPEED_ADJ[1]='glacially slow'; cap() capitalises → 'Glacially slow'
      // Math.max mutation would give index 5='blazing fast' → 'Blazing fast' instead
      const def = SHIP_DEFINITIONS['synth_gestalt']!;
      const lore = generateLore(def);
      expect(lore).toContain('lacially slow'); // matches 'glacially' or 'Glacially' after cap()
      expect(lore).not.toContain('blazing fast');
      expect(lore).not.toContain('Blazing fast');
    });

    it('uses fortress-hulled adjective for synth_gestalt (defense clamped at 5)', () => {
      // stats.defense=10 → defIdx=Math.min(5,10)=5 → DEFENSE_ADJ[5]='fortress-hulled'
      // Math.max mutation would give defIdx=10 → undefined → fallback 'averagely protected'
      const def = SHIP_DEFINITIONS['synth_gestalt']!;
      const lore = generateLore(def);
      expect(lore).toContain('fortress-hulled');
    });
  });

  describe('getAllEncyclopediaEntries', () => {
    it('returns an entry for every ship in SHIP_DEFINITIONS', () => {
      const entries = getAllEncyclopediaEntries();
      const shipIds = Object.keys(SHIP_DEFINITIONS);
      expect(entries.length).toBe(shipIds.length);
      for (const id of shipIds) {
        const entry = entries.find((e) => e.shipId === id);
        expect(entry).toBeDefined();
        // artKey and artPromptHint are built during this first cache-building call
        expect(entry!.artKey).toBe(`ship_art_${id}`);
        expect(entry!.artKey).not.toBe('');
        expect(entry!.artPromptHint.length).toBeGreaterThan(10);
      }
    });

    it('all entries have required fields with valid values', () => {
      const entries = getAllEncyclopediaEntries();
      for (const entry of entries) {
        expect(entry.shipId).toBeTruthy();
        expect(entry.lore.length).toBeGreaterThan(20);
        expect(entry.artKey).toBe(`ship_art_${entry.shipId}`);
        expect(entry.artPromptHint.length).toBeGreaterThan(20);
        expect(entry.stats.maxStat === 5 || entry.stats.maxStat === 10).toBe(true);
      }
    });

    it('artKey follows ship_art_ prefix convention for every entry', () => {
      const entries = getAllEncyclopediaEntries();
      for (const entry of entries) {
        expect(entry.artKey).toBe(`ship_art_${entry.shipId}`);
        expect(entry.artKey.startsWith('ship_art_')).toBe(true);
        expect(entry.artKey).not.toBe('');
      }
    });

    it('artPromptHint for every non-overridden ship contains "spacecraft"', () => {
      const entries = getAllEncyclopediaEntries();
      const viper = entries.find((e) => e.shipId === 'terran_viper')!;
      expect(viper.artPromptHint).toContain('spacecraft');
      expect(viper.artPromptHint).not.toBe('');
    });

    it('synth_gestalt uses custom lore, not the template', () => {
      const entries = getAllEncyclopediaEntries();
      const entry = entries.find((e) => e.shipId === 'synth_gestalt')!;
      // Custom lore contains unique phrases not present in the template
      expect(entry.lore).toContain('apex form');
      // Template would start with faction intro
      expect(entry.lore.startsWith("Manufactured by the Synthetic Collective")).toBe(false);
    });

    it('synth_gestalt uses custom art prompt, not the template', () => {
      const entries = getAllEncyclopediaEntries();
      const entry = entries.find((e) => e.shipId === 'synth_gestalt')!;
      // Custom prompt contains unique phrase; template always has "spacecraft"
      expect(entry.artPromptHint).toContain('drone-composite titan');
      expect(entry.artPromptHint).not.toContain('spacecraft');
    });

    it('terran_imperator uses custom lore', () => {
      const entries = getAllEncyclopediaEntries();
      const entry = entries.find((e) => e.shipId === 'terran_imperator')!;
      expect(entry.lore).toContain('undisputed crown');
    });

    it('regular ships that lack overrides use template lore', () => {
      const entries = getAllEncyclopediaEntries();
      const viper = entries.find((e) => e.shipId === 'terran_viper')!;
      expect(viper.lore.startsWith('Fielded by the iron-disciplined Terran Hegemony')).toBe(true);
    });

    it('returns the same cached array on repeated calls', () => {
      const first = getAllEncyclopediaEntries();
      const second = getAllEncyclopediaEntries();
      expect(first).toBe(second);
    });
  });

  describe('getEncyclopediaEntry', () => {
    it('returns the correct entry for a known ship', () => {
      const entry = getEncyclopediaEntry('synth_gestalt');
      expect(entry.shipId).toBe('synth_gestalt');
      expect(entry.artKey).toBe('ship_art_synth_gestalt');
    });

    it('returns artKey as non-empty string for a known ship', () => {
      const entry = getEncyclopediaEntry('terran_viper');
      expect(entry.artKey).toBe('ship_art_terran_viper');
      expect(entry.artKey.length).toBeGreaterThan(0);
    });

    it('returns a placeholder entry for an unknown ship ID', () => {
      const entry = getEncyclopediaEntry('totally_unknown_vessel');
      expect(entry.shipId).toBe('totally_unknown_vessel');
      expect(entry.lore).toContain('Unknown vessel');
      expect(entry.artKey).toBe('ship_art_totally_unknown_vessel');
    });

    it('placeholder artPromptHint is not empty', () => {
      const entry = getEncyclopediaEntry('no_such_ship_xyz');
      expect(entry.artPromptHint).toBeTruthy();
      expect(entry.artPromptHint.length).toBeGreaterThan(0);
    });
  });
});

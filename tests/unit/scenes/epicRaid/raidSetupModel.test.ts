import { describe, expect, it } from "vitest";
import {
  BOSS_ABILITY_LINES,
  RAID_DIFFICULTY_LINES,
  bossKeyNumbers,
  bossSectionLines,
} from "../../../../src/scenes/epicRaid/raidSetupModel";
import {
  BOSS_DEFINITIONS,
  RAID_DIFFICULTIES,
  raidIntelLines,
} from "../../../../src/scenes/epicRaid/bossDefinitions";

describe("bossKeyNumbers", () => {
  it("matches the numbers of the intel line the old screen showed", () => {
    const numbers = bossKeyNumbers("terran_hegemony", "medium");
    const line = raidIntelLines("terran_hegemony", "medium")[0]!;
    expect(line).toContain(`Hull ${numbers.hull}`);
    expect(line).toContain(`Shields ${numbers.shields}`);
    expect(numbers.armor).toBe(BOSS_DEFINITIONS.terran_hegemony.armor);
  });

  it("scales hull and shields with the difficulty", () => {
    const easy = bossKeyNumbers("terran_hegemony", "easy");
    const mythic = bossKeyNumbers("terran_hegemony", "mythic");
    expect(mythic.hull).toBeGreaterThan(easy.hull);
    expect(mythic.shields).toBeGreaterThan(easy.shields);
  });
});

describe("bossSectionLines", () => {
  it("names every section with its hull and what it does", () => {
    const lines = bossSectionLines("terran_hegemony", "medium");
    expect(lines).toHaveLength(BOSS_DEFINITIONS.terran_hegemony.sections.length);
    expect(lines[0]).toContain("Fore");
    expect(lines[0]).toContain("guns");
    expect(lines[0]).toContain("shield");
  });

  it("states each section's hull at the chosen difficulty", () => {
    const easy = bossSectionLines("free_confederation", "easy");
    const mythic = bossSectionLines("free_confederation", "mythic");
    expect(easy[1]).toContain("Mid");
    expect(easy[1]).not.toBe(mythic[1]);
  });
});

describe("texts", () => {
  it("explains every raid difficulty", () => {
    for (const option of RAID_DIFFICULTIES) {
      expect(RAID_DIFFICULTY_LINES[option.id].length).toBeGreaterThan(30);
    }
  });

  it("lists the boss abilities with a plain description each", () => {
    expect(BOSS_ABILITY_LINES.map((a) => a.name)).toEqual([
      "BROADSIDE",
      "FIGHTER LAUNCH",
      "SHIELD REGENERATION",
    ]);
    for (const ability of BOSS_ABILITY_LINES) {
      expect(ability.line.length).toBeGreaterThan(30);
    }
  });
});

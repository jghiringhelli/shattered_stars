/**
 * raidSetupModel — the numbers and plain-language lines of the Boss Raid
 * setup: the boss's key numbers at a difficulty, what each section does, the
 * boss abilities and one sentence per difficulty. Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import type { EpicDifficulty } from "../../arcade/systems/EpicAiFlight";
import { bossDurability } from "../../arcade/systems/EpicRaidCombat";
import {
  BOSS_BROADSIDE_RANGE_PX,
  BOSS_DEFINITIONS,
  raidDifficultyMultiplier,
} from "./bossDefinitions";

/** The boss numbers shown on the target card. */
export interface BossKeyNumbers {
  readonly hull: number;
  readonly shields: number;
  readonly armor: number;
}

/**
 * @param faction - The boss's faction.
 * @param difficulty - Raid difficulty.
 * @returns Real-time hull and shields at that difficulty, and the flat armor.
 */
export function bossKeyNumbers(
  faction: FactionId,
  difficulty: EpicDifficulty,
): BossKeyNumbers {
  const boss = BOSS_DEFINITIONS[faction];
  const multiplier = raidDifficultyMultiplier(difficulty);
  return {
    hull: boss.sections.reduce(
      (sum, section) => sum + bossDurability(section.hull, multiplier),
      0,
    ),
    shields: bossDurability(boss.shields, multiplier),
    armor: boss.armor,
  };
}

/**
 * @param faction - The boss's faction.
 * @param difficulty - Raid difficulty.
 * @returns One line per section: name, hull and whether it carries guns or shields.
 */
export function bossSectionLines(
  faction: FactionId,
  difficulty: EpicDifficulty,
): string[] {
  const multiplier = raidDifficultyMultiplier(difficulty);
  return BOSS_DEFINITIONS[faction].sections.map((section) => {
    const roles = [
      ...(section.weapons ? ["guns"] : []),
      ...(section.shields ? ["shield generator"] : []),
    ];
    const role = roles.length > 0 ? roles.join(" + ") : "armour only";
    return `${section.name} \u00b7 hull ${bossDurability(section.hull, multiplier)} \u00b7 ${role}`;
  });
}

/** One boss ability in plain words. */
export interface BossAbilityLine {
  readonly name: string;
  readonly line: string;
}

/** What the boss does during the fight. */
export const BOSS_ABILITY_LINES: readonly BossAbilityLine[] = [
  {
    name: "BROADSIDE",
    line: `Every ship within ${BOSS_BROADSIDE_RANGE_PX} px of the hull is hit at once. Strafe and leave.`,
  },
  {
    name: "FIGHTER LAUNCH",
    line: "Calls a new wave of escort fighters. Clear them or they pin your wing down.",
  },
  {
    name: "SHIELD REGENERATION",
    line: "Restores part of the boss shields. Focus fire one section so the damage sticks.",
  },
];

/** One sentence per raid difficulty. */
export const RAID_DIFFICULTY_LINES: Readonly<Record<EpicDifficulty, string>> = {
  easy: "Easy: the boss has 75% of its normal hull and shields. A forgiving first assault.",
  medium: "Medium: the boss at its published hull and shields. The intended fight.",
  hard: "Hard: 150% hull and shields, so the fight lasts longer and mistakes cost more.",
  mythic: "Mythic: double hull and shields. Only a coordinated wing with ordnance wins.",
};

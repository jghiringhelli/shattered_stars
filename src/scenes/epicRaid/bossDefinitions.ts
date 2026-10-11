/**
 * Boss Raid catalogue — the capital ship each faction fields as a raid boss,
 * in catalogue points (scaled to real-time HP by bossDurability), plus the
 * raid's difficulty presets and the boss's ability tuning.
 */

import type { FactionId } from "../../config";
import type { EpicDifficulty } from "../../arcade/systems/EpicAiFlight";
import { bossDurability } from "../../arcade/systems/EpicRaidCombat";

/** One damageable section of a boss hull. */
export interface BossSectionDefinition {
  readonly name: string;
  /** Section hull in catalogue points. */
  readonly hull: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly weapons: boolean;
  readonly shields: boolean;
}

/** A faction's raid boss, in catalogue points. */
export interface BossDefinition {
  readonly name: string;
  /** Sum of the section hulls, in catalogue points. */
  readonly totalHull: number;
  /** Shields in catalogue points. */
  readonly shields: number;
  /** Flat damage reduction applied to every incoming hit before shields/hull. */
  readonly armor: number;
  readonly sections: readonly BossSectionDefinition[];
  readonly escortCount: number;
}

/** Each faction's raid boss. */
export const BOSS_DEFINITIONS: Readonly<Record<FactionId, BossDefinition>> = {
  terran_hegemony: {
    name: "Hegemony Battlecruiser",
    totalHull: 180,
    shields: 40,
    armor: 3,
    sections: [
      {
        name: "Fore",
        hull: 90,
        offsetX: 0,
        offsetY: -40,
        weapons: true,
        shields: true,
      },
      {
        name: "Aft",
        hull: 90,
        offsetX: 0,
        offsetY: 40,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 6,
  },
  free_confederation: {
    name: "Freedom Corvette",
    totalHull: 150,
    shields: 30,
    armor: 3,
    sections: [
      {
        name: "Fore",
        hull: 50,
        offsetX: 0,
        offsetY: -30,
        weapons: true,
        shields: false,
      },
      {
        name: "Mid",
        hull: 50,
        offsetX: 0,
        offsetY: 0,
        weapons: false,
        shields: true,
      },
      {
        name: "Aft",
        hull: 50,
        offsetX: 0,
        offsetY: 30,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 4,
  },
  synthetic_collective: {
    name: "Collective Mothership",
    totalHull: 140,
    shields: 50,
    armor: 3,
    sections: [
      {
        name: "Core",
        hull: 80,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: true,
      },
      {
        name: "Shell",
        hull: 60,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 10,
  },
  void_corsairs: {
    name: "Pirate Mothership",
    totalHull: 140,
    shields: 25,
    armor: 3,
    sections: [
      {
        name: "Weapons Bay",
        hull: 70,
        offsetX: -30,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
      {
        name: "Engines",
        hull: 70,
        offsetX: 30,
        offsetY: 0,
        weapons: false,
        shields: true,
      },
    ],
    escortCount: 5,
  },
  ascendant_empire: {
    name: "Ascendant Dreadnought",
    totalHull: 200,
    shields: 60,
    armor: 3,
    sections: [
      {
        name: "Bio Core",
        hull: 80,
        offsetX: 0,
        offsetY: -30,
        weapons: false,
        shields: true,
      },
      {
        name: "Psionic Array",
        hull: 60,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
      {
        name: "Heart",
        hull: 60,
        offsetX: 0,
        offsetY: 30,
        weapons: true,
        shields: true,
      },
    ],
    escortCount: 4,
  },
};

/** Factions in the order the setup screen lists their bosses. */
export const BOSS_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** A raid difficulty preset. */
export interface RaidDifficultyOption {
  readonly id: EpicDifficulty;
  readonly name: string;
  /** Boss hull/shield multiplier. */
  readonly multiplier: number;
}

/** Difficulty presets, easiest first. */
export const RAID_DIFFICULTIES: readonly RaidDifficultyOption[] = [
  { id: "easy", name: "Easy", multiplier: 0.75 },
  { id: "medium", name: "Medium", multiplier: 1 },
  { id: "hard", name: "Hard", multiplier: 1.5 },
  { id: "mythic", name: "Mythic", multiplier: 2 },
];

/**
 * @param difficulty - Raid difficulty.
 * @returns The boss hull/shield multiplier for it (1 when unknown).
 */
export function raidDifficultyMultiplier(difficulty: EpicDifficulty): number {
  return RAID_DIFFICULTIES.find((d) => d.id === difficulty)?.multiplier ?? 1;
}

/** Shield points (rules) the boss's Shield Regeneration restores; scaled by bossRegenPoints. */
export const BOSS_SHIELD_REGEN_POINTS = 10;
/** Broadside reach (px): every player ship this close is hit. */
export const BOSS_BROADSIDE_RANGE_PX = 400;

/** Boss ability timers in the catalogue (ms); scaled by bossTempoMs. */
export const BOSS_ABILITY_BASE_MS = {
  /** How often the boss picks an ability. */
  tick: 5_000,
  broadside: 8_000,
  launchFighters: 15_000,
  shieldRegen: 12_000,
} as const;

/**
 * @param bossFaction - The chosen boss.
 * @param difficulty - The chosen difficulty.
 * @returns The intel panel's lines (real-time hull and shields).
 */
export function raidIntelLines(
  bossFaction: FactionId,
  difficulty: EpicDifficulty,
): string[] {
  const boss = BOSS_DEFINITIONS[bossFaction];
  const multiplier = raidDifficultyMultiplier(difficulty);
  const hull = boss.sections.reduce(
    (sum, s) => sum + bossDurability(s.hull, multiplier),
    0,
  );
  return [
    `Hull ${hull}  ·  Shields ${bossDurability(boss.shields, multiplier)}  ·  Armor ${boss.armor}`,
    `Sections: ${boss.sections.map((s) => s.name).join(", ")}`,
    `Escorts: ${boss.escortCount} fighters`,
  ];
}

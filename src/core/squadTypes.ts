/**
 * Squad Builder data types.
 * Defines the team/squad/ship hierarchy used by SquadBuilderScene and battle scenes.
 */

import type { FactionId } from '../config';
import type { AIDifficultyLevel } from '../ai/AIDifficulty';

export type GameMode =
  | 'arcade'
  | 'turn_based'
  | 'continuous'
  | 'survival'
  | 'online'
  | 'epic';

/** A single squad — one faction's ships, controlled by one player or AI */
export interface SquadEntry {
  factionId: FactionId | null;
  controller: 'player' | 'ai';
  ships: string[];
  /** loadoutId keyed by shipId — chosen via ShipPickerScene */
  loadoutChoices: Record<string, string>;
  pointsUsed: number;
}

/** A team groups one or more squads fighting on the same side */
export interface TeamEntry {
  readonly id: string;
  readonly color: number;
  readonly label: string;
  squads: SquadEntry[];
}

/** Full battle setup written to registry and consumed by battle scenes */
export interface BattleConfig {
  factions: Array<{
    factionId: FactionId | null;
    controller: 'player' | 'ai';
    ships: string[];
    loadoutChoices: Record<string, string>;
    teamId: string;
  }>;
  gameMode: GameMode;
  pointLimit: number;
  aiDifficulty: AIDifficultyLevel;
}

export type FormatPresetId = '1v1' | '2v2' | '3v3' | 'ffa3' | 'ffa4' | '2v1' | '3v1';

export interface FormatPreset {
  readonly id: FormatPresetId;
  readonly label: string;
  /** Number of squads per team, one entry per team */
  readonly squadsPerTeam: readonly number[];
}

export const FORMAT_PRESETS: readonly FormatPreset[] = [
  { id: '1v1',  label: '1v1',   squadsPerTeam: [1, 1] },
  { id: '2v2',  label: '2v2',   squadsPerTeam: [2, 2] },
  { id: '3v3',  label: '3v3',   squadsPerTeam: [3, 3] },
  { id: 'ffa3', label: 'FFA 3', squadsPerTeam: [1, 1, 1] },
  { id: 'ffa4', label: 'FFA 4', squadsPerTeam: [1, 1, 1, 1] },
  { id: '2v1',  label: '2v1',   squadsPerTeam: [2, 1] },
  { id: '3v1',  label: '3v1',   squadsPerTeam: [3, 1] },
];

export const TEAM_COLORS: readonly number[] = [0x2255cc, 0xcc3322, 0x22aa44, 0xcc8822];
export const TEAM_LABELS: readonly string[] = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

/** Modes that allow the player to configure team structure */
export const MULTI_TEAM_MODES: readonly GameMode[] = [
  'arcade', 'turn_based', 'continuous', 'epic',
];

const ALL_FACTIONS: FactionId[] = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
];

/** Create a blank squad entry, cycling through factions to avoid duplicates */
export function makeSquad(
  index: number,
  controller: 'player' | 'ai',
): SquadEntry {
  return {
    factionId: ALL_FACTIONS[index % ALL_FACTIONS.length] as FactionId,
    controller,
    ships: [],
    loadoutChoices: {},
    pointsUsed: 0,
  };
}

/** Create a TeamEntry at the given index with the given squads */
export function makeTeam(index: number, squads: SquadEntry[]): TeamEntry {
  return {
    id: `team_${index}`,
    color: TEAM_COLORS[index] ?? 0x446688,
    label: TEAM_LABELS[index] ?? `${index + 1}`,
    squads,
  };
}

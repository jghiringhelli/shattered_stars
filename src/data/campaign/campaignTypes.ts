/**
 * campaignTypes — shapes of the faction campaigns: five factions × 15
 * mission slots in three acts (78 mission definitions — Hegemony has three
 * branch pairs, at slots 3, 8 and 13). A mission is story + squad + enemies
 * + rewards (missions/*) merged with its design (designs/*): objective
 * geometry, scripted beats, hazards, allies, variants and hub prerequisites.
 *
 * Authored positions (objectives, scripts, hazards, allies) are offsets in
 * px from the battlefield centre; the mission compiler resolves them.
 */

import type { FactionId } from "../../config";
import type { ObjectiveDefinition } from "../../arcade/objectives";
import type {
  DialogueMood,
  FlagCondition,
  ScriptBeat,
} from "../../campaign/scripting/scriptTypes";
import type { HazardDefinition } from "../../campaign/hazards/hazardTypes";

/** A v1 objective: a kind, a description and loose hints (normalised at launch). */
export interface LegacyObjective {
  id: string;
  type:
    "eliminate" | "survive" | "escort" | "capture" | "defend" | "assassinate";
  description: string;
  target?: string;
  count?: number;
  timeLimit?: number; // seconds
  optional?: boolean;
  xpBonus?: number;
}

/** Any authored objective. */
export type MissionObjective = ObjectiveDefinition | LegacyObjective;

export interface MissionEnemy {
  shipId: string;
  count: number;
  faction: FactionId;
  isAce?: boolean;
  isBoss?: boolean;
  spawnDelay?: number; // ms
  /** Hull and shield scale of this group (per-mission difficulty knob; default 1). */
  hullScale?: number;
}

export interface MissionReward {
  xp: number;
  credits: number;
  unlocks?: string[]; // ship IDs or upgrade IDs
}

export interface DebriefLine {
  readonly speaker: string; // e.g. "ADMIRAL CHEN"
  readonly portraitKey: string; // Phaser texture key
  readonly text: string; // max ~140 chars
  readonly mood?: DialogueMood;
}

export interface EvolutionOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keepCurrentShip: boolean;
  readonly newShipId?: string;
  readonly statBonuses: {
    hull?: number;
    shields?: number;
    attack?: number;
    agility?: number;
  };
  readonly grantAbilityId: string;
  readonly flavorText: string;
}

export interface EvolutionChoiceData {
  readonly triggerMissionId: string;
  readonly promptText: string;
  readonly optionA: EvolutionOption;
  readonly optionB: EvolutionOption;
}

/** The kind of mission, for the hub's mission cards. */
export type MissionStyle =
  | "training"
  | "assault"
  | "escort"
  | "defense"
  | "heist"
  | "salvage"
  | "assassination"
  | "stealth"
  | "hazard"
  | "race"
  | "boss";

/** An allied AI squadron flying with the player. */
export interface MissionAlly {
  readonly shipId: string;
  readonly count: number;
  /** Tag scripts use (e.g. "lance" → a "lance lost" story flag). */
  readonly tag: string;
  readonly name: string;
  /** Not deployed while this story flag is set (a lost squadron stays gone). */
  readonly unlessFlag?: string;
  /** Coalition only: not deployed when the player leads this faction. */
  readonly unlessLead?: FactionId;
}

/** A story-flag-driven variant of a mission. */
export interface MissionVariant {
  readonly when: FlagCondition;
  readonly title?: string;
  readonly tagline?: string;
  readonly briefing?: string;
  readonly addEnemies?: readonly MissionEnemy[];
  readonly addAllies?: readonly MissionAlly[];
  /** Beats appended to the mission script. */
  readonly script?: readonly ScriptBeat[];
  /** Replaces the mission's objectives. */
  readonly objectives?: readonly MissionObjective[];
}

/** Everything a design file adds to a mission. */
export interface MissionDesign {
  readonly style?: MissionStyle;
  /** Terse, mood-setting hub briefing line. */
  readonly tagline?: string;
  readonly mood?: DialogueMood;
  /** Replaces the legacy objectives. */
  readonly objectives?: MissionObjective[];
  readonly script?: readonly ScriptBeat[];
  readonly hazards?: readonly HazardDefinition[];
  readonly allies?: readonly MissionAlly[];
  readonly variants?: readonly MissionVariant[];
  /** Mission slots (missionNumber) that must be done first (default: act rules). */
  readonly prerequisites?: readonly number[];
  /** Story flags set when the mission is won. */
  readonly victoryFlags?: Readonly<Record<string, boolean>>;
  /** Story day of the crisis the mission takes place on (0 = the Broadcast). */
  readonly day?: number;
  /** Where it takes place (shown on the briefing). */
  readonly location?: string;
  /** Crossover battle id ("X1".."X15") this mission is one witness of. */
  readonly crossover?: string;
}

export interface CampaignMission extends MissionDesign {
  id: string;
  act: 1 | 2 | 3 | 4 | 5;
  missionNumber: number;
  title: string;
  briefing: string;
  objectives: MissionObjective[];
  playerShips: string[]; // Available ship IDs
  maxSquadSize: number;
  enemies: MissionEnemy[];
  rewards: MissionReward;
  newMechanic?: string;
  isUnlocked?: boolean;
  debrief?: readonly DebriefLine[];
  evolutionChoice?: EvolutionChoiceData;
  /** If true, this mission is one option in a branch pair sharing the same missionNumber */
  isBranch?: boolean;
  /** Short tag shown on the branch choice card (e.g. "AGGRESSIVE" | "COVERT") */
  branchTag?: string;
}

export interface FactionCampaign {
  factionId: FactionId;
  name: string;
  description: string;
  protagonist: string;
  missions: CampaignMission[];
}

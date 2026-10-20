/**
 * scriptTypes — the declarative mission-script language: beats pair a
 * trigger (start, time, objective state, ship destroyed, area entered, flag)
 * and optional flag conditions with a list of actions (dialogue, spawns,
 * objective changes, flags, hazards, music, banners). Mission data authors
 * beats; ScriptInterpreter runs them. Plain data.
 *
 * Positions are world pixels once a mission is compiled (authors write
 * offsets from the battlefield centre; see src/campaign/mission).
 */

import type {
  ObjectiveDefinition,
  ObjectivePoint,
  ObjectiveSide,
  ObjectiveStatus,
} from "../../arcade/objectives";

/** When a beat fires. */
export type ScriptTrigger =
  | { readonly on: "start" }
  | { readonly on: "time"; readonly atSeconds: number }
  | {
      readonly on: "objective";
      readonly objectiveId: string;
      readonly status: ObjectiveStatus | "revealed";
    }
  | {
      readonly on: "destroyed";
      readonly tag?: string;
      readonly side?: ObjectiveSide;
      /** Matching destructions needed (default 1). */
      readonly count?: number;
    }
  | {
      readonly on: "area";
      readonly at: ObjectivePoint;
      readonly radius: number;
      /** Default "player". */
      readonly side?: ObjectiveSide;
      readonly tag?: string;
    }
  | { readonly on: "flag"; readonly flag: string; readonly value?: boolean }
  /**
   * The mission was won: the on-win phase between the winning frame and the
   * debrief. `say` actions become the debrief's opening lines; `setFlag`
   * persists story flags. Delays collapse to "now".
   */
  | { readonly on: "victory" };

/** A flag test; `is` defaults to true. Unset flags read false. */
export interface FlagCondition {
  readonly flag: string;
  readonly is?: boolean;
}

/** Comms mood (colours the speaker plate). */
export type DialogueMood = "neutral" | "urgent" | "solemn" | "proud" | "grim";

/** Music cue names the scene maps to its audio manager. */
export type MusicCue =
  | "tactical"
  | "combat"
  | "boss"
  | "victory"
  | "tension"
  /** The Nexus Broadcast: relay clicks, then a carrier tone (stinger). */
  | "broadcast"
  /** The Tide's three falling notes (stinger). */
  | "tide_motif";

/** Where a scripted group arrives. */
export type SpawnPlacement = ObjectivePoint | "flank" | "ahead" | "behind";

/** Ships a beat brings in. */
export interface ScriptSpawnGroup {
  readonly shipId: string;
  readonly count: number;
  /** "ally" groups join the player's squad under bot pilots. */
  readonly side: "enemy" | "ally";
  /** Faction of an enemy group (defaults to the mission's first enemy). */
  readonly faction?: string;
  readonly at?: SpawnPlacement;
  readonly tag?: string;
  readonly isAce?: boolean;
  readonly isBoss?: boolean;
}

/** What a beat does. */
export type ScriptAction =
  | {
      readonly do: "say";
      readonly speaker: string;
      readonly portraitKey: string;
      readonly text: string;
      readonly mood?: DialogueMood;
    }
  | { readonly do: "spawn"; readonly group: ScriptSpawnGroup }
  | { readonly do: "addObjective"; readonly objective: ObjectiveDefinition }
  | { readonly do: "revealObjective"; readonly objectiveId: string }
  | { readonly do: "completeObjective"; readonly objectiveId: string }
  | { readonly do: "failObjective"; readonly objectiveId: string }
  | {
      readonly do: "setFlag";
      readonly flag: string;
      readonly value?: boolean;
      /** Story flag: saved with the campaign when the mission is won. */
      readonly persist?: boolean;
    }
  | {
      readonly do: "hazard";
      readonly hazardId: string;
      readonly active: boolean;
    }
  | { readonly do: "music"; readonly cue: MusicCue }
  | {
      readonly do: "banner";
      readonly title: string;
      readonly subtitle: string;
    };

/** One scripted beat. */
export interface ScriptBeat {
  readonly id: string;
  readonly when: ScriptTrigger;
  /** Every condition must hold when the trigger matches. */
  readonly if?: readonly FlagCondition[];
  /** Seconds between the trigger and the actions. */
  readonly delaySeconds?: number;
  readonly actions: readonly ScriptAction[];
  /** Fire on every new match (default: once). */
  readonly repeat?: boolean;
}

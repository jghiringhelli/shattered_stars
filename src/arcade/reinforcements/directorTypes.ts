/**
 * directorTypes — data contracts of the ReinforcementDirector: its setup
 * (rules, team sides and their member squads with their plans, outcome
 * ownership, id source), the deployments it hands the scene and the picker
 * view.
 *
 * Sides are TEAMS: a team spends one pool and shares one on-field cap.
 * Members are the squads of a team, each with its own faction and its own
 * sub-reserve — a human squad its planned reserve, its replacement picker
 * and its open-choice catalog; an AI squad its strategy rotation.
 *
 * Pure data.
 */

import type { PickerOption } from "./reserveQueue";
import type {
  DeployOption,
  ReinforcementRules,
  StrategyId,
} from "./reinforcementTypes";

/** Who flies a deployed ship. */
export type DeployPilot = "player" | "wingman" | "ai";

/** Most picker rows (keys 1–6). */
export const PICKER_MAX_OPTIONS = 6;

/** One squad of a team. */
export interface DirectorMemberSetup {
  /** Unique key of the squad (the scene uses `squad_<config index>`). */
  readonly key: string;
  readonly faction: string;
  /** A human flies for it: it has a pilot ship and a picker. */
  readonly human: boolean;
  readonly strategy: StrategyId;
  /** Human: its reserve; AI: its strategy rotation. */
  readonly plan: readonly DeployOption[];
  /** Human: ships it may pick besides the reserve (open choice); AI: none. */
  readonly catalog: readonly DeployOption[];
}

/** One team's opening setup. */
export interface DirectorSideSetup {
  /** The team's side key. */
  readonly key: string;
  readonly members: readonly DirectorMemberSetup[];
}

/** Everything the director needs. */
export interface DirectorSetup {
  readonly rules: ReinforcementRules;
  /** The player's team (the "player" coalition of the outcome). */
  readonly playerSide: string;
  readonly sides: readonly DirectorSideSetup[];
  /** False when a scenario decides the match. */
  readonly ownsOutcome: boolean;
  /** A fresh, unused ship id for a member's new ship. */
  readonly nextShipId: (member: string, pilot: DeployPilot) => string;
}

/** A ship to spawn now. */
export interface Deployment {
  readonly shipId: string;
  /** The team's side key. */
  readonly side: string;
  /** The squad it belongs to. */
  readonly member: string;
  readonly faction: string;
  readonly option: DeployOption;
  readonly pilot: DeployPilot;
  /** The side's arrival number (fans arrivals out along its edge). */
  readonly slot: number;
}

/** The open picker. */
export interface PickerView {
  readonly options: readonly PickerOption[];
  /** Countdown left before the default deploys (ms). */
  readonly remainingMs: number;
  /** False while the default cannot deploy (countdown held). */
  readonly counting: boolean;
}

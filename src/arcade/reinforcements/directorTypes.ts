/**
 * directorTypes — data contracts of the ReinforcementDirector: its setup
 * (rules, sides and their plans, the player's catalog, outcome ownership,
 * id source), the deployments it hands the scene and the picker view.
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

/** One side's opening setup. */
export interface DirectorSideSetup {
  readonly faction: string;
  readonly strategy: StrategyId;
  /** AI: its strategy rotation; the player's side: its reserve. */
  readonly plan: readonly DeployOption[];
}

/** Everything the director needs. */
export interface DirectorSetup {
  readonly rules: ReinforcementRules;
  readonly playerFaction: string;
  readonly sides: readonly DirectorSideSetup[];
  /** Ships the player may pick besides the reserve (open choice). */
  readonly playerCatalog: readonly DeployOption[];
  /** False when a scenario decides the match. */
  readonly ownsOutcome: boolean;
  /** A fresh, unused ship id. */
  readonly nextShipId: (faction: string, pilot: DeployPilot) => string;
}

/** A ship to spawn now. */
export interface Deployment {
  readonly shipId: string;
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

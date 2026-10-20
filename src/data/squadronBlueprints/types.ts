import type { FactionId } from "../../config";

export interface QuickBuildShip {
  /** A SHIP_LOADOUTS id — ship, pilot and upgrades in one quick build. */
  readonly loadoutId: string;
}

export interface QuickBuildSquad {
  readonly id: string;
  readonly factionId: FactionId;
  readonly pointLimit: number;
  readonly name: string;
  readonly style: "aggressive" | "balanced" | "swarm" | "control";
  readonly ships: ReadonlyArray<QuickBuildShip>;
  /** Sum of every loadout in the squad. Derived, never authored. */
  readonly totalCost: number;
}

/** A preset as authored: the roster, with no total attached. */
export type SquadBlueprint = Omit<QuickBuildSquad, "totalCost">;

/**
 * Quick-build (loadout) types — shared by the loadout catalogue
 * (src/data/ShipLoadouts.ts) and the per-faction build files it merges, so
 * those files never import the catalogue back (no import cycle).
 */

/** A priced quick build: ship + one pilot + upgrades. */
export interface ShipLoadout {
  readonly id: string;
  readonly name: string;
  readonly shipId: string;
  /** The pilot flying this build (a PILOT_CARDS key for the same ship). */
  readonly pilotId: string;
  readonly upgrades: readonly string[]; // Upgrade IDs
  /** Bare ship + pilot surcharge + every equipped upgrade. Derived, never authored. */
  readonly pointCost: number;
  readonly description: string;
  readonly role: "offense" | "defense" | "support" | "balanced" | "swarm";
}

/**
 * A loadout as authored: what the build IS, with no price attached.
 *
 * Prices used to be written by hand next to each build and drifted badly —
 * 196 of 215 disagreed with their own upgrade list and 20 undercut the bare
 * ship. Authoring only the contents and deriving the price keeps the
 * catalogue consistent and incremental by construction.
 */
export type LoadoutBlueprint = Omit<ShipLoadout, "pointCost">;

/** Authored builds keyed by ship definition id. */
export type BlueprintsByShip = Readonly<Record<string, LoadoutBlueprint[]>>;

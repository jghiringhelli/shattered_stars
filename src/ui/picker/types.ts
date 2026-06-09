/**
 * Shared data types for the ShipPicker UI panel components.
 */

/** Aggregated stat bonuses contributed by a loadout's upgrades. */
export interface LoadoutBonuses {
  hull: number;
  shld: number;
  atk: number;
  agi: number;
  range: number;
  actions: string[];
  rerolls: number;
  charges: number;
}

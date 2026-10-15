/**
 * quickPresets — the quick-start row of the simple Skirmish flow: one click
 * picks a flagship by role in the chosen faction and launches. Pure.
 */

import { getShipsByFaction } from "../../data/ShipDefinitions";
import type { FactionId } from "../../config";

/** One preset: a label and the role of the ship it flies. */
export interface QuickPreset {
  readonly id: "balanced" | "aces" | "swarm";
  readonly label: string;
  readonly role: string;
  /** One-line explanation (tooltip / test names). */
  readonly blurb: string;
}

/** The presets, left to right. */
export const QUICK_PRESETS: readonly QuickPreset[] = [
  { id: "balanced", label: "BALANCED ›", role: "heavy_fighter", blurb: "A sturdy heavy fighter leads" },
  { id: "aces", label: "ACES ›", role: "interceptor", blurb: "A fast interceptor ace leads" },
  { id: "swarm", label: "SWARM ›", role: "light_fighter", blurb: "A cheap light fighter leads" },
];

/**
 * @param faction - The chosen faction.
 * @param preset - The preset clicked.
 * @returns The cheapest non-capital ship of the preset's role, falling back to
 *   the cheapest non-capital ship of the faction; undefined with no ships.
 */
export function presetShip(
  faction: FactionId,
  preset: QuickPreset,
): string | undefined {
  const fleet = getShipsByFaction(faction)
    .filter((s) => s.role !== "capital" && s.baseStats.size !== "huge")
    .sort((a, b) => a.baseStats.pointCost - b.baseStats.pointCost);
  return (fleet.find((s) => s.role === preset.role) ?? fleet[0])?.id;
}

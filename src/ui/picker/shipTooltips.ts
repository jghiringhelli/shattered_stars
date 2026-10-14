/**
 * shipTooltips — what hovering a ship card says: the hull's real numbers,
 * its role line and the squadmate it wants. Pure (tooltipContent only).
 */

import type { ShipDefinition } from "../../core/types";
import { shipHint } from "../../data/roleHints";
import type { TooltipContent } from "../menu/tooltipContent";

/**
 * @param def - The ship.
 * @param lockReason - Why it is locked ("" when it is available).
 * @returns Tooltip content for the ship's catalog card.
 */
export function shipTooltipContent(
  def: ShipDefinition,
  lockReason = "",
): TooltipContent {
  const stats = def.baseStats;
  const numbers = `Attack ${stats.attack} · Agility ${stats.agility} · Hull ${stats.hull} · Shields ${stats.shields} · Speed ${stats.speed.min}-${stats.speed.max}`;
  const hint = shipHint(def.id);
  return {
    title: `${def.name} — ${stats.pointCost} pts${lockReason ? " (locked)" : ""}`,
    body: lockReason ? `Locked: ${lockReason}.\n${numbers}` : numbers,
    role: hint.role,
    bestWith: hint.bestWith,
    playstyle: hint.playstyle,
  };
}

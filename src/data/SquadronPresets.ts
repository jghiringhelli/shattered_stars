/**
 * Squadron Presets
 *
 * Quick-build squads per faction and point budget, modeled after X-Wing 2.0
 * quick-play cards. Curated, internally consistent loadouts that let players
 * or AI field a competent squad without manual list-building.
 *
 * A preset authors only its roster. The total is derived from that roster by
 * `squadCost`, so a squad can never advertise a price its ships do not add up
 * to. Each entry is a loadout id; the loadout already names its ship and
 * pilot. What authoring still has to get right:
 *   the roster must fit pointLimit, and should spend most of it;
 *   a unique pilot may appear at most once per squad.
 * Both are pinned by tests/unit/data/SquadronPresets.test.ts.
 */

import type { FactionId } from "../config";
import { getLoadoutById } from "./ShipLoadouts";
import type {
  QuickBuildShip,
  QuickBuildSquad,
  SquadBlueprint,
} from "./squadronBlueprints/types";
import { TERRAN_HEGEMONY_BLUEPRINTS } from "./squadronBlueprints/terranHegemony";
import { FREE_CONFEDERATION_BLUEPRINTS } from "./squadronBlueprints/freeConfederation";
import { SYNTHETIC_COLLECTIVE_BLUEPRINTS } from "./squadronBlueprints/syntheticCollective";
import { VOID_CORSAIRS_BLUEPRINTS } from "./squadronBlueprints/voidCorsairs";
import { ASCENDANT_EMPIRE_BLUEPRINTS } from "./squadronBlueprints/ascendantEmpire";

export type { QuickBuildShip, QuickBuildSquad };

/** Structurally compatible with SimShipSpec in BattleSimulator (no circular import). */
export interface SquadShipSpec {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * What a roster costs: the sum of its loadouts (each already includes the
 * bare ship and its pilot's surcharge).
 *
 * @param ships - Loadouts making up the squad.
 * @returns Total point cost of the roster.
 */
export function squadCost(ships: ReadonlyArray<QuickBuildShip>): number {
  return ships.reduce(
    (total, ship) => total + (getLoadoutById(ship.loadoutId)?.pointCost ?? 0),
    0,
  );
}

/**
 * Ship and pilot a quick-build entry flies, read from its loadout.
 *
 * @param ship - A roster entry.
 * @returns The spec, falling back to the raw id for an unknown loadout.
 */
function specFor(ship: QuickBuildShip): SquadShipSpec {
  const loadout = getLoadoutById(ship.loadoutId);
  return {
    shipId: loadout?.shipId ?? ship.loadoutId,
    ...(loadout ? { pilotId: loadout.pilotId } : {}),
    loadoutId: ship.loadoutId,
  };
}

// ─── Squad Data ───────────────────────────────────────────────────────────────

const SQUAD_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
  ...TERRAN_HEGEMONY_BLUEPRINTS,
  ...FREE_CONFEDERATION_BLUEPRINTS,
  ...SYNTHETIC_COLLECTIVE_BLUEPRINTS,
  ...VOID_CORSAIRS_BLUEPRINTS,
  ...ASCENDANT_EMPIRE_BLUEPRINTS,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Every quick-build squad, with its total derived from its roster.
 *
 * Totals used to be authored next to each squad. Once loadout prices became
 * derived, 19 of 20 of those numbers were stale and 9 squads overspent their
 * own limit, so the total is now computed from the ships themselves.
 */
export const QUICK_BUILD_SQUADS: ReadonlyArray<QuickBuildSquad> =
  SQUAD_BLUEPRINTS.map((blueprint) => ({
    ...blueprint,
    totalCost: squadCost(blueprint.ships),
  }));

/**
 * Retrieve the best quick-build squad for a faction and point budget.
 * Returns the squad with the highest pointLimit not exceeding budget, or
 * undefined if no preset exists for this faction below the given budget.
 */
export function getQuickBuild(
  faction: FactionId,
  budget: number,
): QuickBuildSquad | undefined {
  return QUICK_BUILD_SQUADS.filter(
    (s) => s.factionId === faction && s.pointLimit <= budget,
  ).sort((a, b) => b.pointLimit - a.pointLimit)[0];
}

/**
 * Convert a quick-build squad to SquadShipSpec[] for BattleSimulator.
 * The return type is structurally compatible with SimShipSpec (structural typing).
 */
export function toSimSpecs(squad: QuickBuildSquad): SquadShipSpec[] {
  return squad.ships.map(specFor);
}

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

/** Structurally compatible with SimShipSpec in BattleSimulator (no circular import). */
export interface SquadShipSpec {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
type SquadBlueprint = Omit<QuickBuildSquad, "totalCost">;

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
  // ── TERRAN_HEGEMONY ──
  {
    id: "th_100_iron_cadets",
    factionId: "terran_hegemony",
    pointLimit: 100,
    name: "Iron Cadets",
    style: "aggressive",
    ships: [{ loadoutId: "viper_basic" }, { loadoutId: "raptor_pursuit" }],
  },
  {
    id: "th_150_patrol_alpha",
    factionId: "terran_hegemony",
    pointLimit: 150,
    name: "Patrol Alpha",
    style: "aggressive",
    ships: [
      { loadoutId: "viper_pursuit" },
      { loadoutId: "raptor_pursuit" },
      { loadoutId: "javelin_hunter" },
    ],
  },
  {
    id: "th_200_iron_fist",
    factionId: "terran_hegemony",
    pointLimit: 200,
    name: "Iron Fist",
    style: "balanced",
    ships: [
      { loadoutId: "centurion_assault" },
      { loadoutId: "centurion_defender" },
      { loadoutId: "gladius_basic" },
    ],
  },
  {
    id: "th_300_battle_squadron",
    factionId: "terran_hegemony",
    pointLimit: 300,
    name: "Battle Squadron",
    style: "aggressive",
    ships: [
      { loadoutId: "bastion_defender" },
      { loadoutId: "viper_ace" },
      { loadoutId: "viper_pursuit" },
      { loadoutId: "raptor_basic" },
      { loadoutId: "stiletto_picket" },
    ],
  },

  // ── FREE_CONFEDERATION ──
  {
    id: "fc_100_scout_squadron",
    factionId: "free_confederation",
    pointLimit: 100,
    name: "Scout Squadron",
    style: "swarm",
    ships: [
      { loadoutId: "wasp_ace" },
      { loadoutId: "wasp_picket" },
      { loadoutId: "finch_patrol" },
    ],
  },
  {
    id: "fc_150_freedom_wing",
    factionId: "free_confederation",
    pointLimit: 150,
    name: "Freedom Wing",
    style: "swarm",
    ships: [
      { loadoutId: "wasp_ace" },
      { loadoutId: "wasp_picket" },
      { loadoutId: "wasp_picket" },
      { loadoutId: "finch_patrol" },
      { loadoutId: "finch_scout" },
    ],
  },
  {
    id: "fc_200_confederacy_strike",
    factionId: "free_confederation",
    pointLimit: 200,
    name: "Confederacy Strike",
    // Not "balanced": in reinforced battles its cheap escorts pack the
    // field cap too well; the AI's Balanced rotation flies Confederacy Line.
    style: "aggressive",
    ships: [
      { loadoutId: "falcon_defender" },
      { loadoutId: "eagle_striker" },
      { loadoutId: "finch_patrol" },
      { loadoutId: "wasp_ace" },
    ],
  },
  {
    id: "fc_190_confederacy_line",
    factionId: "free_confederation",
    pointLimit: 190,
    name: "Confederacy Line",
    style: "balanced",
    ships: [
      { loadoutId: "falcon_defender" },
      { loadoutId: "eagle_defender" },
      { loadoutId: "crane_coordinator" },
    ],
  },
  {
    id: "fc_300_liberation_fleet",
    factionId: "free_confederation",
    pointLimit: 300,
    name: "Liberation Fleet",
    style: "aggressive",
    ships: [
      { loadoutId: "hawk_assault" },
      { loadoutId: "falcon_striker" },
      { loadoutId: "sparrow_swarm" },
      { loadoutId: "sparrow_swarm" },
      { loadoutId: "sparrow_swarm" },
      { loadoutId: "sparrow_swarm" },
    ],
  },

  // ── SYNTHETIC_COLLECTIVE ──
  {
    id: "sc_100_recon_cluster",
    factionId: "synthetic_collective",
    pointLimit: 100,
    name: "Recon Cluster",
    style: "swarm",
    ships: [
      { loadoutId: "drone_standard" },
      { loadoutId: "scout_recon" },
      { loadoutId: "drone_standard" },
    ],
  },
  {
    id: "sc_150_hunter_pack",
    factionId: "synthetic_collective",
    pointLimit: 150,
    name: "Hunter Pack",
    style: "aggressive",
    ships: [
      { loadoutId: "interceptor_overdrive" },
      { loadoutId: "interceptor_swarm_uplink" },
      { loadoutId: "drone_standard" },
      { loadoutId: "scout_swarm_picket" },
    ],
  },
  {
    id: "sc_200_precision_strike",
    factionId: "synthetic_collective",
    pointLimit: 200,
    name: "Precision Strike",
    style: "balanced",
    ships: [
      { loadoutId: "hunter_evasion_protocol" },
      { loadoutId: "heavy_patrol" },
      { loadoutId: "scout_basic" },
      { loadoutId: "relay_coordinator" },
    ],
  },
  {
    id: "sc_300_hive_fleet",
    factionId: "synthetic_collective",
    pointLimit: 300,
    name: "Hive Fleet",
    style: "aggressive",
    ships: [
      { loadoutId: "interceptor_hunter" },
      { loadoutId: "bomber_basic" },
      { loadoutId: "interceptor_swarm" },
      { loadoutId: "relay_basic" },
      { loadoutId: "relay_basic" },
      { loadoutId: "drone_standard" },
    ],
  },

  // ── VOID_CORSAIRS ──
  {
    id: "vc_100_fang_blade",
    factionId: "void_corsairs",
    pointLimit: 100,
    name: "Fang Blade",
    style: "aggressive",
    ships: [
      { loadoutId: "fang_raider" },
      { loadoutId: "fang_hot_wired" },
      { loadoutId: "fang_hot_wired" },
    ],
  },
  {
    id: "vc_150_corsair_raider",
    factionId: "void_corsairs",
    pointLimit: 150,
    name: "Corsair Raider",
    style: "aggressive",
    ships: [
      { loadoutId: "fang_raider" },
      { loadoutId: "venom_assassin" },
      { loadoutId: "torpedo_hunter" },
    ],
  },
  {
    id: "vc_200_terror_squadron",
    factionId: "void_corsairs",
    pointLimit: 200,
    name: "Terror Squadron",
    style: "balanced",
    ships: [
      { loadoutId: "scimitar_assault" },
      { loadoutId: "scimitar_assault" },
      { loadoutId: "cutlass_brawler" },
    ],
  },
  {
    id: "vc_300_corsair_fleet",
    factionId: "void_corsairs",
    pointLimit: 300,
    name: "Corsair Fleet",
    style: "balanced",
    ships: [
      { loadoutId: "reaver_boarding" },
      { loadoutId: "marauder_brawler" },
      { loadoutId: "scimitar_assault" },
      { loadoutId: "blade_ace" },
      { loadoutId: "fang_hot_wired" },
    ],
  },

  // ── ASCENDANT_EMPIRE ──
  {
    id: "ae_100_holy_herald",
    factionId: "ascendant_empire",
    pointLimit: 100,
    name: "Holy Herald",
    style: "aggressive",
    ships: [{ loadoutId: "herald_striker" }, { loadoutId: "cherub_ace" }],
  },
  {
    id: "ae_150_sacred_guard",
    factionId: "ascendant_empire",
    pointLimit: 150,
    name: "Sacred Guard",
    style: "aggressive",
    ships: [
      { loadoutId: "seraph_champion" },
      { loadoutId: "virtue_pursuit" },
      { loadoutId: "herald_scout" },
    ],
  },
  {
    id: "ae_200_crusader_host",
    factionId: "ascendant_empire",
    pointLimit: 200,
    name: "Temple Inquisition",
    style: "balanced",
    ships: [
      { loadoutId: "inquisitor_hunter" },
      { loadoutId: "acolyte_relay" },
      { loadoutId: "templar_guardian" },
    ],
  },
  {
    id: "ae_300_holy_crusade",
    factionId: "ascendant_empire",
    pointLimit: 300,
    name: "Holy Crusade",
    style: "control",
    ships: [
      { loadoutId: "crusader_defender" },
      { loadoutId: "acolyte_support" },
      { loadoutId: "virtue_basic" },
      { loadoutId: "crusader_defender" },
      { loadoutId: "cherub_ace" },
    ],
  },
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

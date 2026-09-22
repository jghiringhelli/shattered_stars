/**
 * Squadron Presets
 *
 * Quick-build squads per faction and point budget, modeled after X-Wing 2.0
 * quick-play cards. Curated, internally consistent loadouts that let players
 * or AI field a competent squad without manual list-building.
 *
 * A preset authors only its roster. The total is derived from that roster by
 * `squadCost`, so a squad can never advertise a price its ships do not add up
 * to. What authoring still has to get right:
 *   pilotId must be a valid PILOT_CARDS key piloting the same ship as loadoutId.
 *   the roster must fit pointLimit, and should spend most of it.
 * Both are pinned by tests/unit/data/SquadronPresets.test.ts.
 */

import type { FactionId } from "../config";
import { PILOT_CARDS } from "../systems/SquadBuilder";
import { getLoadoutById } from "./ShipLoadouts";

/** Structurally compatible with SimShipSpec in BattleSimulator (no circular import). */
export interface SquadShipSpec {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface QuickBuildShip {
  readonly pilotId: string;
  readonly loadoutId: string;
}

export interface QuickBuildSquad {
  readonly id: string;
  readonly factionId: FactionId;
  readonly pointLimit: number;
  readonly name: string;
  readonly style: "aggressive" | "balanced" | "swarm" | "control";
  readonly ships: ReadonlyArray<QuickBuildShip>;
  /** Sum of every pilot and loadout in the squad. Derived, never authored. */
  readonly totalCost: number;
}

/** A preset as authored: the roster, with no total attached. */
type SquadBlueprint = Omit<QuickBuildSquad, "totalCost">;

/**
 * What a roster costs: every pilot card plus every loadout.
 *
 * @param ships - Pilot/loadout pairs making up the squad.
 * @returns Total point cost of the roster.
 */
export function squadCost(ships: ReadonlyArray<QuickBuildShip>): number {
  return ships.reduce((total, ship) => {
    const loadout = getLoadoutById(ship.loadoutId);
    const pilot = PILOT_CARDS[ship.pilotId];
    return total + (loadout?.pointCost ?? 0) + (pilot?.pointCost ?? 0);
  }, 0);
}

// ─── Squad Data ───────────────────────────────────────────────────────────────

const SQUAD_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
  // ── TERRAN HEGEMONY ────────────────────────────────────────────────────────
  {
    id: "th_100_iron_cadets",
    factionId: "terran_hegemony",
    pointLimit: 100,
    name: "Iron Cadets",
    style: "swarm",
    ships: [
      { pilotId: "stiletto_cadet", loadoutId: "stiletto_basic" },
      { pilotId: "stiletto_cadet", loadoutId: "stiletto_basic" },
    ],
  },
  {
    id: "th_150_patrol_alpha",
    factionId: "terran_hegemony",
    pointLimit: 150,
    name: "Patrol Alpha",
    style: "balanced",
    ships: [
      { pilotId: "stiletto_cadet", loadoutId: "stiletto_basic" },
      { pilotId: "viper_cadet", loadoutId: "viper_pursuit" },
    ],
  },
  {
    id: "th_200_iron_fist",
    factionId: "terran_hegemony",
    pointLimit: 200,
    name: "Iron Fist",
    style: "balanced",
    ships: [
      { pilotId: "vindicator_crew", loadoutId: "vindicator_strike" },
      { pilotId: "stiletto_cadet", loadoutId: "stiletto_basic" },
    ],
  },
  {
    id: "th_300_battle_squadron",
    factionId: "terran_hegemony",
    pointLimit: 300,
    name: "Battle Squadron",
    style: "balanced",
    ships: [
      { pilotId: "viper_ace", loadoutId: "viper_ace" },
      { pilotId: "harbinger_crew", loadoutId: "harbinger_coordinator" },
      { pilotId: "viper_cadet", loadoutId: "viper_pursuit" },
    ],
  },

  // ── FREE CONFEDERATION ─────────────────────────────────────────────────────
  {
    id: "fc_100_scout_squadron",
    factionId: "free_confederation",
    pointLimit: 100,
    name: "Scout Squadron",
    style: "swarm",
    ships: [
      { pilotId: "wasp_rookie", loadoutId: "wasp_swarm" },
      { pilotId: "wasp_pilot", loadoutId: "wasp_swarm" },
    ],
  },
  {
    id: "fc_150_freedom_wing",
    factionId: "free_confederation",
    pointLimit: 150,
    name: "Freedom Wing",
    style: "swarm",
    ships: [
      { pilotId: "wasp_rookie", loadoutId: "wasp_swarm" },
      { pilotId: "wasp_pilot", loadoutId: "wasp_swarm" },
      { pilotId: "finch_pilot", loadoutId: "finch_patrol" },
    ],
  },
  {
    id: "fc_200_confederacy_strike",
    factionId: "free_confederation",
    pointLimit: 200,
    name: "Confederacy Strike",
    style: "balanced",
    ships: [
      { pilotId: "thunder_mason", loadoutId: "albatross_assault" },
      { pilotId: "finch_pilot", loadoutId: "finch_scout" },
    ],
  },
  {
    id: "fc_300_liberation_fleet",
    factionId: "free_confederation",
    pointLimit: 300,
    name: "Liberation Fleet",
    style: "aggressive",
    ships: [
      { pilotId: "hawk_rennick", loadoutId: "hawk_assault" },
      { pilotId: "falcon_veteran", loadoutId: "falcon_striker" },
      { pilotId: "sparrow_rookie", loadoutId: "sparrow_swarm" },
    ],
  },

  // ── SYNTHETIC COLLECTIVE ───────────────────────────────────────────────────
  {
    id: "sc_100_recon_cluster",
    factionId: "synthetic_collective",
    pointLimit: 100,
    name: "Recon Cluster",
    style: "swarm",
    ships: [
      { pilotId: "combat_drone_alpha", loadoutId: "drone_standard" },
      { pilotId: "scout_drone_alpha", loadoutId: "scout_basic" },
    ],
  },
  {
    id: "sc_150_hunter_pack",
    factionId: "synthetic_collective",
    pointLimit: 150,
    name: "Hunter Pack",
    style: "aggressive",
    ships: [
      { pilotId: "interceptor_drone_alpha", loadoutId: "interceptor_swarm" },
      { pilotId: "interceptor_drone_alpha", loadoutId: "interceptor_swarm" },
      { pilotId: "scout_drone_alpha", loadoutId: "scout_basic" },
    ],
  },
  {
    id: "sc_200_precision_strike",
    factionId: "synthetic_collective",
    pointLimit: 200,
    name: "Precision Strike",
    style: "balanced",
    ships: [
      { pilotId: "eradicator_protocol", loadoutId: "eradicator_defender" },
      { pilotId: "scout_drone_beta", loadoutId: "scout_basic" },
    ],
  },
  {
    id: "sc_300_hive_fleet",
    factionId: "synthetic_collective",
    pointLimit: 300,
    name: "Hive Fleet",
    style: "balanced",
    ships: [
      { pilotId: "interceptor_drone_beta", loadoutId: "interceptor_hunter" },
      { pilotId: "demolition_unit", loadoutId: "bomber_basic" },
      { pilotId: "interceptor_drone_alpha", loadoutId: "interceptor_swarm" },
      { pilotId: "relay_node_basic", loadoutId: "relay_basic" },
    ],
  },

  // ── VOID CORSAIRS ──────────────────────────────────────────────────────────
  {
    id: "vc_100_fang_blade",
    factionId: "void_corsairs",
    pointLimit: 100,
    name: "Fang Blade",
    style: "aggressive",
    ships: [{ pilotId: "poison_fang", loadoutId: "fang_raider" }],
  },
  {
    id: "vc_150_corsair_raider",
    factionId: "void_corsairs",
    pointLimit: 150,
    name: "Corsair Raider",
    style: "aggressive",
    ships: [
      { pilotId: "fang_raider", loadoutId: "fang_raider" },
      { pilotId: "venom_pilot", loadoutId: "venom_assassin" },
    ],
  },
  {
    id: "vc_200_terror_squadron",
    factionId: "void_corsairs",
    pointLimit: 200,
    name: "Terror Squadron",
    style: "aggressive",
    ships: [
      { pilotId: "bloody_cutlass", loadoutId: "cutlass_assault" },
      { pilotId: "fang_raider", loadoutId: "fang_raider" },
    ],
  },
  {
    id: "vc_300_corsair_fleet",
    factionId: "void_corsairs",
    pointLimit: 300,
    name: "Corsair Fleet",
    style: "balanced",
    ships: [
      { pilotId: "tender_crew", loadoutId: "tender_support" },
      { pilotId: "red_jenna", loadoutId: "blade_ace" },
      { pilotId: "venom_pilot", loadoutId: "venom_swarm" },
    ],
  },

  // ── ASCENDANT EMPIRE ───────────────────────────────────────────────────────
  {
    id: "ae_100_holy_herald",
    factionId: "ascendant_empire",
    pointLimit: 100,
    name: "Holy Herald",
    style: "aggressive",
    ships: [{ pilotId: "voice_of_glory", loadoutId: "herald_striker" }],
  },
  {
    id: "ae_150_sacred_guard",
    factionId: "ascendant_empire",
    pointLimit: 150,
    name: "Sacred Guard",
    style: "balanced",
    ships: [
      { pilotId: "virtue_pilot", loadoutId: "virtue_pursuit" },
      { pilotId: "cherub_initiate", loadoutId: "cherub_swarm" },
    ],
  },
  {
    id: "ae_200_crusader_host",
    factionId: "ascendant_empire",
    pointLimit: 200,
    name: "Crusader Host",
    style: "balanced",
    ships: [
      { pilotId: "holy_avenger", loadoutId: "crusader_assault" },
      { pilotId: "cherub_initiate", loadoutId: "cherub_swarm" },
    ],
  },
  {
    id: "ae_300_holy_crusade",
    factionId: "ascendant_empire",
    pointLimit: 300,
    name: "Holy Crusade",
    style: "control",
    ships: [
      { pilotId: "crusader_pilot", loadoutId: "crusader_defender" },
      { pilotId: "acolyte_pilot", loadoutId: "acolyte_support" },
      { pilotId: "virtue_pilot", loadoutId: "virtue_basic" },
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
  return squad.ships.map((ship) => ({
    shipId: PILOT_CARDS[ship.pilotId]?.shipId ?? ship.pilotId,
    pilotId: ship.pilotId,
    loadoutId: ship.loadoutId,
  }));
}

/** Minimal ship config compatible with AIShipConfig (avoids circular import). */
export interface AIShipConfigLike {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

/**
 * Convert a quick-build squad to AIShipConfig[] for AIShipFactory.createAISquad.
 */
export function toAIConfigs(squad: QuickBuildSquad): AIShipConfigLike[] {
  return squad.ships.map((ship) => ({
    shipId: PILOT_CARDS[ship.pilotId]?.shipId ?? ship.pilotId,
    pilotId: ship.pilotId,
    loadoutId: ship.loadoutId,
  }));
}

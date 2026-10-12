/**
 * Ship Loadouts System
 *
 * Pre-configured builds for each ship (X-Wing TMG "quick builds"). Every
 * build must fit its ship's slot bar (src/data/ShipSlots.ts) and its price is
 * derived from its contents. AI enemies, campaign missions and the ship
 * picker all use these loadouts.
 */

import { deriveLoadoutCost } from "./loadoutPricing";
import type {
  BlueprintsByShip,
  LoadoutBlueprint,
  ShipLoadout,
} from "./loadouts/loadoutTypes";
import { ROSTER_BLUEPRINTS } from "./loadouts";

export { SHIP_SLOTS, getShipSlots, type ShipSlotConfig } from "./ShipSlots";
export type { LoadoutBlueprint, ShipLoadout } from "./loadouts/loadoutTypes";

// ============================================
// Pre-Built Loadouts
// ============================================

/**
 * Pre-configured loadouts for AI and campaign use
 * Each ship has 2-3 recommended builds
 */
const LOADOUT_BLUEPRINTS: Record<string, LoadoutBlueprint[]> = {
  // ==========================================
  // TERRAN HEGEMONY LOADOUTS (20 ships)
  // ==========================================

  terran_viper: [
    {
      id: "viper_ace",
      name: "Viper Ace",
      shipId: "terran_viper",
      pilotId: "commander_striker",
      upgrades: ["predator", "concussion_missile", "stealth_device"],
      description: "Elite interceptor with missile strike capability",
      role: "offense",
    },
    {
      id: "viper_pursuit",
      name: "Viper Pursuit",
      shipId: "terran_viper",
      pilotId: "viper_ace",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Fast pursuit interceptor focused on evasion",
      role: "defense",
    },
    {
      id: "viper_basic",
      name: "Viper Basic",
      shipId: "terran_viper",
      pilotId: "viper_cadet",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
    {
      id: "viper_swarm",
      name: "Viper Swarm",
      shipId: "terran_viper",
      pilotId: "viper_cadet",
      upgrades: [],
      description: "Bare patrol configuration",
      role: "swarm",
    },
  ],
  terran_stiletto: [
    {
      id: "stiletto_basic",
      name: "Stiletto Basic",
      shipId: "terran_stiletto",
      pilotId: "stiletto_cadet",
      upgrades: [],
      description: "Basic patrol fighter",
      role: "swarm",
    },
    {
      id: "stiletto_ace",
      name: "Stiletto Ace",
      shipId: "terran_stiletto",
      pilotId: "stiletto_pilot",
      upgrades: ["elusive"],
      description: "Nimble pilot build",
      role: "defense",
    },
  ],
  terran_raptor: [
    {
      id: "raptor_striker",
      name: "Raptor Striker",
      shipId: "terran_raptor",
      pilotId: "talon_reyes",
      upgrades: ["predator", "concussion_missile"],
      description: "Elite strike interceptor",
      role: "offense",
    },
    {
      id: "raptor_pursuit",
      name: "Raptor Pursuit",
      shipId: "terran_raptor",
      pilotId: "raptor_ace",
      upgrades: ["elusive", "advanced_sensors"],
      description: "Fast pursuit build",
      role: "defense",
    },
    {
      id: "raptor_basic",
      name: "Raptor Basic",
      shipId: "terran_raptor",
      pilotId: "raptor_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  terran_gladius: [
    {
      id: "gladius_striker",
      name: "Gladius Striker",
      shipId: "terran_gladius",
      pilotId: "iron_wolf",
      upgrades: ["marksman", "proton_torpedo", "fire_control_system"],
      description: "Heavy strike fighter with torpedo payload",
      role: "offense",
    },
    {
      id: "gladius_patrol",
      name: "Gladius Patrol",
      shipId: "terran_gladius",
      pilotId: "gladius_pilot",
      upgrades: ["advanced_sensors", "hull_upgrade"],
      description: "Durable patrol fighter for extended operations",
      role: "defense",
    },
    {
      id: "gladius_basic",
      name: "Gladius Basic",
      shipId: "terran_gladius",
      pilotId: "gladius_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  terran_centurion: [
    {
      id: "centurion_assault",
      name: "Centurion Assault",
      shipId: "terran_centurion",
      pilotId: "shield_breaker_kane",
      upgrades: ["heavy_laser_cannon", "advanced_sensors"],
      description: "Heavy assault build",
      role: "offense",
    },
    {
      id: "centurion_defender",
      name: "Centurion Defender",
      shipId: "terran_centurion",
      pilotId: "centurion_veteran",
      upgrades: ["shield_upgrade", "elusive"],
      description: "Durable defender build",
      role: "defense",
    },
  ],
  terran_praetorian: [
    {
      id: "praetorian_elite",
      name: "Praetorian Elite",
      shipId: "terran_praetorian",
      pilotId: "steel_marcus",
      upgrades: ["predator", "heavy_laser_cannon", "tactical_officer"],
      description: "Elite guard configuration",
      role: "offense",
    },
    {
      id: "praetorian_command",
      name: "Praetorian Command",
      shipId: "terran_praetorian",
      pilotId: "praetorian_guard",
      upgrades: ["coordinated_assault", "hull_upgrade"],
      description: "Command escort build",
      role: "support",
    },
  ],
  terran_legionnaire: [
    {
      id: "legionnaire_assault",
      name: "Legionnaire Assault",
      shipId: "terran_legionnaire",
      pilotId: "legion_master_vex",
      upgrades: ["marksman", "concussion_missile"],
      description: "Assault fighter build",
      role: "offense",
    },
    {
      id: "legionnaire_line",
      name: "Legionnaire Line",
      shipId: "terran_legionnaire",
      pilotId: "legionnaire_pilot",
      upgrades: ["hull_upgrade"],
      description: "Line fighter build",
      role: "balanced",
    },
  ],
  terran_hammer: [
    {
      id: "hammer_devastator",
      name: "Hammer Devastator",
      shipId: "terran_hammer",
      pilotId: "deathbringer_ix",
      upgrades: ["proton_torpedo", "proton_bomb", "weapons_engineer"],
      description: "Full ordnance bomber for capital ship assault",
      role: "offense",
    },
    {
      id: "hammer_minelayer",
      name: "Hammer Minelayer",
      shipId: "terran_hammer",
      pilotId: "hammer_crew",
      upgrades: ["cluster_mine", "proximity_mine", "hull_upgrade"],
      description: "Area denial bomber with mine deployment",
      role: "support",
    },
  ],
  terran_thunderbolt: [
    {
      id: "thunderbolt_siege",
      name: "Thunderbolt Siege",
      shipId: "terran_thunderbolt",
      pilotId: "stormbringer_cole",
      upgrades: [
        "proton_torpedo",
        "proton_torpedo",
        "proton_bomb",
        "weapons_engineer",
      ],
      description: "Heavy siege bomber",
      role: "offense",
    },
    {
      id: "thunderbolt_assault",
      name: "Thunderbolt Assault",
      shipId: "terran_thunderbolt",
      pilotId: "thunderbolt_crew",
      upgrades: ["proton_torpedo", "seismic_charge", "hull_upgrade"],
      description: "Assault bomber build",
      role: "balanced",
    },
    {
      id: "thunderbolt_basic",
      name: "Thunderbolt Basic",
      shipId: "terran_thunderbolt",
      pilotId: "thunderbolt_crew",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  terran_javelin: [
    {
      id: "javelin_strike",
      name: "Javelin Strike",
      shipId: "terran_javelin",
      pilotId: "torpedo_ace_zara",
      upgrades: ["proton_torpedo", "proton_torpedo"],
      description: "Fast torpedo strike",
      role: "offense",
    },
    {
      id: "javelin_hunter",
      name: "Javelin Hunter",
      shipId: "terran_javelin",
      pilotId: "javelin_veteran",
      upgrades: ["proton_torpedo", "fire_control_system"],
      description: "Precision torpedo hunter",
      role: "offense",
    },
  ],
  terran_sentinel: [
    {
      id: "sentinel_command",
      name: "Sentinel Command",
      shipId: "terran_sentinel",
      pilotId: "sentinel_crew",
      upgrades: ["coordinated_assault", "tactical_officer", "advanced_sensors"],
      description: "Fleet command ship with full coordination suite",
      role: "support",
    },
    {
      id: "sentinel_shield",
      name: "Sentinel Shield",
      shipId: "terran_sentinel",
      pilotId: "sentinel_crew",
      upgrades: ["shield_upgrade", "collision_detector"],
      description: "Durable support platform for sustained operations",
      role: "defense",
    },
  ],
  terran_guardian: [
    {
      id: "guardian_ecm",
      name: "Guardian ECM",
      shipId: "terran_guardian",
      pilotId: "guardian_crew",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Electronic warfare platform",
      role: "support",
    },
    {
      id: "guardian_shield",
      name: "Guardian Shield",
      shipId: "terran_guardian",
      pilotId: "guardian_crew",
      upgrades: ["shield_upgrade", "advanced_sensors", "tactical_officer"],
      description: "Heavy shield support",
      role: "defense",
    },
  ],
  terran_harbinger: [
    {
      id: "harbinger_scout",
      name: "Harbinger Scout",
      shipId: "terran_harbinger",
      pilotId: "harbinger_crew",
      upgrades: ["advanced_sensors", "pattern_analyzer"],
      description: "Reconnaissance build",
      role: "support",
    },
    {
      id: "harbinger_coordinator",
      name: "Harbinger Coordinator",
      shipId: "terran_harbinger",
      pilotId: "harbinger_crew",
      upgrades: ["coordinated_assault", "pattern_analyzer"],
      description: "Full coordination platform",
      role: "support",
    },
  ],
  terran_bastion: [
    {
      id: "bastion_fortress",
      name: "Bastion Fortress",
      shipId: "terran_bastion",
      pilotId: "fortress_gunner_wade",
      upgrades: ["twin_laser_turret", "heavy_laser_cannon", "veteran_gunner"],
      description: "Heavy weapons platform",
      role: "offense",
    },
    {
      id: "bastion_defender",
      name: "Bastion Defender",
      shipId: "terran_bastion",
      pilotId: "bastion_crew",
      upgrades: ["ion_turret", "hull_upgrade"],
      description: "Defensive gunship",
      role: "defense",
    },
  ],
  terran_bulwark: [
    {
      id: "bulwark_fortress",
      name: "Bulwark Fortress",
      shipId: "terran_bulwark",
      pilotId: "captain_ironside",
      upgrades: [
        "twin_laser_turret",
        "quad_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
      ],
      description: "Maximum firepower platform",
      role: "offense",
    },
    {
      id: "bulwark_bastion",
      name: "Bulwark Bastion",
      shipId: "terran_bulwark",
      pilotId: "bulwark_crew",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive fortress",
      role: "defense",
    },
  ],
  terran_vindicator: [
    {
      id: "vindicator_strike",
      name: "Vindicator Strike",
      shipId: "terran_vindicator",
      pilotId: "wrath_of_mars",
      upgrades: ["twin_laser_turret", "heavy_laser_cannon", "seeker_missile"],
      description: "Strike cruiser build",
      role: "offense",
    },
    {
      id: "vindicator_escort",
      name: "Vindicator Escort",
      shipId: "terran_vindicator",
      pilotId: "vindicator_crew",
      upgrades: ["ion_turret", "concussion_missile"],
      description: "Escort cruiser build",
      role: "balanced",
    },
  ],
  terran_imperator: [
    {
      id: "imperator_flagship",
      name: "Imperator Flagship",
      shipId: "terran_imperator",
      pilotId: "grand_admiral_nero",
      upgrades: [
        "quad_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
        "tactical_officer",
      ],
      description: "Fleet flagship configuration",
      role: "offense",
    },
    {
      id: "imperator_command",
      name: "Imperator Command",
      shipId: "terran_imperator",
      pilotId: "imperator_crew",
      upgrades: ["twin_laser_turret", "tactical_officer"],
      description: "Command ship configuration",
      role: "support",
    },
  ],
  terran_dominator: [
    {
      id: "dominator_carrier",
      name: "Dominator Carrier",
      shipId: "terran_dominator",
      pilotId: "dominator_crew",
      upgrades: ["twin_laser_turret", "tactical_officer", "veteran_gunner"],
      description: "Carrier operations build",
      role: "support",
    },
    {
      id: "dominator_assault",
      name: "Dominator Assault",
      shipId: "terran_dominator",
      pilotId: "dominator_crew",
      upgrades: ["quad_laser_turret", "veteran_gunner"],
      description: "Assault carrier build",
      role: "balanced",
    },
  ],
  terran_executor: [
    {
      id: "executor_hunter",
      name: "Executor Hunter",
      shipId: "terran_executor",
      pilotId: "supreme_commander_ash",
      upgrades: ["quad_laser_turret", "heavy_laser_cannon", "veteran_gunner"],
      description: "Hunter-killer destroyer",
      role: "offense",
    },
    {
      id: "executor_screen",
      name: "Executor Screen",
      shipId: "terran_executor",
      pilotId: "executor_crew",
      upgrades: ["twin_laser_turret", "shield_upgrade"],
      description: "Fleet screening destroyer",
      role: "defense",
    },
  ],
  terran_consul: [
    {
      id: "consul_command",
      name: "Consul Command",
      shipId: "terran_consul",
      pilotId: "consul_crew",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Fleet command vessel",
      role: "support",
    },
    {
      id: "consul_coordinator",
      name: "Consul Coordinator",
      shipId: "terran_consul",
      pilotId: "consul_crew",
      upgrades: ["tactical_officer"],
      description: "Coordination platform",
      role: "support",
    },
  ],

  // ==========================================
  // FREE CONFEDERATION LOADOUTS
  // ==========================================

  confed_sparrow: [
    {
      id: "sparrow_swarm",
      name: "Sparrow Swarm",
      shipId: "confed_sparrow",
      pilotId: "sparrow_rookie",
      upgrades: ["seeker_missile"],
      description: "Cheap swarm fighter with missile punch",
      role: "swarm",
    },
    {
      id: "sparrow_ace",
      name: "Sparrow Ace",
      shipId: "confed_sparrow",
      pilotId: "sparrow_pilot",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Nimble ace pilot build",
      role: "defense",
    },
  ],

  confed_falcon: [
    {
      id: "falcon_striker",
      name: "Falcon Striker",
      shipId: "confed_falcon",
      pilotId: "hawk_rennick",
      upgrades: ["predator", "proton_torpedo", "targeting_astromech"],
      description: "Balanced strike fighter with ordnance",
      role: "offense",
    },
    {
      id: "falcon_defender",
      name: "Falcon Defender",
      shipId: "confed_falcon",
      pilotId: "falcon_veteran",
      upgrades: ["elusive", "shield_upgrade", "repair_astromech"],
      description: "Durable defender with shield regeneration",
      role: "defense",
    },
    {
      id: "falcon_patcher",
      name: "Falcon Patcher",
      shipId: "confed_falcon",
      pilotId: "falcon_pilot",
      upgrades: ["patch_astromech", "shield_upgrade"],
      description: "Steady fighter whose droid welds the hull between passes",
      role: "defense",
    },
  ],

  confed_raven: [
    {
      id: "raven_ambush",
      name: "Raven Ambush",
      shipId: "confed_raven",
      pilotId: "shadow_lynx",
      upgrades: ["phantom_strike", "pattern_analyzer", "concussion_missile"],
      description: "Stealth ambusher with alpha strike",
      role: "offense",
    },
    {
      id: "raven_scout",
      name: "Raven Scout",
      shipId: "confed_raven",
      pilotId: "raven_pilot",
      upgrades: ["expert_handling", "stealth_device"],
      description: "Recon specialist with enhanced evasion",
      role: "defense",
    },
  ],

  confed_phoenix: [
    {
      id: "phoenix_fortress",
      name: "Phoenix Fortress",
      shipId: "confed_phoenix",
      pilotId: "captain_vex",
      upgrades: [
        "veteran_gunner",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "hull_upgrade",
      ],
      description: "Heavy weapons platform with 360° coverage",
      role: "offense",
    },
    {
      id: "phoenix_support",
      name: "Phoenix Support",
      shipId: "confed_phoenix",
      pilotId: "phoenix_crew",
      upgrades: ["tactical_officer", "ion_turret", "shield_upgrade"],
      description: "Ion control platform with coordination",
      role: "support",
    },
    {
      id: "phoenix_tender",
      name: "Phoenix Tender",
      shipId: "confed_phoenix",
      pilotId: "phoenix_crew",
      upgrades: ["mechanic", "twin_laser_turret", "hull_upgrade"],
      description: "Turret gunship with a mechanic who patches the hull",
      role: "support",
    },
  ],

  confed_wasp: [
    {
      id: "wasp_swarm",
      name: "Wasp Swarm",
      shipId: "confed_wasp",
      pilotId: "wasp_rookie",
      upgrades: [],
      description: "Cheap swarm interceptor",
      role: "swarm",
    },
    {
      id: "wasp_ace",
      name: "Wasp Ace",
      shipId: "confed_wasp",
      pilotId: "wasp_pilot",
      upgrades: ["elusive"],
      description: "Nimble ace build",
      role: "defense",
    },
  ],
  confed_finch: [
    {
      id: "finch_scout",
      name: "Finch Scout",
      shipId: "confed_finch",
      pilotId: "finch_pilot",
      upgrades: ["advanced_sensors"],
      description: "Recon scout",
      role: "support",
    },
    {
      id: "finch_patrol",
      name: "Finch Patrol",
      shipId: "confed_finch",
      pilotId: "finch_pilot",
      upgrades: ["hull_upgrade"],
      description: "Basic patrol",
      role: "swarm",
    },
  ],
  confed_kestrel: [
    {
      id: "kestrel_striker",
      name: "Kestrel Striker",
      shipId: "confed_kestrel",
      pilotId: "striker_vale",
      upgrades: ["predator", "concussion_missile"],
      description: "Strike interceptor",
      role: "offense",
    },
    {
      id: "kestrel_pursuit",
      name: "Kestrel Pursuit",
      shipId: "confed_kestrel",
      pilotId: "kestrel_ace",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Fast pursuit build",
      role: "defense",
    },
    {
      id: "kestrel_basic",
      name: "Kestrel Basic",
      shipId: "confed_kestrel",
      pilotId: "kestrel_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  confed_hawk: [
    {
      id: "hawk_assault",
      name: "Hawk Assault",
      shipId: "confed_hawk",
      pilotId: "ironwing_chen",
      upgrades: ["marksman", "heavy_laser_cannon", "seeker_missile"],
      description: "Heavy assault build",
      role: "offense",
    },
    {
      id: "hawk_patrol",
      name: "Hawk Patrol",
      shipId: "confed_hawk",
      pilotId: "hawk_pilot",
      upgrades: ["shield_upgrade", "elusive"],
      description: "Durable patrol fighter",
      role: "defense",
    },
  ],
  confed_eagle: [
    {
      id: "eagle_striker",
      name: "Eagle Striker",
      shipId: "confed_eagle",
      pilotId: "sky_commander_rex",
      upgrades: ["predator", "proton_torpedo", "targeting_astromech"],
      description: "Elite strike fighter",
      role: "offense",
    },
    {
      id: "eagle_defender",
      name: "Eagle Defender",
      shipId: "confed_eagle",
      pilotId: "eagle_pilot",
      upgrades: ["elusive", "repair_astromech", "shield_upgrade"],
      description: "Durable defender build",
      role: "defense",
    },
  ],
  confed_condor: [
    {
      id: "condor_assault",
      name: "Condor Assault",
      shipId: "confed_condor",
      pilotId: "warhawk_santos",
      upgrades: ["marksman", "heavy_laser_cannon", "tactical_officer"],
      description: "Heavy assault fighter",
      role: "offense",
    },
    {
      id: "condor_escort",
      name: "Condor Escort",
      shipId: "confed_condor",
      pilotId: "condor_pilot",
      upgrades: ["shield_upgrade", "elusive"],
      description: "Escort fighter build",
      role: "defense",
    },
  ],
  confed_owl: [
    {
      id: "owl_infiltrator",
      name: "Owl Infiltrator",
      shipId: "confed_owl",
      pilotId: "owl_pilot",
      upgrades: ["phantom_strike", "advanced_sensors", "stealth_device"],
      description: "Stealth infiltrator",
      role: "support",
    },
    {
      id: "owl_scout",
      name: "Owl Scout",
      shipId: "confed_owl",
      pilotId: "owl_pilot",
      upgrades: ["expert_handling", "pattern_analyzer"],
      description: "Recon specialist",
      role: "defense",
    },
  ],
  confed_pelican: [
    {
      id: "pelican_bomber",
      name: "Pelican Bomber",
      shipId: "confed_pelican",
      pilotId: "bomb_master_hayes",
      upgrades: ["proton_torpedo", "proton_bomb"],
      description: "Standard bomber",
      role: "offense",
    },
    {
      id: "pelican_minelayer",
      name: "Pelican Minelayer",
      shipId: "confed_pelican",
      pilotId: "pelican_crew",
      upgrades: ["cluster_mine", "hull_upgrade"],
      description: "Mine deployment",
      role: "support",
    },
  ],
  confed_albatross: [
    {
      id: "albatross_siege",
      name: "Albatross Siege",
      shipId: "confed_albatross",
      pilotId: "thunder_mason",
      upgrades: [
        "proton_torpedo",
        "proton_torpedo",
        "proton_bomb",
        "weapons_engineer",
      ],
      description: "Heavy siege bomber",
      role: "offense",
    },
    {
      id: "albatross_assault",
      name: "Albatross Assault",
      shipId: "confed_albatross",
      pilotId: "albatross_crew",
      upgrades: ["proton_torpedo", "seismic_charge", "hull_upgrade"],
      description: "Assault bomber",
      role: "balanced",
    },
  ],
  confed_thunderbird: [
    {
      id: "thunderbird_fortress",
      name: "Thunderbird Fortress",
      shipId: "confed_thunderbird",
      pilotId: "stormlord_kai",
      upgrades: ["twin_laser_turret", "quad_laser_turret", "veteran_gunner"],
      description: "Heavy gunship",
      role: "offense",
    },
    {
      id: "thunderbird_defender",
      name: "Thunderbird Defender",
      shipId: "confed_thunderbird",
      pilotId: "thunderbird_crew",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive gunship",
      role: "defense",
    },
  ],
  confed_harrier: [
    {
      id: "harrier_strike",
      name: "Harrier Strike",
      shipId: "confed_harrier",
      pilotId: "swooping_death_jin",
      upgrades: ["twin_laser_turret", "heavy_laser_cannon", "seeker_missile"],
      description: "Strike gunship",
      role: "offense",
    },
    {
      id: "harrier_escort",
      name: "Harrier Escort",
      shipId: "confed_harrier",
      pilotId: "harrier_crew",
      upgrades: ["ion_turret", "hull_upgrade"],
      description: "Escort gunship",
      role: "balanced",
    },
  ],
  confed_crane: [
    {
      id: "crane_coordinator",
      name: "Crane Coordinator",
      shipId: "confed_crane",
      pilotId: "crane_crew",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Fleet coordination",
      role: "support",
    },
    {
      id: "crane_support",
      name: "Crane Support",
      shipId: "confed_crane",
      pilotId: "crane_crew",
      upgrades: ["shield_upgrade", "pattern_analyzer"],
      description: "Durable support",
      role: "defense",
    },
  ],
  confed_heron: [
    {
      id: "heron_command",
      name: "Heron Command",
      shipId: "confed_heron",
      pilotId: "heron_crew",
      upgrades: ["hull_upgrade", "tactical_officer", "advanced_sensors"],
      description: "Fleet command ship",
      role: "support",
    },
    {
      id: "heron_relay",
      name: "Heron Relay",
      shipId: "confed_heron",
      pilotId: "heron_crew",
      upgrades: ["advanced_sensors", "pattern_analyzer"],
      description: "Sensor relay",
      role: "support",
    },
  ],
  confed_liberty: [
    {
      id: "liberty_flagship",
      name: "Liberty Flagship",
      shipId: "confed_liberty",
      pilotId: "admiral_freedom",
      upgrades: [
        "quad_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
        "tactical_officer",
      ],
      description: "Fleet flagship",
      role: "offense",
    },
    {
      id: "liberty_command",
      name: "Liberty Command",
      shipId: "confed_liberty",
      pilotId: "liberty_crew",
      upgrades: ["twin_laser_turret", "tactical_officer"],
      description: "Command ship",
      role: "support",
    },
  ],
  confed_independence: [
    {
      id: "independence_carrier",
      name: "Independence Carrier",
      shipId: "confed_independence",
      pilotId: "independence_crew",
      upgrades: ["twin_laser_turret", "tactical_officer", "veteran_gunner"],
      description: "Carrier operations",
      role: "support",
    },
    {
      id: "independence_bastion",
      name: "Independence Bastion",
      shipId: "confed_independence",
      pilotId: "independence_crew",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive capital",
      role: "defense",
    },
  ],
  confed_defiance: [
    {
      id: "defiance_assault",
      name: "Defiance Assault",
      shipId: "confed_defiance",
      pilotId: "hero_of_liberation",
      upgrades: ["quad_laser_turret", "twin_laser_turret", "veteran_gunner"],
      description: "Assault cruiser",
      role: "offense",
    },
    {
      id: "defiance_screen",
      name: "Defiance Screen",
      shipId: "confed_defiance",
      pilotId: "defiance_crew",
      upgrades: ["twin_laser_turret", "shield_upgrade"],
      description: "Fleet screen",
      role: "defense",
    },
  ],

  // ==========================================
  // SYNTHETIC COLLECTIVE LOADOUTS
  // ==========================================

  synth_drone: [
    {
      id: "drone_standard",
      name: "Combat Drone",
      shipId: "synth_drone",
      pilotId: "combat_drone_alpha",
      upgrades: ["jamming_beam"],
      description: "Basic combat drone with ion disruption",
      role: "swarm",
    },
    {
      id: "drone_heavy",
      name: "Heavy Drone",
      shipId: "synth_drone",
      pilotId: "unit_zero",
      upgrades: ["ion_cannon", "hull_upgrade"],
      description: "Enhanced drone with ion cannon",
      role: "offense",
    },
  ],

  synth_hunter: [
    {
      id: "hunter_precision",
      name: "Hunter Precision",
      shipId: "synth_hunter",
      pilotId: "executioner_seven",
      upgrades: ["heavy_laser_cannon", "advanced_sensors", "pattern_analyzer"],
      description: "Precise targeting with heavy firepower",
      role: "offense",
    },
    {
      id: "hunter_disruptor",
      name: "Hunter Disruptor",
      shipId: "synth_hunter",
      pilotId: "hunter_prime",
      upgrades: ["ion_cannon", "advanced_sensors", "pattern_analyzer"],
      description: "Control specialist with ion weapons",
      role: "support",
    },
  ],

  synth_carrier: [
    {
      id: "carrier_command",
      name: "Carrier Command Node",
      shipId: "synth_carrier",
      pilotId: "carrier_node_basic",
      upgrades: ["tactical_officer", "advanced_sensors", "pattern_analyzer"],
      description: "Full coordination suite for drone swarms",
      role: "support",
    },
    {
      id: "carrier_assault",
      name: "Carrier Assault Node",
      shipId: "synth_carrier",
      pilotId: "carrier_node_basic",
      upgrades: [
        "veteran_gunner",
        "ion_turret",
        "hull_upgrade",
        "shield_upgrade",
      ],
      description: "Durable assault platform with turret",
      role: "balanced",
    },
  ],

  synth_destroyer: [
    {
      id: "destroyer_alpha",
      name: "Destroyer Alpha Strike",
      shipId: "synth_destroyer",
      pilotId: "annihilator_nine",
      upgrades: [
        "proton_torpedo",
        "ion_torpedo",
        "heavy_laser_cannon",
        "fire_control_system",
      ],
      description: "Maximum ordnance for capital assault",
      role: "offense",
    },
    {
      id: "destroyer_ion",
      name: "Destroyer Ion Barrage",
      shipId: "synth_destroyer",
      pilotId: "destroyer_protocol",
      upgrades: [
        "ion_torpedo",
        "ion_torpedo",
        "ion_cannon",
        "collision_detector",
      ],
      description: "Ion weapon specialist for disabling targets",
      role: "support",
    },
  ],

  synth_scout_drone: [
    {
      id: "scout_recon",
      name: "Scout Recon",
      shipId: "synth_scout_drone",
      pilotId: "scout_drone_beta",
      upgrades: ["advanced_sensors"],
      description: "Reconnaissance drone",
      role: "support",
    },
    {
      id: "scout_basic",
      name: "Scout Basic",
      shipId: "synth_scout_drone",
      pilotId: "scout_drone_alpha",
      upgrades: [],
      description: "Basic scout",
      role: "swarm",
    },
  ],
  synth_heavy_drone: [
    {
      id: "heavy_assault",
      name: "Heavy Assault Drone",
      shipId: "synth_heavy_drone",
      pilotId: "assault_core",
      upgrades: ["heavy_laser_cannon", "advanced_sensors"],
      description: "Heavy assault drone",
      role: "offense",
    },
    {
      id: "heavy_patrol",
      name: "Heavy Patrol Drone",
      shipId: "synth_heavy_drone",
      pilotId: "heavy_drone_alpha",
      upgrades: ["hull_upgrade"],
      description: "Durable patrol",
      role: "defense",
    },
  ],
  synth_bomber_drone: [
    {
      id: "bomber_strike",
      name: "Bomber Strike Drone",
      shipId: "synth_bomber_drone",
      pilotId: "demolition_unit",
      upgrades: ["proton_torpedo", "proton_bomb"],
      description: "Ordnance drone",
      role: "offense",
    },
    {
      id: "bomber_basic",
      name: "Bomber Basic",
      shipId: "synth_bomber_drone",
      pilotId: "bomber_drone_alpha",
      upgrades: ["proton_torpedo"],
      description: "Basic bomber",
      role: "offense",
    },
  ],
  synth_interceptor_drone: [
    {
      id: "interceptor_hunter",
      name: "Interceptor Hunter",
      shipId: "synth_interceptor_drone",
      pilotId: "pursuit_protocol",
      upgrades: ["ion_cannon", "engine_upgrade"],
      description: "Fast interceptor",
      role: "offense",
    },
    {
      id: "interceptor_swarm",
      name: "Interceptor Swarm",
      shipId: "synth_interceptor_drone",
      pilotId: "interceptor_drone_alpha",
      upgrades: [],
      description: "Swarm interceptor",
      role: "swarm",
    },
  ],
  synth_stalker: [
    {
      id: "stalker_hunter",
      name: "Stalker Hunter",
      shipId: "synth_stalker",
      pilotId: "shadow_hunter",
      upgrades: ["heavy_laser_cannon", "advanced_sensors", "pattern_analyzer"],
      description: "Precision hunter",
      role: "offense",
    },
    {
      id: "stalker_ambush",
      name: "Stalker Ambush",
      shipId: "synth_stalker",
      pilotId: "stalker_protocol",
      upgrades: ["ion_cannon", "pattern_analyzer"],
      description: "Ion ambusher",
      role: "support",
    },
  ],
  synth_ravager: [
    {
      id: "ravager_assault",
      name: "Ravager Assault",
      shipId: "synth_ravager",
      pilotId: "decimator_prime",
      upgrades: ["heavy_laser_cannon", "heavy_laser_cannon"],
      description: "Heavy assault",
      role: "offense",
    },
    {
      id: "ravager_ion",
      name: "Ravager Ion",
      shipId: "synth_ravager",
      pilotId: "ravager_protocol",
      upgrades: ["ion_cannon", "ion_cannon"],
      description: "Ion assault",
      role: "support",
    },
  ],
  synth_predator: [
    {
      id: "predator_strike",
      name: "Predator Strike",
      shipId: "synth_predator",
      pilotId: "apex_hunter",
      upgrades: ["heavy_laser_cannon", "seeker_missile", "fire_control_system"],
      description: "Strike hunter",
      role: "offense",
    },
    {
      id: "predator_patrol",
      name: "Predator Patrol",
      shipId: "synth_predator",
      pilotId: "predator_protocol",
      upgrades: ["ion_cannon", "shield_upgrade"],
      description: "Patrol hunter",
      role: "balanced",
    },
    {
      id: "predator_basic",
      name: "Predator Basic",
      shipId: "synth_predator",
      pilotId: "predator_protocol",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  synth_annihilator: [
    {
      id: "annihilator_alpha",
      name: "Annihilator Alpha",
      shipId: "synth_annihilator",
      pilotId: "extinction_unit",
      upgrades: [
        "proton_torpedo",
        "proton_torpedo",
        "heavy_laser_cannon",
        "heavy_laser_cannon",
      ],
      description: "Maximum firepower",
      role: "offense",
    },
    {
      id: "annihilator_siege",
      name: "Annihilator Siege",
      shipId: "synth_annihilator",
      pilotId: "annihilator_protocol",
      upgrades: ["proton_torpedo", "ion_torpedo", "fire_control_system"],
      description: "Siege destroyer",
      role: "offense",
    },
  ],
  synth_relay_node: [
    {
      id: "relay_coordinator",
      name: "Relay Coordinator",
      shipId: "synth_relay_node",
      pilotId: "relay_node_basic",
      upgrades: ["advanced_sensors", "collision_detector", "pattern_analyzer"],
      description: "Full network coordination",
      role: "support",
    },
    {
      id: "relay_support",
      name: "Relay Support",
      shipId: "synth_relay_node",
      pilotId: "relay_node_basic",
      upgrades: ["shield_upgrade", "advanced_sensors"],
      description: "Enhanced support relay",
      role: "support",
    },
    {
      id: "relay_basic",
      name: "Relay Basic",
      shipId: "synth_relay_node",
      pilotId: "relay_node_basic",
      upgrades: ["advanced_sensors"],
      description: "Basic relay",
      role: "support",
    },
  ],
  synth_repair_node: [
    {
      id: "repair_support",
      name: "Repair Support",
      shipId: "synth_repair_node",
      pilotId: "repair_node_basic",
      upgrades: ["tactical_officer", "advanced_sensors", "pattern_analyzer"],
      description: "Support node",
      role: "support",
    },
    {
      id: "repair_basic",
      name: "Repair Basic",
      shipId: "synth_repair_node",
      pilotId: "repair_node_basic",
      upgrades: ["hull_upgrade"],
      description: "Basic repair",
      role: "defense",
    },
  ],
  synth_devastator: [
    {
      id: "devastator_assault",
      name: "Devastator Assault",
      shipId: "synth_devastator",
      pilotId: "obliterator",
      upgrades: [
        "twin_laser_turret",
        "heavy_laser_cannon",
        "heavy_laser_cannon",
      ],
      description: "Heavy assault",
      role: "offense",
    },
    {
      id: "devastator_ion",
      name: "Devastator Ion",
      shipId: "synth_devastator",
      pilotId: "devastator_protocol",
      upgrades: ["ion_turret", "ion_cannon", "ion_cannon"],
      description: "Ion assault",
      role: "support",
    },
  ],
  synth_eradicator: [
    {
      id: "eradicator_fortress",
      name: "Eradicator Fortress",
      shipId: "synth_eradicator",
      pilotId: "purge_unit",
      upgrades: [
        "twin_laser_turret",
        "quad_laser_turret",
        "heavy_laser_cannon",
      ],
      description: "Fortress gunship",
      role: "offense",
    },
    {
      id: "eradicator_defender",
      name: "Eradicator Defender",
      shipId: "synth_eradicator",
      pilotId: "eradicator_protocol",
      upgrades: ["ion_turret", "ion_turret", "shield_upgrade"],
      description: "Defensive gunship",
      role: "defense",
    },
  ],
  synth_nexus: [
    {
      id: "nexus_command",
      name: "Nexus Command",
      shipId: "synth_nexus",
      pilotId: "nexus_core_basic",
      upgrades: ["quad_laser_turret", "tactical_officer", "veteran_gunner"],
      description: "Fleet command",
      role: "support",
    },
    {
      id: "nexus_assault",
      name: "Nexus Assault",
      shipId: "synth_nexus",
      pilotId: "central_nexus",
      upgrades: ["quad_laser_turret", "heavy_laser_cannon", "veteran_gunner"],
      description: "Assault nexus",
      role: "offense",
    },
  ],
  synth_overmind: [
    {
      id: "overmind_coordinator",
      name: "Overmind Coordinator",
      shipId: "synth_overmind",
      pilotId: "overmind_basic",
      upgrades: ["twin_laser_turret", "tactical_officer", "veteran_gunner"],
      description: "Swarm coordination",
      role: "support",
    },
    {
      id: "overmind_bastion",
      name: "Overmind Bastion",
      shipId: "synth_overmind",
      pilotId: "overmind_basic",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive command",
      role: "defense",
    },
  ],
  synth_terminus: [
    {
      id: "terminus_siege",
      name: "Terminus Siege",
      shipId: "synth_terminus",
      pilotId: "end_protocol",
      upgrades: [
        "quad_laser_turret",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "heavy_laser_cannon",
      ],
      description: "Siege capital",
      role: "offense",
    },
    {
      id: "terminus_assault",
      name: "Terminus Assault",
      shipId: "synth_terminus",
      pilotId: "terminus_core",
      upgrades: ["twin_laser_turret", "heavy_laser_cannon"],
      description: "Assault capital",
      role: "offense",
    },
  ],
  synth_gestalt: [
    {
      id: "gestalt_apex",
      name: "Gestalt Apex",
      shipId: "synth_gestalt",
      pilotId: "apex_gestalt",
      upgrades: [
        "quad_laser_turret",
        "heavy_laser_cannon",
        "skilled_gunner",
        "advanced_sensors",
      ],
      description: "Maximum convergence — all systems unified",
      role: "offense",
    },
    {
      id: "gestalt_fortress",
      name: "Gestalt Fortress",
      shipId: "synth_gestalt",
      pilotId: "gestalt_drone",
      upgrades: ["shield_upgrade", "hull_upgrade", "advanced_sensors"],
      description: "Fortified configuration — nearly impervious",
      role: "defense",
    },
  ],
  synth_conduit: [
    {
      id: "conduit_relay",
      name: "Conduit Relay",
      shipId: "synth_conduit",
      pilotId: "conduit_core",
      upgrades: ["twin_laser_turret", "advanced_sensors", "pattern_analyzer"],
      description: "Network relay",
      role: "support",
    },
    {
      id: "conduit_defense",
      name: "Conduit Defense",
      shipId: "synth_conduit",
      pilotId: "conduit_core",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive relay",
      role: "defense",
    },
  ],

  // ==========================================
  // VOID CORSAIRS LOADOUTS
  // ==========================================

  corsair_blade: [
    // Default build (first): the dice modes fire no ordnance, so the
    // Raider's concussion missile is dead weight there — an expert in the
    // Raider build lost to novice heavies (skill gate 1); the Ace build holds.
    {
      id: "blade_ace",
      name: "Blade Ace",
      shipId: "corsair_blade",
      pilotId: "blade_cutthroat",
      upgrades: ["elusive", "stealth_device"],
      description: "Elusive ace pilot build",
      role: "defense",
    },
    {
      id: "blade_raider",
      name: "Blade Raider",
      shipId: "corsair_blade",
      pilotId: "red_jenna",
      upgrades: ["predator", "concussion_missile", "engine_upgrade"],
      description: "Hit-and-run striker with reinforced hull",
      role: "offense",
    },
  ],

  corsair_marauder: [
    {
      id: "marauder_assault",
      name: "Marauder Assault",
      shipId: "corsair_marauder",
      pilotId: "iron_fist_mora",
      upgrades: ["predator", "heavy_laser_cannon", "seeker_missile"],
      description: "Heavy assault with sustained firepower",
      role: "offense",
    },
    {
      id: "marauder_brawler",
      name: "Marauder Brawler",
      shipId: "corsair_marauder",
      pilotId: "marauder_veteran",
      upgrades: ["marksman", "ion_cannon", "hull_upgrade"],
      description: "Close range brawler with ion disruption",
      role: "balanced",
    },
    {
      id: "marauder_basic",
      name: "Marauder Basic",
      shipId: "corsair_marauder",
      pilotId: "marauder_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],

  corsair_specter: [
    {
      id: "specter_infiltrator",
      name: "Specter Infiltrator",
      shipId: "corsair_specter",
      pilotId: "specter_pilot",
      upgrades: ["phantom_strike", "pattern_analyzer", "tactical_officer"],
      description: "Stealth infiltrator with coordination",
      role: "support",
    },
    {
      id: "specter_assassin",
      name: "Specter Assassin",
      shipId: "corsair_specter",
      pilotId: "ghost_dancer",
      upgrades: ["predator", "stealth_device", "pattern_analyzer"],
      description: "Silent assassin with precise targeting",
      role: "offense",
    },
  ],

  corsair_reaver: [
    {
      id: "reaver_devastator",
      name: "Reaver Devastator",
      shipId: "corsair_reaver",
      pilotId: "bloodaxe_thorne",
      upgrades: [
        "veteran_gunner",
        "twin_laser_turret",
        "quad_laser_turret",
        "heavy_laser_cannon",
      ],
      description: "Maximum firepower assault gunboat",
      role: "offense",
    },
    {
      id: "reaver_boarding",
      name: "Reaver Boarding Party",
      shipId: "corsair_reaver",
      pilotId: "reaver_crew",
      upgrades: [
        "tactical_officer",
        "light_laser_turret",
        "ion_cannon",
        "hull_upgrade",
      ],
      description: "Boarding assault with ion disruption",
      role: "balanced",
    },
  ],

  corsair_fang: [
    {
      id: "fang_raider",
      name: "Fang Raider",
      shipId: "corsair_fang",
      pilotId: "poison_fang",
      upgrades: ["predator", "hull_upgrade"],
      description: "Fast raider with reinforced hull",
      role: "offense",
    },
    {
      id: "fang_predator",
      name: "Fang Predator",
      shipId: "corsair_fang",
      pilotId: "fang_ace",
      upgrades: ["predator"],
      description: "Aggressive strike configuration",
      role: "offense",
    },
    {
      id: "fang_swarm",
      name: "Fang Swarm",
      shipId: "corsair_fang",
      pilotId: "fang_raider",
      upgrades: [],
      description: "Swarm interceptor",
      role: "swarm",
    },
  ],
  corsair_talon: [
    {
      id: "talon_striker",
      name: "Talon Striker",
      shipId: "corsair_talon",
      pilotId: "razor_talon",
      upgrades: ["hull_upgrade", "concussion_missile"],
      description: "Reinforced strike interceptor",
      role: "offense",
    },
    {
      id: "talon_ace",
      name: "Talon Ace",
      shipId: "corsair_talon",
      pilotId: "talon_pilot",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Ace pilot build",
      role: "defense",
    },
    {
      id: "talon_basic",
      name: "Talon Basic",
      shipId: "corsair_talon",
      pilotId: "talon_pilot",
      upgrades: ["hull_upgrade"],
      description: "Bare-bones raider patrol",
      role: "swarm",
    },
  ],
  corsair_venom: [
    {
      id: "venom_assassin",
      name: "Venom Assassin",
      shipId: "corsair_venom",
      pilotId: "deadly_venom",
      upgrades: ["elusive", "hull_upgrade"],
      description: "Nimble assassin with reinforced hull",
      role: "offense",
    },
    {
      id: "venom_swarm",
      name: "Venom Swarm",
      shipId: "corsair_venom",
      pilotId: "venom_pilot",
      upgrades: [],
      description: "Cheap swarm",
      role: "swarm",
    },
  ],
  corsair_cutlass: [
    {
      id: "cutlass_assault",
      name: "Cutlass Assault",
      shipId: "corsair_cutlass",
      pilotId: "bloody_cutlass",
      upgrades: ["marksman", "heavy_laser_cannon", "seeker_missile"],
      description: "Heavy assault",
      role: "offense",
    },
    {
      id: "cutlass_brawler",
      name: "Cutlass Brawler",
      shipId: "corsair_cutlass",
      pilotId: "cutlass_veteran",
      upgrades: ["hull_upgrade", "heavy_laser_cannon"],
      description: "Close range brawler",
      role: "defense",
    },
  ],
  corsair_scimitar: [
    {
      id: "scimitar_torpedo",
      name: "Scimitar Torpedo",
      shipId: "corsair_scimitar",
      pilotId: "whirlwind_scimitar",
      upgrades: ["marksman", "heavy_laser_cannon", "proton_torpedo"],
      description: "Torpedo fighter",
      role: "offense",
    },
    {
      id: "scimitar_assault",
      name: "Scimitar Assault",
      shipId: "corsair_scimitar",
      pilotId: "scimitar_pilot",
      upgrades: ["heavy_laser_cannon", "shield_upgrade"],
      description: "Assault fighter",
      role: "balanced",
    },
  ],
  corsair_saber: [
    {
      id: "saber_duelist",
      name: "Saber Duelist",
      shipId: "corsair_saber",
      pilotId: "saber_master",
      upgrades: ["predator", "heavy_laser_cannon", "stealth_device"],
      description: "Duelist build",
      role: "offense",
    },
    {
      id: "saber_ace",
      name: "Saber Ace",
      shipId: "corsair_saber",
      pilotId: "saber_pilot",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Ace pilot",
      role: "defense",
    },
  ],
  corsair_phantom: [
    {
      id: "phantom_assassin",
      name: "Phantom Assassin",
      shipId: "corsair_phantom",
      pilotId: "phantom_whisper",
      upgrades: ["phantom_strike", "stealth_device", "pattern_analyzer"],
      description: "Silent assassin",
      role: "offense",
    },
    {
      id: "phantom_infiltrator",
      name: "Phantom Infiltrator",
      shipId: "corsair_phantom",
      pilotId: "phantom_pilot",
      upgrades: ["expert_handling", "pattern_analyzer"],
      description: "Infiltrator",
      role: "support",
    },
  ],
  corsair_shadow: [
    {
      id: "shadow_assassin",
      name: "Shadow Assassin",
      shipId: "corsair_shadow",
      pilotId: "death_shadow",
      upgrades: ["phantom_strike", "heavy_laser_cannon", "stealth_device"],
      description: "Heavy assassin",
      role: "offense",
    },
    {
      id: "shadow_ambush",
      name: "Shadow Ambush",
      shipId: "corsair_shadow",
      pilotId: "shadow_pilot",
      upgrades: ["ion_cannon", "pattern_analyzer"],
      description: "Ion ambusher",
      role: "support",
    },
  ],
  corsair_pillager: [
    {
      id: "pillager_fortress",
      name: "Pillager Fortress",
      shipId: "corsair_pillager",
      pilotId: "loot_master_graves",
      upgrades: [
        "twin_laser_turret",
        "quad_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
      ],
      description: "Heavy gunship",
      role: "offense",
    },
    {
      id: "pillager_raider",
      name: "Pillager Raider",
      shipId: "corsair_pillager",
      pilotId: "pillager_crew",
      upgrades: ["twin_laser_turret", "ion_cannon", "hull_upgrade"],
      description: "Raider gunship",
      role: "balanced",
    },
  ],
  corsair_ravager: [
    {
      id: "corsair_ravager_assault",
      name: "Ravager Assault",
      shipId: "corsair_ravager",
      pilotId: "warlord_drake",
      upgrades: [
        "twin_laser_turret",
        "heavy_laser_cannon",
        "heavy_laser_cannon",
        "skilled_gunner",
      ],
      description: "Assault gunship",
      role: "offense",
    },
    {
      id: "corsair_ravager_ion",
      name: "Ravager Ion",
      shipId: "corsair_ravager",
      pilotId: "ravager_crew",
      upgrades: ["ion_turret", "ion_cannon", "hull_upgrade"],
      description: "Ion disruption",
      role: "support",
    },
  ],
  corsair_bomber: [
    {
      id: "bomber_raider",
      name: "Bomber Raider",
      shipId: "corsair_bomber",
      pilotId: "bomb_runner_hex",
      upgrades: ["proton_torpedo", "proton_bomb"],
      description: "Raider bomber",
      role: "offense",
    },
    {
      id: "bomber_minelayer",
      name: "Bomber Minelayer",
      shipId: "corsair_bomber",
      pilotId: "corsair_bomber_crew",
      upgrades: ["cluster_mine", "hull_upgrade"],
      description: "Mine layer",
      role: "support",
    },
  ],
  corsair_torpedo_boat: [
    {
      id: "torpedo_strike",
      name: "Torpedo Strike",
      shipId: "corsair_torpedo_boat",
      pilotId: "torpedo_king_blaze",
      upgrades: ["proton_torpedo", "proton_torpedo"],
      description: "Fast torpedo strike",
      role: "offense",
    },
    {
      id: "torpedo_hunter",
      name: "Torpedo Hunter",
      shipId: "corsair_torpedo_boat",
      pilotId: "torpedo_boat_crew",
      upgrades: ["proton_torpedo", "engine_upgrade"],
      description: "Torpedo hunter",
      role: "offense",
    },
  ],
  corsair_dreadnought: [
    {
      id: "dreadnought_flagship",
      name: "Dreadnought Flagship",
      shipId: "corsair_dreadnought",
      pilotId: "pirate_king_skull",
      upgrades: [
        "quad_laser_turret",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
        "tactical_officer",
      ],
      description: "Pirate flagship",
      role: "offense",
    },
    {
      id: "dreadnought_terror",
      name: "Dreadnought Terror",
      shipId: "corsair_dreadnought",
      pilotId: "dreadnought_crew",
      upgrades: ["quad_laser_turret", "heavy_laser_cannon", "hull_upgrade"],
      description: "Terror ship",
      role: "offense",
    },
  ],
  corsair_galleon: [
    {
      id: "galleon_raider",
      name: "Galleon Raider",
      shipId: "corsair_galleon",
      pilotId: "fleet_master_storm",
      upgrades: [
        "twin_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
        "tactical_officer",
      ],
      description: "Heavy raider",
      role: "offense",
    },
    {
      id: "galleon_cargo",
      name: "Galleon Cargo",
      shipId: "corsair_galleon",
      pilotId: "galleon_crew",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Cargo hauler",
      role: "defense",
    },
  ],
  corsair_frigate: [
    {
      id: "frigate_escort",
      name: "Frigate Escort",
      shipId: "corsair_frigate",
      pilotId: "raider_captain_flint",
      upgrades: ["twin_laser_turret", "heavy_laser_cannon", "veteran_gunner"],
      description: "Escort frigate",
      role: "offense",
    },
    {
      id: "frigate_patrol",
      name: "Frigate Patrol",
      shipId: "corsair_frigate",
      pilotId: "frigate_crew",
      upgrades: ["ion_turret", "shield_upgrade"],
      description: "Patrol frigate",
      role: "balanced",
    },
  ],
  corsair_tender: [
    {
      id: "tender_support",
      name: "Tender Support",
      shipId: "corsair_tender",
      pilotId: "tender_crew",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Fleet support",
      role: "support",
    },
    {
      id: "tender_repair",
      name: "Tender Repair",
      shipId: "corsair_tender",
      pilotId: "tender_crew",
      upgrades: ["shield_upgrade", "hull_upgrade"],
      description: "Repair tender",
      role: "defense",
    },
  ],

  // ==========================================
  // ASCENDANT EMPIRE LOADOUTS
  // ==========================================

  ascendant_seraph: [
    {
      id: "seraph_champion",
      name: "Seraph Champion",
      shipId: "ascendant_seraph",
      pilotId: "seraph_guardian",
      upgrades: [
        "force_sensitive",
        "precognition",
        "advanced_sensors",
        "stealth_device",
      ],
      description: "Force-enhanced elite with precognition",
      role: "defense",
    },
    {
      id: "seraph_warden",
      name: "Seraph Warden",
      shipId: "ascendant_seraph",
      pilotId: "seraph_guardian",
      upgrades: ["elusive", "advanced_sensors", "hull_upgrade"],
      description: "Resilient warden with enhanced defenses",
      role: "defense",
    },
  ],

  ascendant_templar: [
    {
      id: "templar_crusader",
      name: "Templar Crusader",
      shipId: "ascendant_templar",
      pilotId: "crusader_vorn",
      upgrades: [
        "marksman",
        "proton_torpedo",
        "heavy_laser_cannon",
        "fire_control_system",
      ],
      description: "Heavy assault templar with ordnance",
      role: "offense",
    },
    {
      id: "templar_guardian",
      name: "Templar Guardian",
      shipId: "ascendant_templar",
      pilotId: "templar_champion",
      upgrades: ["elusive", "advanced_sensors", "hull_upgrade"],
      description: "Durable guardian with enhanced survivability",
      role: "defense",
    },
  ],

  ascendant_oracle: [
    {
      id: "oracle_seer",
      name: "Oracle Seer",
      shipId: "ascendant_oracle",
      pilotId: "oracle_acolyte",
      upgrades: [
        "coordinated_assault",
        "tactical_officer",
        "advanced_sensors",
        "pattern_analyzer",
      ],
      description: "Full coordination oracle with squad enhancement",
      role: "support",
    },
    {
      id: "oracle_shield",
      name: "Oracle Shield",
      shipId: "ascendant_oracle",
      pilotId: "oracle_acolyte",
      upgrades: ["shield_upgrade", "collision_detector", "elusive"],
      description: "Maximum durability support platform",
      role: "defense",
    },
  ],

  ascendant_avatar: [
    {
      id: "avatar_conquest",
      name: "Avatar of Conquest",
      shipId: "ascendant_avatar",
      pilotId: "warlord_darius",
      upgrades: [
        "veteran_gunner",
        "quad_laser_turret",
        "heavy_laser_cannon",
        "ion_cannon",
        "ace_pilot_title",
      ],
      description: "Elite assault platform with full weapons",
      role: "offense",
    },
    {
      id: "avatar_bastion",
      name: "Avatar Bastion",
      shipId: "ascendant_avatar",
      pilotId: "avatar_crew",
      upgrades: [
        "tactical_officer",
        "ion_turret",
        "shield_upgrade",
        "hull_upgrade",
      ],
      description: "Durable command platform with support",
      role: "balanced",
    },
  ],

  ascendant_cherub: [
    {
      id: "cherub_ace",
      name: "Cherub Ace",
      shipId: "ascendant_cherub",
      pilotId: "cherub_guardian",
      upgrades: ["elusive", "hull_upgrade"],
      description: "Nimble ace with reinforced hull",
      role: "defense",
    },
    {
      id: "cherub_swarm",
      name: "Cherub Swarm",
      shipId: "ascendant_cherub",
      pilotId: "cherub_initiate",
      upgrades: [],
      description: "Swarm interceptor",
      role: "swarm",
    },
  ],
  ascendant_herald: [
    {
      id: "herald_striker",
      name: "Herald Striker",
      shipId: "ascendant_herald",
      pilotId: "voice_of_glory",
      upgrades: ["predator", "shield_upgrade"],
      description: "Strike interceptor with shielding",
      role: "offense",
    },
    {
      id: "herald_scout",
      name: "Herald Scout",
      shipId: "ascendant_herald",
      pilotId: "herald_pilot",
      upgrades: ["advanced_sensors", "engine_upgrade"],
      description: "Scout build",
      role: "support",
    },
  ],
  ascendant_virtue: [
    {
      id: "virtue_assault",
      name: "Virtue Assault",
      shipId: "ascendant_virtue",
      pilotId: "righteous_fury",
      upgrades: ["predator", "concussion_missile", "stealth_device"],
      description: "Assault interceptor",
      role: "offense",
    },
    {
      id: "virtue_pursuit",
      name: "Virtue Pursuit",
      shipId: "ascendant_virtue",
      pilotId: "virtue_pilot",
      upgrades: ["elusive", "engine_upgrade"],
      description: "Pursuit interceptor",
      role: "defense",
    },
    {
      id: "virtue_basic",
      name: "Virtue Basic",
      shipId: "ascendant_virtue",
      pilotId: "virtue_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  ascendant_crusader: [
    {
      id: "crusader_assault",
      name: "Crusader Assault",
      shipId: "ascendant_crusader",
      pilotId: "holy_avenger",
      upgrades: ["marksman", "heavy_laser_cannon", "heavy_laser_cannon"],
      description: "Heavy assault",
      role: "offense",
    },
    {
      id: "crusader_defender",
      name: "Crusader Defender",
      shipId: "ascendant_crusader",
      pilotId: "crusader_champion",
      upgrades: ["heavy_laser_cannon", "hull_upgrade"],
      description: "Defender build",
      role: "defense",
    },
    {
      id: "crusader_basic",
      name: "Crusader Basic",
      shipId: "ascendant_crusader",
      pilotId: "crusader_pilot",
      upgrades: ["hull_upgrade"],
      description: "Standard patrol configuration",
      role: "defense",
    },
  ],
  ascendant_paladin: [
    {
      id: "paladin_champion",
      name: "Paladin Champion",
      shipId: "ascendant_paladin",
      pilotId: "shield_of_faith",
      upgrades: ["predator", "heavy_laser_cannon", "tactical_officer"],
      description: "Champion build",
      role: "offense",
    },
    {
      id: "paladin_guardian",
      name: "Paladin Guardian",
      shipId: "ascendant_paladin",
      pilotId: "paladin_pilot",
      upgrades: ["elusive", "shield_upgrade"],
      description: "Guardian build",
      role: "defense",
    },
  ],
  ascendant_inquisitor: [
    {
      id: "inquisitor_hunter",
      name: "Inquisitor Hunter",
      shipId: "ascendant_inquisitor",
      pilotId: "grand_inquisitor",
      upgrades: ["predator", "heavy_laser_cannon", "pattern_analyzer"],
      description: "Hunter build",
      role: "offense",
    },
    {
      id: "inquisitor_interrogator",
      name: "Inquisitor Interrogator",
      shipId: "ascendant_inquisitor",
      pilotId: "inquisitor_pilot",
      upgrades: ["ion_cannon", "pattern_analyzer"],
      description: "Control build",
      role: "support",
    },
  ],
  ascendant_prophet: [
    {
      id: "prophet_seer",
      name: "Prophet Seer",
      shipId: "ascendant_prophet",
      pilotId: "prophet_acolyte",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Fleet coordination",
      role: "support",
    },
    {
      id: "prophet_bastion",
      name: "Prophet Bastion",
      shipId: "ascendant_prophet",
      pilotId: "prophet_acolyte",
      upgrades: ["shield_upgrade", "pattern_analyzer"],
      description: "Defensive support",
      role: "defense",
    },
  ],
  ascendant_acolyte: [
    {
      id: "acolyte_support",
      name: "Acolyte Support",
      shipId: "ascendant_acolyte",
      pilotId: "acolyte_pilot",
      upgrades: ["tactical_officer", "advanced_sensors"],
      description: "Basic support",
      role: "support",
    },
    {
      id: "acolyte_relay",
      name: "Acolyte Relay",
      shipId: "ascendant_acolyte",
      pilotId: "acolyte_pilot",
      upgrades: ["pattern_analyzer"],
      description: "Relay support",
      role: "support",
    },
  ],
  ascendant_wrath: [
    {
      id: "wrath_assault",
      name: "Wrath Assault",
      shipId: "ascendant_wrath",
      pilotId: "fury_incarnate",
      upgrades: [
        "twin_laser_turret",
        "heavy_laser_cannon",
        "heavy_laser_cannon",
        "skilled_gunner",
      ],
      description: "Heavy assault",
      role: "offense",
    },
    {
      id: "wrath_ion",
      name: "Wrath Ion",
      shipId: "ascendant_wrath",
      pilotId: "wrath_pilot",
      upgrades: ["ion_turret", "ion_cannon", "hull_upgrade"],
      description: "Ion disruption",
      role: "support",
    },
  ],
  ascendant_judgment: [
    {
      id: "judgment_fortress",
      name: "Judgment Fortress",
      shipId: "ascendant_judgment",
      pilotId: "divine_sentence",
      upgrades: [
        "twin_laser_turret",
        "quad_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
      ],
      description: "Heavy gunship",
      role: "offense",
    },
    {
      id: "judgment_defender",
      name: "Judgment Defender",
      shipId: "ascendant_judgment",
      pilotId: "judgment_crew",
      upgrades: ["ion_turret", "ion_turret", "shield_upgrade"],
      description: "Defensive gunship",
      role: "defense",
    },
  ],
  ascendant_smiter: [
    {
      id: "smiter_bomber",
      name: "Smiter Bomber",
      shipId: "ascendant_smiter",
      pilotId: "wrath_of_heaven",
      upgrades: ["proton_torpedo", "proton_bomb"],
      description: "Standard bomber",
      role: "offense",
    },
    {
      id: "smiter_strike",
      name: "Smiter Strike",
      shipId: "ascendant_smiter",
      pilotId: "smiter_crew",
      upgrades: ["proton_torpedo", "hull_upgrade"],
      description: "Fast strike bomber",
      role: "offense",
    },
  ],
  ascendant_purifier: [
    {
      id: "purifier_siege",
      name: "Purifier Siege",
      shipId: "ascendant_purifier",
      pilotId: "cleansing_fire",
      upgrades: [
        "proton_torpedo",
        "proton_torpedo",
        "proton_bomb",
        "weapons_engineer",
      ],
      description: "Heavy siege bomber",
      role: "offense",
    },
    {
      id: "purifier_assault",
      name: "Purifier Assault",
      shipId: "ascendant_purifier",
      pilotId: "purifier_crew",
      upgrades: ["proton_torpedo", "seismic_charge", "hull_upgrade"],
      description: "Assault bomber",
      role: "balanced",
    },
  ],
  ascendant_divine: [
    {
      id: "divine_flagship",
      name: "Divine Flagship",
      shipId: "ascendant_divine",
      pilotId: "hand_of_the_divine",
      upgrades: [
        "quad_laser_turret",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
        "tactical_officer",
      ],
      description: "Supreme flagship",
      role: "offense",
    },
    {
      id: "divine_command",
      name: "Divine Command",
      shipId: "ascendant_divine",
      pilotId: "divine_crew",
      upgrades: ["twin_laser_turret", "tactical_officer", "veteran_gunner"],
      description: "Command vessel",
      role: "support",
    },
  ],
  ascendant_glory: [
    {
      id: "glory_assault",
      name: "Glory Assault",
      shipId: "ascendant_glory",
      pilotId: "light_of_glory",
      upgrades: [
        "quad_laser_turret",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
      ],
      description: "Assault capital",
      role: "offense",
    },
    {
      id: "glory_bastion",
      name: "Glory Bastion",
      shipId: "ascendant_glory",
      pilotId: "glory_crew",
      upgrades: ["twin_laser_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive capital",
      role: "defense",
    },
  ],
  ascendant_sanctum: [
    {
      id: "sanctum_command",
      name: "Sanctum Command",
      shipId: "ascendant_sanctum",
      pilotId: "sanctum_crew",
      upgrades: [
        "twin_laser_turret",
        "tactical_officer",
        "veteran_gunner",
        "advanced_sensors",
      ],
      description: "Command capital",
      role: "support",
    },
    {
      id: "sanctum_support",
      name: "Sanctum Support",
      shipId: "ascendant_sanctum",
      pilotId: "sanctum_crew",
      upgrades: ["ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Support capital",
      role: "defense",
    },
  ],
  ascendant_bastion: [
    {
      id: "asc_bastion_fortress",
      name: "Bastion Fortress",
      shipId: "ascendant_bastion",
      pilotId: "fortress_of_faith",
      upgrades: [
        "quad_laser_turret",
        "twin_laser_turret",
        "heavy_laser_cannon",
        "veteran_gunner",
      ],
      description: "Fortress capital",
      role: "offense",
    },
    {
      id: "asc_bastion_defender",
      name: "Bastion Defender",
      shipId: "ascendant_bastion",
      pilotId: "bastion_empire_crew",
      upgrades: ["ion_turret", "ion_turret", "shield_upgrade", "hull_upgrade"],
      description: "Defensive capital",
      role: "defense",
    },
  ],
};

/**
 * The authored builds of every source, per ship: the catalogue above first
 * (so each ship's default quick build is unchanged), then the roster builds
 * that fly every remaining pilot and card (src/data/loadouts/).
 *
 * @param sources - Build sets keyed by ship id, in priority order.
 * @returns One blueprint list per ship.
 */
function mergeBlueprints(
  ...sources: ReadonlyArray<BlueprintsByShip>
): Record<string, LoadoutBlueprint[]> {
  const merged: Record<string, LoadoutBlueprint[]> = {};
  for (const source of sources) {
    for (const [shipId, blueprints] of Object.entries(source)) {
      merged[shipId] = [...(merged[shipId] ?? []), ...blueprints];
    }
  }
  return merged;
}

/**
 * Every pre-built loadout, priced from its contents.
 *
 * Built once at module load by running each blueprint through
 * `deriveLoadoutCost`, so `pointCost` can never disagree with `upgrades`.
 */
export const SHIP_LOADOUTS: Record<string, ShipLoadout[]> = Object.fromEntries(
  Object.entries(mergeBlueprints(LOADOUT_BLUEPRINTS, ROSTER_BLUEPRINTS)).map(
    ([shipId, blueprints]) => [
      shipId,
      blueprints.map((blueprint) => ({
        ...blueprint,
        pointCost: deriveLoadoutCost(
          blueprint.shipId,
          blueprint.upgrades,
          blueprint.pilotId,
        ),
      })),
    ],
  ),
);

// ============================================
// Helper Functions
// ============================================

/**
 * Get all loadouts for a ship
 */
export function getShipLoadouts(shipId: string): ShipLoadout[] {
  return SHIP_LOADOUTS[shipId] ?? [];
}

/**
 * Loadouts worth offering the player as a choice.
 *
 * A few ships carry a "swarm" loadout that equips nothing at all. It costs the
 * bare hull price, so listing it alongside the BASE option showed the same ship
 * at the same price twice. Squadron presets still reference these by id, so
 * they stay in the data and are only hidden from the picker.
 *
 * @param shipId - Ship whose loadouts to offer.
 * @returns Loadouts that equip at least one upgrade.
 */
export function getEquippableLoadouts(shipId: string): ShipLoadout[] {
  return getShipLoadouts(shipId).filter(
    (loadout) => loadout.upgrades.length > 0,
  );
}

/**
 * Get a specific loadout by ID
 */
export function getLoadoutById(loadoutId: string): ShipLoadout | undefined {
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    const found = loadouts.find((l) => l.id === loadoutId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get loadouts by role
 */
export function getLoadoutsByRole(role: ShipLoadout["role"]): ShipLoadout[] {
  const result: ShipLoadout[] = [];
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    result.push(...loadouts.filter((l) => l.role === role));
  }
  return result;
}

/**
 * Get loadouts within a point budget
 */
export function getLoadoutsByBudget(maxPoints: number): ShipLoadout[] {
  const result: ShipLoadout[] = [];
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    result.push(...loadouts.filter((l) => l.pointCost <= maxPoints));
  }
  return result;
}

/**
 * Get recommended loadout for AI based on faction and role
 */
export function getAILoadout(
  shipId: string,
  preference: "offense" | "defense" | "balanced" = "balanced",
): ShipLoadout | undefined {
  const loadouts = SHIP_LOADOUTS[shipId];
  if (!loadouts || loadouts.length === 0) return undefined;

  // Try to find matching preference
  const preferred = loadouts.find((l) => l.role === preference);
  if (preferred) return preferred;

  // Fall back to first loadout
  return loadouts[0];
}

/**
 * Calculate total squad cost for a list of loadouts
 */
export function calculateSquadCost(loadoutIds: string[]): number {
  return loadoutIds.reduce((total, id) => {
    const loadout = getLoadoutById(id);
    return total + (loadout?.pointCost ?? 0);
  }, 0);
}

/**
 * Build a random balanced squad within point limit
 */
export function buildRandomSquad(
  faction: string,
  pointLimit: number,
  preferredRole?: ShipLoadout["role"],
): ShipLoadout[] {
  const squad: ShipLoadout[] = [];
  let remainingPoints = pointLimit;

  // Get all loadouts for this faction (by ship faction)
  const factionLoadouts: ShipLoadout[] = [];
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    // We'd need to check ship faction here - simplified for now
    factionLoadouts.push(...loadouts);
  }

  // Filter by budget
  const affordable = factionLoadouts.filter(
    (l) => l.pointCost <= remainingPoints,
  );

  // Sort by preference
  const sorted = [...affordable].sort((a, b) => {
    if (preferredRole) {
      if (a.role === preferredRole && b.role !== preferredRole) return -1;
      if (b.role === preferredRole && a.role !== preferredRole) return 1;
    }
    return b.pointCost - a.pointCost; // Prefer higher cost (better equipped)
  });

  // Fill squad
  for (const loadout of sorted) {
    if (loadout.pointCost <= remainingPoints) {
      squad.push(loadout);
      remainingPoints -= loadout.pointCost;

      // Limit squad size
      if (squad.length >= 8) break;
    }
  }

  return squad;
}

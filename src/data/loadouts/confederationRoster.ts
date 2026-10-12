/**
 * Roster quick builds — Free Confederation: one build for every
 * Confederation pilot the original catalogue left grounded.
 */

import type { BlueprintsByShip } from "./loadoutTypes";

export const CONFEDERATION_ROSTER: BlueprintsByShip = {
  confed_sparrow: [
    {
      id: "sparrow_swift",
      name: "Sparrow Swift",
      shipId: "confed_sparrow",
      pilotId: "swift_sara",
      upgrades: ["daredevil", "seeker_missile", "vectored_thrusters"],
      description: "Swift Sara boosts in, fires and is gone",
      role: "offense",
    },
  ],
  confed_falcon: [
    {
      id: "falcon_storm",
      name: "Falcon Storm",
      shipId: "confed_falcon",
      pilotId: "storm_keller",
      upgrades: ["marksman", "flight_astromech", "evasion_configuration"],
      description: "Storm Keller dances through crossfire",
      role: "defense",
    },
  ],
  confed_phoenix: [
    {
      id: "phoenix_firebird",
      name: "Phoenix Firebird",
      shipId: "confed_phoenix",
      pilotId: "firebird_quinn",
      upgrades: ["quad_laser_turret", "skilled_gunner", "expert_handling"],
      description: "Firebird Quinn's turret gunship",
      role: "offense",
    },
  ],
  confed_wasp: [
    {
      id: "wasp_picket",
      name: "Wasp Picket",
      shipId: "confed_wasp",
      pilotId: "wasp_rookie",
      upgrades: ["vectored_thrusters"],
      description: "Cheap rookie picket",
      role: "swarm",
    },
    {
      id: "wasp_stinger",
      name: "Wasp Stinger",
      shipId: "confed_wasp",
      pilotId: "stinger_webb",
      upgrades: ["elusive", "squadron_leader"],
      description: "Stinger Webb rolls away from every shot",
      role: "defense",
    },
  ],
  confed_finch: [
    {
      id: "finch_scout_master",
      name: "Finch Scout Master",
      shipId: "confed_finch",
      pilotId: "scout_master_piper",
      upgrades: ["advanced_sensors", "collision_detector"],
      description: "Piper reads the enemy's moves for the wing",
      role: "support",
    },
  ],
  confed_hawk: [
    {
      id: "hawk_ion_veteran",
      name: "Hawk Ion Veteran",
      shipId: "confed_hawk",
      pilotId: "hawk_veteran",
      upgrades: ["ion_cannon", "concussion_missile"],
      description: "Veteran striker with ion cannon and missiles",
      role: "offense",
    },
  ],
  confed_owl: [
    {
      id: "owl_night_hunter",
      name: "Owl Night Hunter",
      shipId: "confed_owl",
      pilotId: "night_hunter_nova",
      upgrades: ["phantom_strike", "expert_handling", "stealth_device"],
      description: "Nova strikes from cloak and from behind",
      role: "offense",
    },
  ],
  confed_crane: [
    {
      id: "crane_mercy",
      name: "Crane Mercy",
      shipId: "confed_crane",
      pilotId: "mercy_pilot_lee",
      upgrades: ["mechanic", "advanced_sensors", "hull_upgrade"],
      description: "Lee covers allies under fire",
      role: "support",
    },
  ],
  confed_heron: [
    {
      id: "heron_medic",
      name: "Heron Medic",
      shipId: "confed_heron",
      pilotId: "chief_medic_strand",
      upgrades: ["mechanic", "shield_upgrade", "hull_upgrade"],
      description: "Strand recharges allies' shields",
      role: "support",
    },
  ],
  confed_independence: [
    {
      id: "independence_rally",
      name: "Independence Rally",
      shipId: "confed_independence",
      pilotId: "rebel_commander_blake",
      upgrades: ["quad_laser_turret", "veteran_gunner", "mechanic"],
      description: "Blake rallies the fleet around the carrier",
      role: "support",
    },
  ],
};

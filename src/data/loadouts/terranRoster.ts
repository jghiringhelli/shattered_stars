/**
 * Roster quick builds — Terran Hegemony: one build for every Hegemony pilot
 * the original catalogue left grounded, so each pilot card is playable.
 * Prices are derived (loadoutPricing); legality and reach are tested
 * (ShipLoadouts.test.ts, QuickBuildReach.test.ts).
 */

import type { BlueprintsByShip } from "./loadoutTypes";

export const TERRAN_ROSTER: BlueprintsByShip = {
  terran_viper: [
    {
      id: "viper_null_sentinel",
      name: "Null Sentinel",
      shipId: "terran_viper",
      pilotId: "whisper_null",
      upgrades: [
        "squadron_leader",
        "concussion_missile",
        "targeting_computer",
        "shield_upgrade",
      ],
      description: "Whisper Null holds the line and tracks her missiles home",
      role: "defense",
    },
  ],
  terran_gladius: [
    {
      id: "gladius_torpedo_veteran",
      name: "Gladius Torpedo Veteran",
      shipId: "terran_gladius",
      pilotId: "gladius_veteran",
      upgrades: ["proton_torpedo", "fire_control_system"],
      description: "Veteran torpedo run with a quick reload",
      role: "offense",
    },
  ],
  terran_hammer: [
    {
      id: "hammer_demolisher",
      name: "Hammer Demolisher",
      shipId: "terran_hammer",
      pilotId: "captain_demolisher",
      upgrades: ["bombardier", "proton_torpedo", "seismic_charge"],
      description: "Captain Demolisher reloads ordnance fast",
      role: "offense",
    },
  ],
  terran_sentinel: [
    {
      id: "sentinel_admiral",
      name: "Sentinel Admiral",
      shipId: "terran_sentinel",
      pilotId: "admiral_kaine",
      upgrades: ["mechanic", "collision_detector", "shield_upgrade"],
      description: "Admiral Kaine coordinates the wing's fire",
      role: "support",
    },
  ],
  terran_stiletto: [
    {
      id: "stiletto_picket",
      name: "Stiletto Picket",
      shipId: "terran_stiletto",
      pilotId: "stiletto_cadet",
      upgrades: ["vectored_thrusters"],
      description: "Cheap cadet picket that rolls out of trouble",
      role: "swarm",
    },
    {
      id: "stiletto_dash",
      name: "Stiletto Dash",
      shipId: "terran_stiletto",
      pilotId: "viper_dash",
      upgrades: ["daredevil", "expert_handling"],
      description: "Viper Dash turns on a coin",
      role: "offense",
    },
  ],
  terran_centurion: [
    {
      id: "centurion_jammer",
      name: "Centurion Jammer",
      shipId: "terran_centurion",
      pilotId: "centurion_pilot",
      upgrades: ["jamming_beam", "hull_upgrade"],
      description: "Line pilot rattling enemy aces",
      role: "balanced",
    },
  ],
  terran_praetorian: [
    {
      id: "praetorian_ion_line",
      name: "Praetorian Ion Line",
      shipId: "terran_praetorian",
      pilotId: "praetorian_pilot",
      upgrades: ["ion_cannon", "combat_configuration"],
      description: "Aggressive ion-cannon line fighter",
      role: "offense",
    },
  ],
  terran_javelin: [
    {
      id: "javelin_ion_crew",
      name: "Javelin Ion Crew",
      shipId: "terran_javelin",
      pilotId: "javelin_crew",
      upgrades: ["ion_torpedo", "hull_upgrade"],
      description: "Ion torpedoes to stress the target",
      role: "support",
    },
  ],
  terran_guardian: [
    {
      id: "guardian_shield_commander",
      name: "Guardian Shield Commander",
      shipId: "terran_guardian",
      pilotId: "shield_commander_ross",
      upgrades: ["mechanic", "shield_upgrade", "advanced_sensors"],
      description: "Ross recharges the shields of nearby allies",
      role: "support",
    },
  ],
  terran_harbinger: [
    {
      id: "harbinger_fleet_admiral",
      name: "Harbinger Fleet Admiral",
      shipId: "terran_harbinger",
      pilotId: "fleet_admiral_cross",
      upgrades: ["mechanic", "pattern_analyzer", "hull_upgrade"],
      description: "Cross keeps the wing calm under fire",
      role: "support",
    },
  ],
  terran_dominator: [
    {
      id: "dominator_conqueror",
      name: "Dominator Conqueror",
      shipId: "terran_dominator",
      pilotId: "conqueror_prime",
      upgrades: ["quad_laser_turret", "skilled_gunner", "veteran_gunner"],
      description: "Conqueror Prime's gun deck",
      role: "offense",
    },
  ],
  terran_consul: [
    {
      id: "consul_high_command",
      name: "Consul High Command",
      shipId: "terran_consul",
      pilotId: "high_consul_vera",
      upgrades: ["mechanic", "advanced_sensors", "shield_upgrade"],
      description: "Vera directs the fleet's focus",
      role: "support",
    },
  ],
};

/**
 * Roster quick builds — Synthetic Collective: one build for every
 * Collective pilot the original catalogue left grounded, plus the cheap
 * drone builds that make the Collective a swarm (initiative 1–2 drones with
 * one 1-point Swarm Uplink).
 */

import type { BlueprintsByShip } from "./loadoutTypes";

export const SYNTHETIC_ROSTER: BlueprintsByShip = {
  synth_scout_drone: [
    {
      id: "scout_swarm_picket",
      name: "Scout Swarm Picket",
      shipId: "synth_scout_drone",
      pilotId: "scout_drone_alpha",
      upgrades: ["swarm_uplink"],
      description: "The cheapest drone in the swarm",
      role: "swarm",
    },
    {
      id: "scout_observer",
      name: "Scout Observer",
      shipId: "synth_scout_drone",
      pilotId: "observer_prime",
      upgrades: ["advanced_sensors", "collision_detector"],
      description: "Observer Prime marks targets for the whole swarm",
      role: "support",
    },
  ],
  synth_drone: [
    {
      id: "drone_swarm_uplink",
      name: "Drone Swarm Uplink",
      shipId: "synth_drone",
      pilotId: "combat_drone_beta",
      upgrades: ["swarm_uplink"],
      description: "Linked combat drone, cheap enough to field in numbers",
      role: "swarm",
    },
  ],
  synth_heavy_drone: [
    {
      id: "heavy_drone_linked",
      name: "Heavy Drone Linked",
      shipId: "synth_heavy_drone",
      pilotId: "heavy_drone_beta",
      upgrades: ["jamming_beam", "swarm_uplink"],
      description: "Linked heavy drone that rattles its targets",
      role: "swarm",
    },
  ],
  synth_interceptor_drone: [
    {
      id: "interceptor_swarm_uplink",
      name: "Interceptor Swarm Uplink",
      shipId: "synth_interceptor_drone",
      pilotId: "interceptor_drone_alpha",
      upgrades: ["swarm_uplink"],
      description: "Linked interceptor drone",
      role: "swarm",
    },
    {
      id: "interceptor_overdrive",
      name: "Interceptor Overdrive",
      shipId: "synth_interceptor_drone",
      pilotId: "interceptor_drone_beta",
      upgrades: ["combat_configuration", "vectored_thrusters"],
      description: "Overdriven guns, rolls out of the return fire",
      role: "offense",
    },
  ],
  synth_hunter: [
    {
      id: "hunter_evasion_protocol",
      name: "Hunter Evasion Protocol",
      shipId: "synth_hunter",
      pilotId: "hunter_protocol",
      upgrades: ["jamming_beam", "evasion_configuration"],
      description: "Evasive hunter that rattles its prey",
      role: "defense",
    },
  ],
  synth_carrier: [
    {
      id: "carrier_nexus",
      name: "Carrier Nexus",
      shipId: "synth_carrier",
      pilotId: "nexus_core",
      upgrades: ["twin_laser_turret", "skilled_gunner", "mechanic"],
      description: "Nexus Core links the swarm around its carrier",
      role: "support",
    },
    {
      id: "carrier_overmind",
      name: "Carrier Overmind",
      shipId: "synth_carrier",
      pilotId: "overmind_alpha",
      upgrades: ["quad_laser_turret", "veteran_gunner", "shield_upgrade"],
      description: "Overmind Alpha's gun carrier",
      role: "offense",
    },
  ],
  synth_relay_node: [
    {
      id: "relay_data_link",
      name: "Relay Data Link",
      shipId: "synth_relay_node",
      pilotId: "command_relay",
      upgrades: ["collision_detector", "pattern_analyzer", "hull_upgrade"],
      description: "Command Relay widens the hive link",
      role: "support",
    },
  ],
  synth_repair_node: [
    {
      id: "repair_restoration",
      name: "Repair Restoration",
      shipId: "synth_repair_node",
      pilotId: "restoration_core",
      upgrades: ["mechanic", "advanced_sensors", "hull_upgrade"],
      description: "Restoration Core regenerates and patches itself",
      role: "support",
    },
  ],
  synth_overmind: [
    {
      id: "overmind_supreme",
      name: "Overmind Supreme",
      shipId: "synth_overmind",
      pilotId: "supreme_overmind",
      upgrades: [
        "quad_laser_turret",
        "veteran_gunner",
        "skilled_gunner",
        "mechanic",
      ],
      description: "The Supreme Overmind's command ship",
      role: "offense",
    },
  ],
  synth_conduit: [
    {
      id: "conduit_prime",
      name: "Conduit Prime",
      shipId: "synth_conduit",
      pilotId: "prime_conduit",
      upgrades: ["quad_laser_turret", "mechanic", "hull_upgrade"],
      description: "Prime Conduit networks the swarm's aim",
      role: "support",
    },
  ],
};

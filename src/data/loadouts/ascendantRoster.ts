/**
 * Roster quick builds — Ascendant Empire: one build for every Ascendant
 * pilot the original catalogue left grounded, each Force pilot flying one
 * of the Force powers (src/data/upgrades/forcePowers.ts).
 */

import type { BlueprintsByShip } from "./loadoutTypes";

export const ASCENDANT_ROSTER: BlueprintsByShip = {
  ascendant_seraph: [
    {
      id: "seraph_initiate_roll",
      name: "Seraph Initiate",
      shipId: "ascendant_seraph",
      pilotId: "seraph_initiate",
      upgrades: ["vectored_thrusters"],
      description: "Initiate interceptor that rolls clear of fire",
      role: "defense",
    },
    {
      id: "seraph_divine",
      name: "Seraph Divine",
      shipId: "ascendant_seraph",
      pilotId: "divine_seraphina",
      upgrades: ["foresight", "daredevil", "expert_handling"],
      description: "Seraphina foresees every shot and turns inside it",
      role: "defense",
    },
    {
      id: "seraph_archon",
      name: "Seraph Archon",
      shipId: "ascendant_seraph",
      pilotId: "archon_prime",
      upgrades: [
        "righteous_wrath",
        "marksman",
        "combat_configuration",
        "shield_upgrade",
      ],
      description: "Archon Prime hits harder the more he is hurt",
      role: "offense",
    },
  ],
  ascendant_templar: [
    {
      id: "templar_ion_knight",
      name: "Templar Ion Knight",
      shipId: "ascendant_templar",
      pilotId: "templar_knight",
      upgrades: ["ion_torpedo", "jamming_beam"],
      description: "Knight that stresses targets for the wing",
      role: "support",
    },
  ],
  ascendant_cherub: [
    {
      id: "cherub_picket",
      name: "Cherub Picket",
      shipId: "ascendant_cherub",
      pilotId: "cherub_initiate",
      upgrades: ["hull_upgrade"],
      description: "Armoured initiate picket",
      role: "swarm",
    },
    {
      id: "cherub_divine_light",
      name: "Cherub Divine Light",
      shipId: "ascendant_cherub",
      pilotId: "divine_light",
      upgrades: ["foresight", "squadron_leader"],
      description: "Divine Light dodges the shots she foresees",
      role: "defense",
    },
  ],
  ascendant_oracle: [
    {
      id: "oracle_high_seer",
      name: "Oracle High Seer",
      shipId: "ascendant_oracle",
      pilotId: "high_seer_mira",
      upgrades: ["mending_light", "mechanic", "shield_upgrade"],
      description: "Mira heals and calms every ally around her",
      role: "support",
    },
  ],
  ascendant_avatar: [
    {
      id: "avatar_grand",
      name: "Avatar Grand",
      shipId: "ascendant_avatar",
      pilotId: "grand_avatar",
      upgrades: [
        "battle_meditation",
        "twin_laser_turret",
        "skilled_gunner",
        "heavy_laser_cannon",
      ],
      description: "The Grand Avatar guides the wing's aim",
      role: "offense",
    },
  ],
  ascendant_prophet: [
    {
      id: "prophet_vision",
      name: "Prophet Vision",
      shipId: "ascendant_prophet",
      pilotId: "vision_of_doom",
      upgrades: ["battle_meditation", "mechanic", "advanced_sensors"],
      description: "Vision of Doom guides allies' fire and stresses foes",
      role: "support",
    },
  ],
  ascendant_acolyte: [
    {
      id: "acolyte_blessed",
      name: "Acolyte Blessed",
      shipId: "ascendant_acolyte",
      pilotId: "blessed_healer",
      upgrades: ["mending_light", "mechanic"],
      description: "The Blessed Healer mends allies' shields",
      role: "support",
    },
  ],
  ascendant_sanctum: [
    {
      id: "sanctum_high_priest",
      name: "Sanctum High Priest",
      shipId: "ascendant_sanctum",
      pilotId: "high_priest",
      upgrades: [
        "mending_light",
        "quad_laser_turret",
        "veteran_gunner",
        "mechanic",
      ],
      description: "The High Priest's sanctuary ship",
      role: "support",
    },
  ],
};

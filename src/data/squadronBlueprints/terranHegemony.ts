import type { SquadBlueprint } from "./types";

/** Quick-build squads of terran hegemony. */
export const TERRAN_HEGEMONY_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
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
    // Identity: Kane (elite ace, Hold the Line) leading a disciplined line
    // under Coordinated Fire. Four hulls, not three: a 3-heavy list won 23–39 %
    // of scenarios (too few ships to hold objectives), this one 47–63 %.
    ships: [
      { loadoutId: "centurion_assault" },
      { loadoutId: "gladius_basic" },
      { loadoutId: "stiletto_basic" },
      { loadoutId: "stiletto_basic" },
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
];

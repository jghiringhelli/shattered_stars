import type { SquadBlueprint } from "./types";

/** Quick-build squads of synthetic collective. */
export const SYNTHETIC_COLLECTIVE_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
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
];

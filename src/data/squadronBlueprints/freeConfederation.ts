import type { SquadBlueprint } from "./types";

/** Quick-build squads of free confederation. */
export const FREE_CONFEDERATION_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
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
];

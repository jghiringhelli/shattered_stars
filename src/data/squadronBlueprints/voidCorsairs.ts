import type { SquadBlueprint } from "./types";

/** Quick-build squads of void corsairs. */
export const VOID_CORSAIRS_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
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
    // Not "balanced" (round 5): four hulls hold objectives where the three-ship
    // Corsair Line won 35 % of classic scenarios, but its cheap Fangs in the
    // Balanced reinforcement rotation lose that mode; the rotation flies
    // Corsair Line (as the Confederation's does).
    style: "aggressive",
    // Identity: Bloody Cutlass (raider ace, illicit capacitors) leads the
    // Raider's Cadence over a Blade, a Fang and a Venom.
    ships: [
      { loadoutId: "cutlass_black_market" },
      { loadoutId: "blade_overcharged" },
      { loadoutId: "fang_raider" },
      { loadoutId: "venom_swarm" },
    ],
  },
  {
    id: "vc_199_corsair_line",
    factionId: "void_corsairs",
    pointLimit: 199,
    name: "Corsair Line",
    style: "balanced",
    // Bloody Cutlass leads two Scimitars.
    ships: [
      { loadoutId: "scimitar_assault" },
      { loadoutId: "scimitar_assault" },
      { loadoutId: "cutlass_black_market" },
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
      { loadoutId: "blade_overcharged" },
      { loadoutId: "fang_hot_wired" },
    ],
  },
];

import type { SquadBlueprint } from "./types";

/** Quick-build squads of ascendant empire. */
export const ASCENDANT_EMPIRE_BLUEPRINTS: ReadonlyArray<SquadBlueprint> = [
  {
    id: "ae_100_holy_herald",
    factionId: "ascendant_empire",
    pointLimit: 100,
    name: "Holy Herald",
    style: "aggressive",
    ships: [{ loadoutId: "herald_striker" }, { loadoutId: "cherub_ace" }],
  },
  {
    id: "ae_150_sacred_guard",
    factionId: "ascendant_empire",
    pointLimit: 150,
    name: "Sacred Guard",
    style: "aggressive",
    ships: [
      { loadoutId: "seraph_champion" },
      { loadoutId: "virtue_pursuit" },
      { loadoutId: "herald_scout" },
    ],
  },
  {
    id: "ae_200_temple_inquisition",
    factionId: "ascendant_empire",
    pointLimit: 200,
    name: "Temple Inquisition",
    // Not "balanced" (round 5): two Cherubs give the Aegis Field a fourth and
    // fifth body to protect in classic scenarios (44 % with three ships); the
    // Balanced reinforcement rotation flies Temple Line.
    style: "aggressive",
    // Identity: Foresight and Psi-Sensitive under the acolyte's Aegis Field.
    ships: [
      { loadoutId: "inquisitor_force" },
      { loadoutId: "acolyte_relay" },
      { loadoutId: "cherub_swarm" },
      { loadoutId: "cherub_swarm" },
    ],
  },
  {
    id: "ae_195_crusader_host",
    factionId: "ascendant_empire",
    pointLimit: 195,
    name: "Temple Line",
    style: "balanced",
    ships: [
      { loadoutId: "inquisitor_force" },
      { loadoutId: "acolyte_relay" },
      { loadoutId: "templar_force" },
    ],
  },
  {
    id: "ae_300_holy_crusade",
    factionId: "ascendant_empire",
    pointLimit: 300,
    name: "Holy Crusade",
    style: "control",
    ships: [
      { loadoutId: "crusader_defender" },
      { loadoutId: "acolyte_support" },
      { loadoutId: "virtue_basic" },
      { loadoutId: "crusader_defender" },
      { loadoutId: "cherub_ace" },
    ],
  },
];

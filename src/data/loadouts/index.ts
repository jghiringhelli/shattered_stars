/**
 * Roster quick builds — the builds that put every pilot card and every
 * upgrade card in play, merged after the original catalogue by
 * src/data/ShipLoadouts.ts (so each ship's default build is unchanged).
 */

import type { BlueprintsByShip, LoadoutBlueprint } from "./loadoutTypes";
import { ASCENDANT_ROSTER } from "./ascendantRoster";
import { CONFEDERATION_ROSTER } from "./confederationRoster";
import { CORSAIR_ROSTER } from "./corsairRoster";
import { SYNTHETIC_ROSTER } from "./syntheticRoster";
import { TERRAN_ROSTER } from "./terranRoster";

const FACTION_ROSTERS: ReadonlyArray<BlueprintsByShip> = [
  TERRAN_ROSTER,
  CONFEDERATION_ROSTER,
  SYNTHETIC_ROSTER,
  CORSAIR_ROSTER,
  ASCENDANT_ROSTER,
];

/** Every roster build, keyed by ship id. */
export const ROSTER_BLUEPRINTS: BlueprintsByShip = FACTION_ROSTERS.reduce<
  Record<string, LoadoutBlueprint[]>
>((merged, roster) => {
  for (const [shipId, blueprints] of Object.entries(roster)) {
    merged[shipId] = [...(merged[shipId] ?? []), ...blueprints];
  }
  return merged;
}, {});
